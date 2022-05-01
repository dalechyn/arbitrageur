import { CurrencyAmount, Price, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import {
  LiquidityMath,
  nearestUsableTick,
  Pool,
  priceToClosestTick,
  TickMath
} from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

import { SupportedPoolWithContract } from '~interfaces'

/***
 * @description Finds amount of tokens to buy in order to achieve equilibrium.
 * It's met by buying queryToken on UniswapV2, and selling on UniswapV3
 * @param poolV2Info
 * @param poolV3Info
 * @param baseToken
 */
export const equilibriumFromUniswapV2ToUniswapV3 = async (
  poolV2Info: SupportedPoolWithContract<Pair>,
  poolV3Info: SupportedPoolWithContract<Pool>,
  baseToken: Token
) => {
  const { pool } = poolV3Info
  const { pool: pair } = poolV2Info
  const quoteToken = baseToken === pool.token0 ? pool.token1 : pool.token0

  let processAmount = CurrencyAmount.fromRawAmount(quoteToken, 0)

  // Our target is to push price lower on UniV3
  // If x is baseToken - price is ratio of quoteToken / baseToken, need to BUY
  //  baseTokens,
  // if x is quoteToken - price is ratio of baseToken / quoteToken, need to BUY
  // queryTokens
  // Taken from UniswapV3Pool contract:
  // sqrtRatioX96 - The sqrt of the current ratio of amounts of token1 to token0
  const pushingTickUp = baseToken.sortsBefore(quoteToken)

  let [tickCurrent, hasLiquidity] = await pool.tickDataProvider.nextInitializedTickWithinOneWord(
    pool.tickCurrent,
    !pushingTickUp,
    pool.tickSpacing
  )

  if (!hasLiquidity) {
    throw new Error('Pool is in a lower tick bound, there is no liquidity')
  }

  let sqrtRatioCurrent = pool.sqrtRatioX96
  // Looping until price of UniswapV2 goes up and till the first tick with prices
  // equal as much as possible is found
  let liquidityCrossed = JSBI.BigInt(0)
  let v2Price = new Price<Token, Token>({
    baseAmount: pair.reserveOf(baseToken),
    quoteAmount: pair.reserveOf(quoteToken)
  })
  while (processAmount.equalTo(0) || priceToClosestTick(v2Price) !== tickCurrent) {
    // We are going to sell on UniswapV3, therefore pushing price lower, and
    // pushing the tick lower
    // nextInitializedTickWithinOneWord returns only next tick within 256-word space
    // so if a tick was not initialized within 256 bits, the function needs to be called
    // again

    // Because we prefetch tick data - promise resolves immediately as JSBI value
    const tickData = await pool.tickDataProvider.getTick(tickCurrent)
    // As we calculate amount of query tokens to SELL, operation is the same as
    // base token BUY
    const liquidityNet = JSBI.BigInt(tickData.liquidityNet)
    const liquidityGross = JSBI.BigInt(tickData.liquidityGross)
    // if we're moving leftward, we interpret liquidityNet as the opposite sign
    // https://github.com/Uniswap/v3-sdk/blob/main/src/entities/pool.ts#L282

    const [tickNext, nextExists] = await pool.tickDataProvider.nextInitializedTickWithinOneWord(
      tickCurrent,
      !pushingTickUp,
      pool.tickSpacing
    )

    liquidityCrossed = LiquidityMath.addDelta(liquidityCrossed, liquidityNet)

    if (!nextExists) {
      // there is no next liquidity - treating V3 Ticked Pool as V2 Pair
      // dy = getOutputAmount(dx)
      // (x + dx) / y = (a + dx) / (b - dy)
      //
      const x = JSBI.divide(liquidityGross, sqrtRatioCurrent)
      const y = JSBI.multiply(liquidityNet, sqrtRatioCurrent)

      break
    }

    const sqrtRatioNext = TickMath.getSqrtRatioAtTick(tickNext)
    processAmount = processAmount.add(
      CurrencyAmount.fromRawAmount(
        quoteToken,
        pushingTickUp
          ? JSBI.divide(
              JSBI.multiply(liquidityCrossed, JSBI.subtract(sqrtRatioNext, sqrtRatioCurrent)),
              JSBI.multiply(sqrtRatioNext, sqrtRatioCurrent)
            )
          : JSBI.multiply(liquidityCrossed, JSBI.subtract(sqrtRatioNext, sqrtRatioCurrent))
      )
    )

    sqrtRatioCurrent = sqrtRatioNext
    tickCurrent = tickNext
    v2Price = new Price<Token, Token>({
      baseAmount: pair.reserveOf(baseToken).add(pair.getOutputAmount(processAmount)[0]),
      quoteAmount: pair.reserveOf(quoteToken).subtract(processAmount)
    })
  }
  return processAmount
}

export const equilibriumFromUniswapV3ToUniswapV2 = (
  poolV3Info: SupportedPoolWithContract<Pool>,
  poolV2Info: SupportedPoolWithContract<Pair>,
  baseToken: Token
) => {
  return Promise.resolve(CurrencyAmount.fromRawAmount(baseToken, 0))
}
