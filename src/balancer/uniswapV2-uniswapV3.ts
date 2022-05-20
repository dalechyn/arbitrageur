import { CurrencyAmount, Price, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { LiquidityMath, Pool, priceToClosestTick, TickMath, tickToPrice } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'

import { SwapToPriceMath } from '~fetcher/uniswapV3/swapToPriceMath'
import { SupportedPoolWithContract } from '~interfaces'

const NEGATIVE_ONE = JSBI.BigInt(-1)

interface StepComputations {
  sqrtPriceStartX96: JSBI
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: JSBI
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
}

const sqrt = (value: JSBI) => {
  invariant(JSBI.greaterThan(value, JSBI.BigInt(2)), 'NEGATIVE')
  if (JSBI.lessThanOrEqual(value, JSBI.BigInt(2))) {
    return value
  }

  function newtonIteration(n: JSBI, x0: JSBI): JSBI {
    const x1 = JSBI.signedRightShift(JSBI.add(JSBI.divide(n, x0), x0), JSBI.BigInt(1))

    if (JSBI.equal(x0, x1) || JSBI.equal(x0, JSBI.subtract(x1, JSBI.BigInt(1)))) {
      return x0
    }
    return newtonIteration(n, x1)
  }

  return newtonIteration(value, JSBI.BigInt(1))
}

const getAmountOfTokensToTargetPrice = (
  reservesIn: CurrencyAmount<Token>,
  reservesOut: CurrencyAmount<Token>,
  target: JSBI,
  FEE_NOMINATOR = JSBI.BigInt(997),
  FEE_DENOMINATOR = JSBI.BigInt(1000)
) => {
  // dif numerators as square formula has two roots - pick biggest of em
  const numerators = [false, true].map((sign) =>
    JSBI[sign ? 'add' : 'subtract'](
      JSBI.multiply(
        reservesIn.quotient,
        JSBI.subtract(JSBI.unaryMinus(FEE_NOMINATOR), FEE_DENOMINATOR)
      ),
      sqrt(
        JSBI.subtract(
          JSBI.exponentiate(
            JSBI.multiply(reservesIn.quotient, JSBI.add(FEE_NOMINATOR, FEE_DENOMINATOR)),
            JSBI.BigInt(2)
          ),
          JSBI.multiply(
            JSBI.BigInt(4),
            JSBI.multiply(
              FEE_NOMINATOR,
              JSBI.subtract(
                JSBI.multiply(
                  FEE_DENOMINATOR,
                  JSBI.exponentiate(reservesIn.quotient, JSBI.BigInt(2))
                ),
                JSBI.multiply(
                  target,
                  JSBI.multiply(
                    FEE_DENOMINATOR,
                    JSBI.multiply(reservesIn.quotient, reservesOut.quotient)
                  )
                )
              )
            )
          )
        )
      )
    )
  )
  const denominator = JSBI.multiply(JSBI.BigInt(2), FEE_NOMINATOR)
  const roots = numerators.map((numerator) => JSBI.divide(numerator, denominator))
  return CurrencyAmount.fromRawAmount(
    reservesOut.currency,
    JSBI.greaterThan(roots[0], roots[1]) ? roots[0] : roots[1]
  )
}

/***
 * @description Finds amount of tokens to buy in order to achieve equilibrium.
 * It's met by buying queryToken on UniswapV2, and selling on UniswapV3
 * so long story short - i.e. WETH-cDAI-WETH,
 *  for V2: WETH = baseToken; cDai = queryToken,
 *  and V3: cDAI = baseToken, WETH = queryToken
 * @param poolV2Info
 * @param poolV3Info
 * @param baseToken
 */
export const balanceUniswapV2ToUniswapV3 = async (
  poolV2Info: SupportedPoolWithContract<Pair>,
  poolV3Info: SupportedPoolWithContract<Pool>,
  tokenA: Token
) => {
  const { pool } = poolV3Info
  const { pool: pair } = poolV2Info
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
  let v2Price = new Price<Token, Token>({
    baseAmount: pair.reserveOf(tokenA),
    quoteAmount: pair.reserveOf(tokenB)
  })

  const state = {
    amountA: JSBI.BigInt(0), // in UniswapV2
    amountB: JSBI.BigInt(0), // out UniswapV2=in UniswapV3
    amountC: JSBI.BigInt(0), // out UniswapV3
    sqrtPriceX96: pool.sqrtRatioX96,
    tick: pool.tickCurrent,
    liquidity: pool.liquidity
  }

  // The next code is a copy of Pool.swap, except for final price calculation
  while (true) {
    console.log(
      'Balancing pools, V2 price:',
      v2Price.invert().toSignificant(6),
      '⬆️, V3 price:',
      tickToPrice(tokenB, tokenC, state.tick).toSignificant(6),
      '⬇️'
    )
    const step: Partial<StepComputations> = {}
    step.sqrtPriceStartX96 = state.sqrtPriceX96

    // because each iteration of the while loop rounds, we can't optimize this code (relative to the smart contract)
    // by simply traversing to the next available tick, we instead need to exactly replicate
    // tickBitmap.nextInitializedTickWithinOneWord
    ;[step.tickNext, step.initialized] =
      await pool.tickDataProvider.nextInitializedTickWithinOneWord(
        state.tick,
        tokenB.equals(pool.token0),
        pool.tickSpacing
      )

    if (step.tickNext < TickMath.MIN_TICK) {
      step.tickNext = TickMath.MIN_TICK
    } else if (step.tickNext > TickMath.MAX_TICK) {
      step.tickNext = TickMath.MAX_TICK
    }

    // need to make sure the next price is not bigger than Pair price
    const sqrtPriceNextX96V3 = TickMath.getSqrtRatioAtTick(step.tickNext)
    const sqrtPriceFinalX96 = TickMath.getSqrtRatioAtTick(priceToClosestTick(v2Price.invert()))
    const nextV3Price = tickToPrice(tokenB, tokenC, step.tickNext)
    step.sqrtPriceNextX96 = nextV3Price.lessThan(v2Price.invert())
      ? sqrtPriceFinalX96
      : sqrtPriceNextX96V3
    ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
      SwapToPriceMath.computeSwapStep(
        state.sqrtPriceX96,
        step.sqrtPriceNextX96,
        state.liquidity,
        pool.fee
      )
    const amountB = JSBI.add(state.amountB, JSBI.add(step.amountIn, step.feeAmount))
    const amountC = JSBI.add(state.amountC, step.amountOut)
    const [currencyAmountA, pairUpdated] = pair.getInputAmount(
      CurrencyAmount.fromRawAmount(tokenB, amountB)
    )
    const amountA = currencyAmountA.quotient
    // if the next is true - tick crossing will take so much liquidity that V2 price will be
    // bumped too much
    // So here we look how much liquidity is needed to push V2 price to the current V3 price
    if (JSBI.greaterThan(amountA, amountC)) {
      const inputReserve = pair.reserveOf(tokenA)
      const outputReserve = pair.reserveOf(tokenB)
      const priceV3 = tickToPrice(tokenA, tokenB, state.tick)
      // knowing the liquidity we can estimate the needed reserve ratio to get the V3 price
      const amountIn = getAmountOfTokensToTargetPrice(inputReserve, outputReserve, priceV3.quotient)
      state.amountA = amountIn.quotient
      state.amountB = amountB
      state.amountC = amountC

      break
      // const reservesDeltaA = tokenA.sortsBefore(tokenB) ?
    }

    state.amountA = amountA
    state.amountB = amountB
    state.amountC = amountC

    if (JSBI.equal(sqrtPriceFinalX96, state.sqrtPriceX96)) break
    v2Price = new Price<Token, Token>({
      baseAmount: pairUpdated.reserveOf(tokenA),
      quoteAmount: pairUpdated.reserveOf(tokenB)
    })
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
      if (step.initialized) {
        let liquidityNet = JSBI.BigInt(
          (await pool.tickDataProvider.getTick(step.tickNext)).liquidityNet
        )
        // if we're moving leftward, we interpret liquidityNet as the opposite sign
        // safe because liquidityNet cannot be type(int128).min
        if (tokenB.equals(pool.token0)) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)

        state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
      }

      state.tick = tokenB.equals(pool.token0) ? step.tickNext - 1 : step.tickNext
    } else if (JSBI.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
      // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
      state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
    }
  }
  // ALCHEMY
  // REQ -> NODE -> SYNC (ETH)
  // LOCAL REQ -> NODE -> SYNC

  console.log('Finished! Profit:', JSBI.subtract(state.amountC, state.amountA).toString(), ' WETH')

  return CurrencyAmount.fromRawAmount(tokenA, state.amountA)
}

