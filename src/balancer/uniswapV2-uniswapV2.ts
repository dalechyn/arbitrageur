import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import JSBI from 'jsbi'
import { SupportedPoolWithContract } from '~interfaces'
import { MathUtils } from '~utils/mathUtils'

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
    MathUtils.sqrt(
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
): CurrencyAmount<Token> {
  const [amountB, firstPairAfter] = firstPair.getOutputAmount(amountIn)
  const [amountC, secondPairAfter] = secondPair.getOutputAmount(amountB)
  console.log(firstPairAfter.token0Price.toSignificant(20))
  console.log(secondPairAfter.token0Price.toSignificant(20))
  return amountC.subtract(amountIn)
}

export async function balanceUniswapV2ToUniswapV2(
  firstPoolV2Info: SupportedPoolWithContract<Pair>,
  secondPoolV2Info: SupportedPoolWithContract<Pair>,
  tokenA: Token
) {
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
  const amountIn = CurrencyAmount.fromRawAmount(tokenA, x)
  const maxProfit = calculateProfit(firstPoolV2Info.pool, secondPoolV2Info.pool, amountIn)

  console.log('Finished! Amount:', x.toString(), ' weiWETH')
  console.log('Finished! Profit:', maxProfit.toSignificant(), ' WETH')

  return [secondPoolV2Info.contract.address, firstPoolV2Info.contract.address, amountIn]
}
