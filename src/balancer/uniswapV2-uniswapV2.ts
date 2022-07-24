import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { Logger } from 'ethers/lib/utils'
import JSBI from 'jsbi'

import { SupportedPoolWithContract } from '~interfaces'
import { JSBIUtils } from '~utils/jsbiUtils'

function getReserves(
  token: Token,
  { pool: { token0, reserve0, reserve1 } }: SupportedPoolWithContract<Pair>
) {
  const zeroForOne = token.equals(token0)
  const reserves = [reserve0, reserve1]
  return zeroForOne ? reserves : reserves.reverse()
}

// Buying in token(reservesIn_0) -> swapping(reservesIn_1) -> getting(reservesOut_1)
// token(reservesOut_1) = token(reservesIn_0)
// token(reservesOut_0) = token(reservesIn_1)
function calculateMaxPoint(
  reservesIn0: JSBI,
  reservesOut0: JSBI,
  reservesIn1: JSBI,
  reservesOut1: JSBI,
  FEE_NUMERATOR_0: JSBI,
  FEE_DENOMINATOR_0: JSBI,
  FEE_NUMERATOR_1: JSBI,
  FEE_DENOMINATOR_1: JSBI
) {
  const numerator = JSBI.subtract(
    JSBIUtils.sqrt(
      [
        reservesIn0,
        reservesOut0,
        reservesIn1,
        reservesOut1,
        FEE_NUMERATOR_0,
        FEE_DENOMINATOR_0,
        FEE_NUMERATOR_1,
        FEE_DENOMINATOR_1
      ].reduce((acc, el) => JSBI.multiply(acc, el), JSBI.BigInt(1))
    ),
    JSBI.multiply(
      reservesIn0,
      JSBI.multiply(reservesIn1, JSBI.multiply(FEE_DENOMINATOR_0, FEE_DENOMINATOR_1))
    )
  )

  const denominator = JSBI.multiply(
    FEE_NUMERATOR_0,
    JSBI.add(
      JSBI.multiply(reservesOut0, FEE_NUMERATOR_1),
      JSBI.multiply(reservesIn1, FEE_DENOMINATOR_1)
    )
  )

  return JSBI.divide(numerator, denominator)
}

function calculateProfit(
  firstPair: Pair,
  secondPair: Pair,
  amountIn: CurrencyAmount<Token>
): [CurrencyAmount<Token>, CurrencyAmount<Token>] {
  const [amountB] = firstPair.getOutputAmount(amountIn)
  const [amountC] = secondPair.getOutputAmount(amountB)
  return [amountC.subtract(amountIn), amountB]
}

export async function balanceUniswapV2ToUniswapV2(
  logger: Logger,
  firstPoolV2Info: SupportedPoolWithContract<Pair>,
  secondPoolV2Info: SupportedPoolWithContract<Pair>,
  tokenA: Token
) {
  logger.info(
    `Balancing pools, V2 price: ${firstPoolV2Info.pool
      .priceOf(tokenA)
      .toSignificant(6)}, V2 price:${secondPoolV2Info.pool.priceOf(tokenA).toSignificant(6)}`
  )
  const [reservesIn0, reservesOut0] = getReserves(tokenA, firstPoolV2Info).map((r) => r.quotient)
  const [reservesOut1, reservesIn1] = getReserves(tokenA, secondPoolV2Info).map((r) => r.quotient)

  const x = calculateMaxPoint(
    reservesIn0,
    reservesOut0,
    reservesIn1,
    reservesOut1,
    firstPoolV2Info.pool.feeNumerator,
    firstPoolV2Info.pool.feeDenominator,
    secondPoolV2Info.pool.feeNumerator,
    secondPoolV2Info.pool.feeDenominator
  )
  // convert to an amount without a reminder - integer division problem
  const amountInFalsy = CurrencyAmount.fromRawAmount(tokenA, x)
  const amountIn = firstPoolV2Info.pool.getInputAmount(
    firstPoolV2Info.pool.getOutputAmount(amountInFalsy)[0]
  )[0]
  const [maxProfit] = calculateProfit(firstPoolV2Info.pool, secondPoolV2Info.pool, amountIn)
  /* 
  const results = []
  for (let i = 1; i < 10000; i++) {
    const x_lower = CurrencyAmount.fromRawAmount(tokenA, `${i}00`).multiply(-1)
    const x_upper = CurrencyAmount.fromRawAmount(tokenA, `${i}00`)

    const [y_lower, amountB_lower] = calculateProfit(
      firstPoolV2Info.pool,
      secondPoolV2Info.pool,
      amountIn.add(x_lower)
    )
    const [y_upper, amountB_upper] = calculateProfit(
      firstPoolV2Info.pool,
      secondPoolV2Info.pool,
      amountIn.add(x_upper)
    )

    results.unshift({
      x: x_lower.quotient.toString(),
      y: y_lower.subtract(maxProfit).quotient.toString(),
      z: amountB_lower.quotient.toString()
    })
    results.push({
      x: x_upper.quotient.toString(),
      y: y_upper.subtract(maxProfit).quotient.toString(),
      z: amountB_upper.quotient.toString()
    })
  }

  await fs.writeFile(
    './out.csv',
    results.map(({ x, y, z }) => `${x},${y},${z}\n`)
  )  */

  if (maxProfit.lessThan(0)) throw new Error('not profitable')
  logger.info('Finished! Amount:', x.toString(), ' weiWETH')
  logger.info('Finished! Profit:', maxProfit.toSignificant(), ' WETH')

  return [amountIn.quotient, maxProfit.quotient]
}