// i.e: V3: WETH->CDAI; V2: CDAI->WETH
// * @dev We are forced to use exactOutput type trade
// TODO
export const balanceUniswapV3ToUniswapV2 = async (
  poolV3Info: SupportedPoolWithContract<Pool>,
  poolV2Info: SupportedPoolWithContract<Pair>,
  tokenA: Token
) => {
  const { pool } = poolV3Info
  const { pool: pair } = poolV2Info
  const tokenB = tokenA === pool.token0 ? pool.token1 : pool.token0
  const tokenC = tokenA

  // Our target is to push price higher on UniV3
  // If x is baseToken - price is ratio of quoteToken / baseToken, need to BUY
  //  baseTokens,
  // if x is quoteToken - price is ratio of baseToken / quoteToken, need to BUY
  // queryTokens
  // Taken from UniswapV3Pool contract:
  // sqrtRatioX96 - The sqrt of the current ratio of amounts of token1 to token0
  let v2Price = new Price<Token, Token>({
    baseAmount: pair.reserveOf(tokenB),
    quoteAmount: pair.reserveOf(tokenC)
  })

  const state = {
    amountA: JSBI.BigInt(0),
    amountB: JSBI.BigInt(0),
    amountC: JSBI.BigInt(0),
    sqrtPriceX96: pool.sqrtRatioX96,
    tick: pool.tickCurrent,
    liquidity: pool.liquidity
  }

  // The next code is a copy of Pool.swap, except for final price calculation
  while (true) {
    console.log(
      'Balancing pools, V3 price:',
      tickToPrice(tokenA, tokenB, state.tick).toSignificant(6),
      '⬇️, V2 price:',
      v2Price.invert().toSignificant(6),
      '⬆️'
    )
    const step: Partial<StepComputations> = {}
    step.sqrtPriceStartX96 = state.sqrtPriceX96

    // because each iteration of the while loop rounds, we can't optimize this code (relative to the smart contract)
    // by simply traversing to the next available tick, we instead need to exactly replicate
    // tickBitmap.nextInitializedTickWithinOneWord
    ;[step.tickNext, step.initialized] =
      await pool.tickDataProvider.nextInitializedTickWithinOneWord(
        state.tick,
        tokenA.equals(pool.token0),
        pool.tickSpacing
      )

    if (step.tickNext < TickMath.MIN_TICK) {
      step.tickNext = TickMath.MIN_TICK
    } else if (step.tickNext > TickMath.MAX_TICK) {
      step.tickNext = TickMath.MAX_TICK
    }

    // need to make sure the next price is not bigger than Pair price
    const sqrtPriceNextX96V3 = TickMath.getSqrtRatioAtTick(step.tickNext)
    const sqrtPriceFinalX96 = TickMath.getSqrtRatioAtTick(priceToClosestTick(v2Price.invert()))

    const nextV3Price = tickToPrice(tokenA, tokenB, step.tickNext)
    step.sqrtPriceNextX96 = nextV3Price.lessThan(v2Price.invert())
      ? sqrtPriceFinalX96
      : sqrtPriceNextX96V3
    ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
      SwapToPriceMath.computeSwapStep(
        state.sqrtPriceX96,
        step.sqrtPriceNextX96,
        state.liquidity,
        pool.fee
      )

    const amountA = JSBI.add(state.amountA, JSBI.add(step.amountIn, step.feeAmount))
    const amountB = JSBI.add(state.amountB, step.amountOut)
    const [currencyAmountC, pairUpdated] = pair.getOutputAmount(
      CurrencyAmount.fromRawAmount(tokenB, amountB)
    )
    const amountC = currencyAmountC.quotient
    // if the next is true - tick crossing will take so much liquidity that V2 price will be
    // bumped too much
    // So here we look how much liquidity is needed to push V2 price to the current V3 price
    if (JSBI.greaterThan(amountA, amountC)) {
      const inputReserve = pair.reserveOf(tokenA)
      const outputReserve = pair.reserveOf(tokenB)
      const priceV3 = tickToPrice(tokenA, tokenB, state.tick)
      // knowing the liquidity we can estimate the needed reserve ratio to get the V3 price
      const amountIn = getAmountOfTokensToTargetPrice(inputReserve, outputReserve, priceV3.quotient)
      state.amountC = amountIn.quotient
      state.amountB = amountB
      state.amountA = amountA
    }

    state.amountA = amountA
    state.amountB = amountB
    state.amountC = amountC

    if (JSBI.equal(sqrtPriceFinalX96, state.sqrtPriceX96)) break
    v2Price = new Price<Token, Token>({
      baseAmount: pairUpdated.reserveOf(tokenB),
      quoteAmount: pairUpdated.reserveOf(tokenC)
    })
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
      if (step.initialized) {
        let liquidityNet = JSBI.BigInt(
          (await pool.tickDataProvider.getTick(step.tickNext)).liquidityNet
        )
        // if we're moving leftward, we interpret liquidityNet as the opposite sign
        // safe because liquidityNet cannot be type(int128).min
        if (tokenA.equals(pool.token0)) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)

        state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
      }

      state.tick = tokenA.equals(pool.token0) ? step.tickNext - 1 : step.tickNext
    } else if (JSBI.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
      // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
      state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
    }
  }

  console.log('Finished! Profit:', JSBI.subtract(state.amountC, state.amountA).toString(), ' WETH')

  return CurrencyAmount.fromRawAmount(tokenA, state.amountA)
}
