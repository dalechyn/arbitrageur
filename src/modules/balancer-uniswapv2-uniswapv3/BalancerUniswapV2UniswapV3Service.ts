import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { LiquidityMath, priceToClosestTick, TickMath, tickToPrice } from '@uniswap/v3-sdk'
import { injectable } from 'inversify'
import JSBI from 'jsbi'

import {
  NEGATIVE_ONE,
  AbstractBalancer,
  BalanceResult,
  BalancerWrongPoolsFedError
} from '../balancer'
import { DEXType, PoolV2WithContract, PoolV3WithContract, PoolWithContract } from '../common'
import { BunyanLogger } from '../logger'

import { BalancerUniswapV2UniswapV3NotProfitableError } from './errors'
import { SwapToPriceMath } from './utils/SwapToPriceMath'

interface StepComputations {
  sqrtPriceStartX96: JSBI
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: JSBI
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
}

@injectable()
export class BalancerUniswapV2UniswapV3Service implements AbstractBalancer {
  constructor(private readonly logger?: BunyanLogger) {}
  /**
   * Returns Balance Result of UniswapV2 to UniswapV3
   * @param fromPoolInfo UniswapV2 Pool
   * @param toPoolInfo UniswapV3 Pool
   * @param tokenA Base token
   */
  private async v2ToV3(
    initialPair: PoolV2WithContract,
    pool: PoolV3WithContract,
    tokenA: Token
  ): Promise<BalanceResult> {
    const tokenB = tokenA === pool.token0 ? pool.token1 : pool.token0

    // Our target is to push price lower on UniV3
    // If x is baseToken - sqrtPriceX96 is ratio of quoteToken / baseToken, need to BUY
    //  baseTokens,
    // if x is quoteToken - sqrtPriceX96 is ratio of baseToken / quoteToken, need to BUY
    // quoteTokens
    // Taken from UniswapV3Pool contract:
    // sqrtRatioX96 - The sqrt of the current ratio of amounts of token1 to token0
    // ! invert because it's a sell operation
    const tickGoingLeft = !tokenA.equals(pool.token0)
    const state = {
      amountA: JSBI.BigInt(0), // in UniswapV2
      amountB: JSBI.BigInt(0), // out UniswapV2=in UniswapV3
      amountC: JSBI.BigInt(0), // out UniswapV3
      sqrtPriceX96: pool.sqrtRatioX96,
      tick: pool.tickCurrent,
      liquidity: pool.liquidity,
      pair: initialPair,
      previousProfit: CurrencyAmount.fromRawAmount(tokenA, 0)
    }

    this.logger?.info(
      `Balancing pools, V2 price: ${state.pair.priceOf(tokenA).toSignificant(6)} ${tokenB.symbol}/${
        tokenA.symbol
      } ⬆️, V3 price: ${tickToPrice(tokenA, tokenB, state.tick).toSignificant(6)} ⬇️  ${
        tokenB.symbol
      }/${tokenA.symbol}`
    )
    while (true) {
      const step = {} as StepComputations
      step.sqrtPriceStartX96 = state.sqrtPriceX96

      step.tickNext = state.tick + (tickGoingLeft ? -1 : 1)

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK
      }

      const sqrtPriceNextX96V3 = TickMath.getSqrtRatioAtTick(step.tickNext)

      const tickFromV2 = priceToClosestTick(initialPair.priceOf(tokenB))
      const sqrtPriceFinalX96 = TickMath.getSqrtRatioAtTick(tickFromV2)

      const priceV3Next = tickToPrice(tokenA, tokenB, step.tickNext)
      step.sqrtPriceNextX96 = priceV3Next.greaterThan(initialPair.priceOf(tokenA))
        ? sqrtPriceFinalX96
        : sqrtPriceNextX96V3

      // perform the swap step
      ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
        SwapToPriceMath.computeSwapStep(
          state.sqrtPriceX96,
          step.sqrtPriceNextX96,
          state.liquidity,
          pool.fee
        )
      state.amountB = JSBI.add(state.amountB, JSBI.add(step.amountIn, step.feeAmount))

      // next code checks if prev profit is bigger than current profit
      const [currencyAmountA, pairUpdated] = initialPair.getInputAmount(
        CurrencyAmount.fromRawAmount(tokenB, state.amountB)
      )
      const profit = CurrencyAmount.fromRawAmount(
        tokenA,
        JSBI.subtract(JSBI.add(state.amountC, step.amountOut), currencyAmountA.quotient)
      )
      if (state.previousProfit.greaterThan(profit)) {
        if (state.previousProfit.lessThan(0))
          throw new BalancerUniswapV2UniswapV3NotProfitableError(tokenA, tokenB)
        this.logger?.debug('Profit from previous step was higher, finished')
        break
      } else state.previousProfit = profit

      state.amountA = currencyAmountA.quotient
      state.amountC = JSBI.add(state.amountC, step.amountOut)

      // if the next is true - tick crossing will take so much liquidity that V2 price will be
      // bumped too much
      // So here we look how much liquidity is needed to push V2 price to the current V3 price
      if (
        pairUpdated.priceOf(tokenA).lessThan(priceV3Next) &&
        JSBI.notEqual(step.sqrtPriceNextX96, sqrtPriceFinalX96)
      ) {
        this.logger?.debug('Last step! V3 reached, pulling V2 price to match V3')
        const amountIn = SwapToPriceMath.computeAmountOfTokensToPrice(
          initialPair.reserveOf(tokenA),
          initialPair.reserveOf(tokenB),
          priceV3Next,
          initialPair.feeNumerator,
          initialPair.feeDenominator
        )
        state.amountA = amountIn.quotient
        const [amountOut] = initialPair.getOutputAmount(amountIn)
        state.amountB = amountOut.quotient
        state.amountC = (await pool.getOutputAmount(amountOut))[0].quotient
        break
      }
      state.pair = pairUpdated

      if (JSBI.equal(sqrtPriceFinalX96, state.sqrtPriceX96)) {
        this.logger?.debug('Equillibrim met')
        break
      }

      if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
        // if the tick is initialized, run the tick transition
        const tickLiquidity = JSBI.BigInt(
          (await pool.tickDataProvider.getTick(step.tickNext)).liquidityNet
        )
        if (JSBI.notEqual(tickLiquidity, JSBI.BigInt(0))) {
          let liquidityNet = tickLiquidity
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (tickGoingLeft) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)

          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
        }

