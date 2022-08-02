import {
  NEGATIVE_ONE,
  AbstractBalancer,
  BalanceResult,
  BalancerWrongPoolsFedError
} from '../balancer'
import { DEXType, PoolV2WithContract, PoolV3WithContract, PoolWithContract } from '../interfaces'
import { BunyanLogger } from '../logger'

import { FractionUtils } from './utils'
import { SwapToPriceMath } from './utils/SwapToPriceMath'

import { CurrencyAmount, Price, Token } from '@uniswap/sdk-core'
import { LiquidityMath, priceToClosestTick, TickMath, tickToPrice } from '@uniswap/v3-sdk'
import { injectable } from 'inversify'
import JSBI from 'jsbi'

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
  constructor(private readonly logger: BunyanLogger) {}
  /**
   * Returns the closest tick to the price without a regard if pool's tick grows left or right.
   *
   * Pretty much same as @uniswap/v3-core priceToClosestTick, but selects not the one that equal or the less,
   * but the one which has the minimum between the price given and nearest upper
   * and lower tick
   *
   * @dev wtf do we actually need this
   * @param price Price of token to check tick for
   * @param tickSpacing Tick Spacing of the pool
   * @param zeroForOne Magic fucking variable which indicates both direction of the pool and sort of token0 and token1
   */
  private priceToBestTick(
    price: Price<Token, Token>,
    tickSpacing: number,
    zeroForOne: boolean
  ): number {
    const t = priceToClosestTick(price)
    const tPrev = t + (zeroForOne ? tickSpacing : -tickSpacing)
    const pricePrevTick = tickToPrice(price.baseCurrency, price.quoteCurrency, tPrev)
    const priceFromClosestTick = tickToPrice(price.baseCurrency, price.quoteCurrency, t)
    return FractionUtils.ABS(pricePrevTick.subtract(price)).lessThan(
      FractionUtils.ABS(priceFromClosestTick.subtract(price))
    )
      ? tPrev
      : t
  }

  /**
   * Returns Balance Result of UniswapV2 to UniswapV3
   * @param fromPoolInfo UniswapV2 Pool
   * @param toPoolInfo UniswapV3 Pool
   * @param tokenA Base token
   */
  private async v2ToV3(
    fromPoolInfo: PoolV2WithContract,
    toPoolInfo: PoolV3WithContract,
    tokenA: Token
  ): Promise<BalanceResult> {
    const { pool } = toPoolInfo
    const { pool: initialPair } = fromPoolInfo
    const tokenB = tokenA === pool.token0 ? pool.token1 : pool.token0
    const tokenC = tokenA

    // Our target is to push price lower on UniV3
    // If x is baseToken - price is ratio of quoteToken / baseToken, need to BUY
    //  baseTokens,
    // if x is quoteToken - price is ratio of baseToken / quoteToken, need to BUY
    // queryTokens
    // Taken from UniswapV3Pool contract:
    // sqrtRatioX96 - The sqrt of the current ratio of amounts of token1 to token0
    // ! invert because it's a sell operation
    const state = {
      amountA: JSBI.BigInt(0), // in UniswapV2
      amountB: JSBI.BigInt(0), // out UniswapV2=in UniswapV3
      amountC: JSBI.BigInt(0), // out UniswapV3
      sqrtPriceX96: pool.sqrtRatioX96,
      tick: pool.tickCurrent,
      liquidity: pool.liquidity,
      pair: initialPair
    }

    // The next code is a copy of Pool.swap, except for final price calculation
    this.logger.info(
      `Balancing pools, V2 price: ${state.pair
        .priceOf(tokenB)
        .toSignificant(6)} ⬆️, V3 price: ${tickToPrice(tokenB, tokenC, state.tick).toSignificant(
        6
      )} ⬇️`
    )
    let previousProfit = CurrencyAmount.fromRawAmount(tokenA, 0)
    while (true) {
      /*     this.logger.debug(
        `Balancing pools, V2 price: ${state.pair
          .priceOf(tokenB)
          .toSignificant(6)} ⬆️, V3 price: ${tickToPrice(tokenB, tokenC, state.tick).toSignificant(
          6
        )} ⬇️`
      ) */
      const step = {} as StepComputations
      step.sqrtPriceStartX96 = state.sqrtPriceX96

      step.tickNext = state.tick + (tokenB.equals(pool.token0) ? -1 : 1)

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK
      }

      // need to make sure the next price is not bigger than Pair price
      const sqrtPriceNextX96V3 = TickMath.getSqrtRatioAtTick(step.tickNext)
      // ensure that the final price is not the nearest from the left
      // TODO: catch this and if so don't move the tick at all
      // Write a logic that just buys on univ2 and sells on univ3 at constant price
      // here we need a logic that computes amount of tokens to move V2 price to V3
      // and therefore - just puts it to the formula.
      // amountC may be computed wrong by sdk? but as it should not move the tick
      // it should just move the tick correctly (pool.getOutputAmount)

      const tickBestFromV2 = this.priceToBestTick(
        initialPair.priceOf(tokenB),
        pool.tickSpacing,
        tokenB.equals(pool.token0)
      )

      const sqrtPriceFinalX96 = TickMath.getSqrtRatioAtTick(tickBestFromV2)
      const nextV3Price = tickToPrice(tokenB, tokenC, step.tickNext)
      step.sqrtPriceNextX96 = nextV3Price.lessThan(initialPair.priceOf(tokenB))
        ? sqrtPriceFinalX96
        : sqrtPriceNextX96V3
      ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
        SwapToPriceMath.computeSwapStep(
          state.sqrtPriceX96,
          step.sqrtPriceNextX96,
          state.liquidity,
          pool.fee
        )
      state.amountB = JSBI.add(state.amountB, JSBI.add(step.amountIn, step.feeAmount))
      state.amountC = JSBI.add(state.amountC, step.amountOut)
      const [currencyAmountA, pairUpdated] = initialPair.getInputAmount(
        CurrencyAmount.fromRawAmount(tokenB, state.amountB)
      )
      state.amountA = currencyAmountA.quotient
      const profit = CurrencyAmount.fromRawAmount(
        tokenA,
        JSBI.subtract(state.amountC, state.amountA)
      )
      if (previousProfit.greaterThan(profit)) {
        this.logger.debug('Profit from previous step was higher, finished')
        return {
          from: {
            address: fromPoolInfo.contract.address,
            type: fromPoolInfo.type,
            feeNumerator: fromPoolInfo.pool.feeNumerator,
            feeDenominator: fromPoolInfo.pool.feeDenominator
          },
          to: {
            address: toPoolInfo.contract.address,
            type: toPoolInfo.type
          },
          amountIn: CurrencyAmount.fromRawAmount(tokenA, state.amountA),
          profit
        }
      }
      previousProfit = profit
      // if the next is true - tick crossing will take so much liquidity that V2 price will be
      // bumped too much
      // So here we look how much liquidity is needed to push V2 price to the current V3 price
      if (
        pairUpdated.priceOf(tokenB).greaterThan(nextV3Price) &&
        JSBI.notEqual(step.sqrtPriceNextX96, sqrtPriceFinalX96)
      ) {
        this.logger.debug('Last step! V3 reached, pulling V2 price to match V3')
        const amountIn = SwapToPriceMath.computeAmountOfTokensToPrice(
          initialPair.reserveOf(tokenA),
          initialPair.reserveOf(tokenB),
          nextV3Price.invert()
        )
        state.amountA = amountIn.quotient
        const [amountOut] = initialPair.getOutputAmount(amountIn)
        state.amountB = amountOut.quotient
        state.amountC = (await pool.getOutputAmount(amountOut))[0].quotient
        break
      }

      state.pair = pairUpdated

      if (JSBI.equal(sqrtPriceFinalX96, state.sqrtPriceX96)) {
        this.logger.debug('Equillibrim met')
        if (JSBI.lessThan(state.amountC, state.amountA)) {
          this.logger.debug('But it`s not profitable. Fees eat up too much.')
        }
        break
      }

      /*
      save from exactInput = false
       {
        state.amountSpecifiedRemaining = JSBI.add(state.amountSpecifiedRemaining, step.amountOut)
        state.amountOutCalculated = JSBI.add(
          state.amountOutCalculated,
          JSBI.add(step.amountIn, step.feeAmount)
        )
      } */

      // TODO
      if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
        // if the tick is initialized, run the tick transition
        const tickLiquidity = JSBI.BigInt(
          (await pool.tickDataProvider.getTick(step.tickNext)).liquidityNet
        )
        if (JSBI.notEqual(tickLiquidity, JSBI.BigInt(0))) {
          let liquidityNet = tickLiquidity
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (tokenB.equals(pool.token0)) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)

          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
        }

        state.tick = step.tickNext
      } else if (JSBI.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
      }
    }
    // ALCHEMY
    // REQ -> NODE -> SYNC (ETH)
    // LOCAL REQ -> NODE -> SYNC

    const profit = JSBI.subtract(state.amountC, state.amountA)
    this.logger.info(`Finished! Profit: ${profit.toString()} weiETH`)

    return {
      from: {
        address: fromPoolInfo.contract.address,
        type: fromPoolInfo.type,
        feeNumerator: fromPoolInfo.pool.feeNumerator,
        feeDenominator: fromPoolInfo.pool.feeDenominator
      },
      to: {
        address: toPoolInfo.contract.address,
        type: toPoolInfo.type
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
    fromPoolInfo: PoolV3WithContract,
    toPoolInfo: PoolV2WithContract,
    tokenA: Token
  ): Promise<BalanceResult> {
    const { pool } = fromPoolInfo
    const { pool: initialPair } = toPoolInfo
    const tokenB = tokenA === pool.token0 ? pool.token1 : pool.token0
    const tokenC = tokenA

    // Our target is to push price higher on UniV3
    // If x is baseToken - price is ratio of quoteToken / baseToken, need to BUY
    //  baseTokens,
    // if x is quoteToken - price is ratio of baseToken / quoteToken, need to BUY
    // queryTokens
    // Taken from UniswapV3Pool contract:
    // sqrtRatioX96 - The sqrt of the current ratio of amounts of token1 to token0
    const state = {
      amountA: JSBI.BigInt(0),
      amountB: JSBI.BigInt(0),
      amountC: JSBI.BigInt(0),
      sqrtPriceX96: pool.sqrtRatioX96,
      tick: pool.tickCurrent,
      liquidity: pool.liquidity,
      pair: initialPair
    }

    this.logger.info(
      `Balancing pools, V3 price: ${tickToPrice(tokenB, tokenA, state.tick).toSignificant(
        6
      )} ⬆️, V2 price: ${state.pair.priceOf(tokenB).toSignificant(6)} ⬇️`
    )
    let previousProfit = CurrencyAmount.fromRawAmount(tokenA, 0)
    // The next code is a copy of Pool.swap, except for final price calculation
    while (true) {
      /*   this.logger.debug(
      `Balancing pools, V3 price: ${tickToPrice(tokenB, tokenA, state.tick).toSignificant(
        6
      )} ⬆️, V2 price: ${state.pair.priceOf(tokenB).toSignificant(6)} ⬇️`
    ) */
      const step = {} as StepComputations
      step.sqrtPriceStartX96 = state.sqrtPriceX96

      // we have to go through each tick as it changes the V2 pair accordingly
      step.tickNext = state.tick + (tokenA.equals(pool.token0) ? -1 : 1)

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK
      }

      const tickBestFromV2 = this.priceToBestTick(
        initialPair.priceOf(tokenB),
        pool.tickSpacing,
        tokenA.equals(pool.token0)
      )
      // need to make sure the next price is not bigger than Pair price
      const sqrtPriceNextX96V3 = TickMath.getSqrtRatioAtTick(step.tickNext)
      const sqrtPriceFinalX96 = TickMath.getSqrtRatioAtTick(tickBestFromV2)

      const nextV3Price = tickToPrice(tokenB, tokenA, step.tickNext)
      step.sqrtPriceNextX96 = nextV3Price.greaterThan(initialPair.priceOf(tokenB))
        ? sqrtPriceFinalX96
        : sqrtPriceNextX96V3
      ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
        SwapToPriceMath.computeSwapStep(
          state.sqrtPriceX96,
          step.sqrtPriceNextX96,
          state.liquidity,
          pool.fee
        )

      state.amountA = JSBI.add(state.amountA, JSBI.add(step.amountIn, step.feeAmount))
      state.amountB = JSBI.add(state.amountB, step.amountOut)
      const [currencyAmountC, pairUpdated] = initialPair.getOutputAmount(
        CurrencyAmount.fromRawAmount(tokenB, state.amountB)
      )
      state.amountC = currencyAmountC.quotient
      const profit = CurrencyAmount.fromRawAmount(
        tokenA,
        JSBI.subtract(state.amountC, state.amountA)
      )
      if (previousProfit.greaterThan(profit)) {
        this.logger.debug('Profit from previous step was higher, finished')
        return {
          from: {
            address: fromPoolInfo.contract.address,
            type: fromPoolInfo.type
          },
          to: {
            address: toPoolInfo.contract.address,
            type: toPoolInfo.type,
            feeNumerator: toPoolInfo.pool.feeNumerator,
            feeDenominator: toPoolInfo.pool.feeDenominator
          },
          amountIn: CurrencyAmount.fromRawAmount(tokenA, state.amountA),
          profit
        }
      }
      previousProfit = profit
      // if the next is true - tick crossing will take so much liquidity that V2 price will be
      // bumped too much
      // So here we look how much liquidity is needed to push V2 price to the current V3 price
      if (pairUpdated.priceOf(tokenB).lessThan(nextV3Price)) {
        this.logger.debug('Last step! V3 reached, pulling V2 price to match V3')
        const amountIn = SwapToPriceMath.computeAmountOfTokensToPrice(
          initialPair.reserveOf(tokenB),
          initialPair.reserveOf(tokenC),
          tickToPrice(tokenB, tokenA, state.tick)
        )
        state.amountB = amountIn.quotient
        const [amountOut] = initialPair.getOutputAmount(amountIn)
        state.amountC = amountOut.quotient
        state.amountA = (await pool.getInputAmount(amountIn))[0].quotient
        // tick changing in newPool not just by tickSpacing
        // tick changes differently, should be precise but it's not
        break
      }
      state.pair = pairUpdated

      if (JSBI.equal(sqrtPriceFinalX96, state.sqrtPriceX96)) {
        this.logger.debug('Equillibrium met')
        if (JSBI.lessThan(state.amountC, state.amountA)) {
          this.logger.debug('But it`s not profitable. Fees eat up too much.')
        }
        break
      }

      /*
    save from exactInput = false
     {
      state.amountSpecifiedRemaining = JSBI.add(state.amountSpecifiedRemaining, step.amountOut)
      state.amountOutCalculated = JSBI.add(
        state.amountOutCalculated,
        JSBI.add(step.amountIn, step.feeAmount)
      )
    } */

      // TODO
      if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
        // if the tick is initialized, run the tick transition
        const tickLiquidity = JSBI.BigInt(
          (await pool.tickDataProvider.getTick(step.tickNext)).liquidityNet
        )

        if (JSBI.notEqual(tickLiquidity, JSBI.BigInt(0))) {
          let liquidityNet = tickLiquidity
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (tokenA.equals(pool.token0)) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)

          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
        }

        state.tick = step.tickNext
      } else if (JSBI.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
      }
    }

    const profit = JSBI.subtract(state.amountC, state.amountA)
    if (JSBI.lessThanOrEqual(profit, JSBI.BigInt(0))) throw new Error('not profitable')
    this.logger.info(`Finished! Profit: ${profit.toString()} WETH`)

    return {
      from: {
        address: fromPoolInfo.contract.address,
        type: fromPoolInfo.type
      },
      to: {
        address: toPoolInfo.contract.address,
        type: toPoolInfo.type,
        feeNumerator: toPoolInfo.pool.feeNumerator,
        feeDenominator: toPoolInfo.pool.feeDenominator
      },
      amountIn: CurrencyAmount.fromRawAmount(tokenA, state.amountA),
      profit: CurrencyAmount.fromRawAmount(tokenA, profit)
    }
  }

  balance(from: PoolWithContract, to: PoolWithContract, baseToken: Token): Promise<BalanceResult> {
    const zeroForOne = from.price.lessThan(to.price)
    if (from.type === DEXType.UNISWAPV2 && to.type === DEXType.UNISWAPV3)
      return zeroForOne ? this.v2ToV3(from, to, baseToken) : this.v3ToV2(to, from, baseToken)

    if (from.type === DEXType.UNISWAPV3 && to.type === DEXType.UNISWAPV2)
      return zeroForOne ? this.v3ToV2(from, to, baseToken) : this.v2ToV3(to, from, baseToken)

    throw new BalancerWrongPoolsFedError(from.type, to.type)
  }
}
