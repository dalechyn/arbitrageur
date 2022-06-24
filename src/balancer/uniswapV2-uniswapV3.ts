import { CurrencyAmount, Price, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { LiquidityMath, Pool, priceToClosestTick, TickMath, tickToPrice } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import pino from 'pino'

import { SwapToPriceMath } from './swapToPriceMath'

import { SupportedPoolWithContract } from '~interfaces'
import { FractionUtils } from '~utils'

const NEGATIVE_ONE = JSBI.BigInt(-1)

const logger = pino()

// same as priceToClosestTick, but selects not the one that equal or the less,
// but the one which has the minimum between the price given and nearest upper
// and lower tick
const priceToBestTick = (price: Price<Token, Token>, tickSpacing: number, zeroForOne: boolean) => {
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

interface StepComputations {
  sqrtPriceStartX96: JSBI
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: JSBI
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
}

/***
 * @description Finds amount of tokens to buy in order to achieve equilibrium.
 * It's met by buying queryToken on UniswapV2, and selling on UniswapV3
 * so long story short - i.e. WETH-cDAI-WETH,
 *  for V2: WETH = baseToken; cDai = queryToken,
 *  and V3: cDAI = baseToken, WETH = queryToken
 * @param fromPoolInfo
 * @param toPoolInfo
 * @param baseToken
 */
export const balanceUniswapV2ToUniswapV3 = async (
  fromPoolInfo: SupportedPoolWithContract<Pair>,
  toPoolInfo: SupportedPoolWithContract<Pool>,
  tokenA: Token
) => {
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
  logger.info(
    `Balancing pools, V2 price: ${state.pair
      .priceOf(tokenB)
      .toSignificant(6)} ⬆️, V3 price: ${tickToPrice(tokenB, tokenC, state.tick).toSignificant(
      6
    )} ⬇️`
  )
  let previousProfit = CurrencyAmount.fromRawAmount(tokenA, 0)
  while (true) {
    /*     logger.debug(
      `Balancing pools, V2 price: ${state.pair
        .priceOf(tokenB)
        .toSignificant(6)} ⬆️, V3 price: ${tickToPrice(tokenB, tokenC, state.tick).toSignificant(
        6
      )} ⬇️`
    ) */
    const step: Partial<StepComputations> = {}
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

    const tickBestFromV2 = priceToBestTick(
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
    const profit = CurrencyAmount.fromRawAmount(tokenA, JSBI.subtract(state.amountC, state.amountA))
    if (previousProfit.greaterThan(profit)) {
      logger.debug('Profit from previous step was higher, finished')
      return [state.amountA, previousProfit.quotient]
    }
    previousProfit = profit
    // if the next is true - tick crossing will take so much liquidity that V2 price will be
    // bumped too much
    // So here we look how much liquidity is needed to push V2 price to the current V3 price
    if (
      pairUpdated.priceOf(tokenB).greaterThan(nextV3Price) &&
      JSBI.notEqual(step.sqrtPriceNextX96, sqrtPriceFinalX96)
    ) {
      logger.debug('Last step! V3 reached, pulling V2 price to match V3')
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
      logger.debug('Equillibrim met')
      if (JSBI.lessThan(state.amountC, state.amountA)) {
        logger.debug('But it`s not profitable. Fees eat up too much.')
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
  logger.info(`Finished! Profit: ${profit.toString()} weiETH`)

  return [state.amountA, profit]
}

// i.e: V3: WETH->CDAI; V2: CDAI->WETH
// * @dev We are forced to use exactOutput type trade
// TODO
export const balanceUniswapV3ToUniswapV2 = async (
  fromPoolInfo: SupportedPoolWithContract<Pool>,
  toPoolInfo: SupportedPoolWithContract<Pair>,
  tokenA: Token
) => {
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

  logger.info(
    `Balancing pools, V3 price: ${tickToPrice(tokenB, tokenA, state.tick).toSignificant(
      6
    )} ⬆️, V2 price: ${state.pair.priceOf(tokenB).toSignificant(6)} ⬇️`
  )
  let previousProfit = CurrencyAmount.fromRawAmount(tokenA, 0)
  // The next code is a copy of Pool.swap, except for final price calculation
  while (true) {
    /*   logger.debug(
      `Balancing pools, V3 price: ${tickToPrice(tokenB, tokenA, state.tick).toSignificant(
        6
      )} ⬆️, V2 price: ${state.pair.priceOf(tokenB).toSignificant(6)} ⬇️`
    ) */
    const step: Partial<StepComputations> = {}
    step.sqrtPriceStartX96 = state.sqrtPriceX96

    // we have to go through each tick as it changes the V2 pair accordingly
    step.tickNext = state.tick + (tokenA.equals(pool.token0) ? -1 : 1)

    if (step.tickNext < TickMath.MIN_TICK) {
      step.tickNext = TickMath.MIN_TICK
    } else if (step.tickNext > TickMath.MAX_TICK) {
      step.tickNext = TickMath.MAX_TICK
    }

    const tickBestFromV2 = priceToBestTick(
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
    const profit = CurrencyAmount.fromRawAmount(tokenA, JSBI.subtract(state.amountC, state.amountA))
    if (previousProfit.greaterThan(profit)) {
      logger.debug('Profit from previous step was higher, finished')
      return [state.amountA, previousProfit.quotient]
    }
    previousProfit = profit
    // if the next is true - tick crossing will take so much liquidity that V2 price will be
    // bumped too much
    // So here we look how much liquidity is needed to push V2 price to the current V3 price
    if (pairUpdated.priceOf(tokenB).lessThan(nextV3Price)) {
      logger.debug('Last step! V3 reached, pulling V2 price to match V3')
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
      logger.debug('Equillibrium met')
      if (JSBI.lessThan(state.amountC, state.amountA)) {
        logger.debug('But it`s not profitable. Fees eat up too much.')
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
  logger.info(`Finished! Profit: ${profit.toString()} WETH`)

  return [state.amountA, profit]
}