        state.tick = step.tickNext
      } else if (JSBI.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
      }
    }

    const profit = JSBI.subtract(state.amountC, state.amountA)
    if (JSBI.lessThanOrEqual(profit, JSBI.BigInt(0)))
      throw new BalancerUniswapV2UniswapV3NotProfitableError(tokenA, tokenB)
    this.logger?.info(`Finished! Profit: ${profit.toString()} wei`)

    return {
      from: {
        address: initialPair.contract.address,
        type: initialPair.type,
        feeNumerator: initialPair.feeNumerator,
        feeDenominator: initialPair.feeDenominator
      },
      to: {
        address: pool.contract.address,
        type: pool.type
      },
      amountIn: CurrencyAmount.fromRawAmount(tokenA, state.amountA),
      profit: CurrencyAmount.fromRawAmount(tokenA, profit)
    }
  }

  /**
   * Returns Balance Result of UniswapV3 to UniswapV2
   * @param fromPoolInfo UniswapV3 Pool
   * @param toPoolInfo UniswapV2 Pool
   * @param tokenA Base token
   */
  private async v3ToV2(
    pool: PoolV3WithContract,
    initialPair: PoolV2WithContract,
    tokenA: Token
  ): Promise<BalanceResult> {
    const tokenB = tokenA === pool.token0 ? pool.token1 : pool.token0

    // Our target is to push price higher on UniV3
    // If x is baseToken - price is ratio of quoteToken / baseToken, need to BUY
    //  baseTokens,
    // if x is quoteToken - price is ratio of baseToken / quoteToken, need to BUY
    // queryTokens
    // Taken from UniswapV3Pool contract:
    // sqrtRatioX96 - The sqrt of the current ratio of amounts of token1 to token0
    const tickGoingLeft = tokenA.equals(pool.token0)
    const state = {
      amountA: JSBI.BigInt(0),
      amountB: JSBI.BigInt(0),
      amountC: JSBI.BigInt(0),
      sqrtPriceX96: pool.sqrtRatioX96,
      tick: pool.tickCurrent,
      liquidity: pool.liquidity,
      pair: initialPair,
      previousProfit: CurrencyAmount.fromRawAmount(tokenA, 0)
    }

    this.logger?.info(
      `Balancing pools, V3 price: ${tickToPrice(tokenA, tokenB, state.tick).toSignificant(6)} ${
        tokenB.symbol
      }/${tokenA.symbol} ⬆️, V2 price: ${state.pair.priceOf(tokenA).toSignificant(6)} ⬇️  ${
        tokenB.symbol
      }/${tokenA.symbol}`
    )
    while (true) {
      const step = {} as StepComputations
      step.sqrtPriceStartX96 = state.sqrtPriceX96

      // we have to go through each tick as it changes the V2 pair accordingly
      step.tickNext = state.tick + (tickGoingLeft ? -1 : 1)

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK
      }

      const sqrtPriceNextX96V3 = TickMath.getSqrtRatioAtTick(step.tickNext)

      // CHECK maybe tokenA
      const tickFromV2 = priceToClosestTick(initialPair.priceOf(tokenB))
      const sqrtPriceFinalX96 = TickMath.getSqrtRatioAtTick(tickFromV2)

      const priceV3Next = tickToPrice(tokenA, tokenB, step.tickNext)
      step.sqrtPriceNextX96 = priceV3Next.lessThan(initialPair.priceOf(tokenA))
        ? sqrtPriceFinalX96
        : sqrtPriceNextX96V3

      // perform the swap step
      ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
        SwapToPriceMath.computeSwapStep(
          state.sqrtPriceX96,
          step.sqrtPriceNextX96,
          state.liquidity,
          pool.fee
        )

      state.amountB = JSBI.add(state.amountB, step.amountOut)
      const [currencyAmountC, pairUpdated] = initialPair.getOutputAmount(
        CurrencyAmount.fromRawAmount(tokenB, state.amountB)
      )
      const profit = CurrencyAmount.fromRawAmount(
        tokenA,
        JSBI.subtract(state.amountC, state.amountA)
      )
      if (state.previousProfit.greaterThan(profit)) {
        if (state.previousProfit.lessThan(0))
          throw new BalancerUniswapV2UniswapV3NotProfitableError(tokenA, tokenB)
        this.logger?.debug('Profit from previous step was higher, finished')
        break
      } else state.previousProfit = profit

      state.amountA = JSBI.add(state.amountA, JSBI.add(step.amountIn, step.feeAmount))
      state.amountC = currencyAmountC.quotient

      // if the next is true - tick crossing will take so much liquidity that V2 price will be
      // bumped too much
      // So here we look how much liquidity is needed to push V2 price to the current V3 price
      if (
        pairUpdated.priceOf(tokenB).lessThan(priceV3Next) &&
        JSBI.notEqual(step.sqrtPriceNextX96, sqrtPriceFinalX96)
      ) {
        this.logger?.debug('Last step! V3 reached, pulling V2 price to match V3')
        const amountIn = SwapToPriceMath.computeAmountOfTokensToPrice(
          initialPair.reserveOf(tokenB),
          initialPair.reserveOf(tokenA),
          priceV3Next,
          initialPair.feeNumerator,
          initialPair.feeDenominator
        )
        state.amountB = amountIn.quotient
        const [amountOut] = initialPair.getOutputAmount(amountIn)
        state.amountC = amountOut.quotient
        state.amountA = (await pool.getInputAmount(amountIn))[0].quotient
        break
      }
      state.pair = pairUpdated

      if (JSBI.equal(sqrtPriceFinalX96, state.sqrtPriceX96)) {
        this.logger?.debug('Equillibrium met')
        break
      }

      if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
        // if the tick is initialized, run the tick transition
        const tickLiquidity = JSBI.BigInt(
          (await pool.tickDataProvider.getTick(step.tickNext)).liquidityNet
        )

        if (JSBI.notEqual(tickLiquidity, JSBI.BigInt(0))) {
          let liquidityNet = tickLiquidity
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (tickGoingLeft) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)

          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
        }

        state.tick = step.tickNext
      } else if (JSBI.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
      }
    }

    const profit = JSBI.subtract(state.amountC, state.amountA)
    if (JSBI.lessThanOrEqual(profit, JSBI.BigInt(0)))
      throw new BalancerUniswapV2UniswapV3NotProfitableError(tokenA, tokenB)
    this.logger?.info(`Finished! Profit: ${profit.toString()} wei`)

    return {
      from: {
        address: pool.contract.address,
        type: pool.type
      },
      to: {
        address: initialPair.contract.address,
        type: initialPair.type,
        feeNumerator: initialPair.feeNumerator,
        feeDenominator: initialPair.feeDenominator
      },
      amountIn: CurrencyAmount.fromRawAmount(tokenA, state.amountA),
      profit: CurrencyAmount.fromRawAmount(tokenA, profit)
    }
  }

  balance(
    poolA: PoolWithContract,
    poolB: PoolWithContract,
    baseToken: Token
  ): Promise<BalanceResult> {
    const zeroForOne = poolA.priceOf(baseToken).lessThan(poolB.priceOf(baseToken))
    if (poolA.type === DEXType.UNISWAPV2 && poolB.type === DEXType.UNISWAPV3)
      return zeroForOne
        ? this.v2ToV3(poolA, poolB, baseToken)
        : this.v3ToV2(poolB, poolA, baseToken)

    if (poolA.type === DEXType.UNISWAPV3 && poolB.type === DEXType.UNISWAPV2)
      return zeroForOne
        ? this.v3ToV2(poolA, poolB, baseToken)
        : this.v2ToV3(poolB, poolA, baseToken)

    throw new BalancerWrongPoolsFedError(poolA.type, poolB.type)
  }
}
