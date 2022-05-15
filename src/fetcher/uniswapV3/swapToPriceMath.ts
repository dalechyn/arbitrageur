import { FeeAmount, FullMath, SqrtPriceMath } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

const MAX_FEE = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(6))

export abstract class SwapToPriceMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static computeSwapStep(
    sqrtRatioCurrentX96: JSBI,
    sqrtRatioTargetX96: JSBI,
    liquidity: JSBI,
    exactIn: boolean,
    feePips: FeeAmount
  ): [JSBI, JSBI, JSBI, JSBI] {
    const returnValues: Partial<{
      sqrtRatioNextX96: JSBI
      amountIn: JSBI
      amountOut: JSBI
      feeAmount: JSBI
    }> = {}

    const zeroForOne = JSBI.greaterThanOrEqual(sqrtRatioCurrentX96, sqrtRatioTargetX96)

    if (exactIn) {
      returnValues.amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
        : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true)
    } else {
      returnValues.amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
        : SqrtPriceMath.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false)
    }
    returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96

    const max = JSBI.equal(sqrtRatioTargetX96, returnValues.sqrtRatioNextX96)

    if (zeroForOne) {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount0Delta(
              returnValues.sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              true
            )
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount1Delta(
              returnValues.sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              false
            )
    } else {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount1Delta(
              sqrtRatioCurrentX96,
              returnValues.sqrtRatioNextX96,
              liquidity,
              true
            )
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount0Delta(
              sqrtRatioCurrentX96,
              returnValues.sqrtRatioNextX96,
              liquidity,
              false
            )
    }

    returnValues.feeAmount = FullMath.mulDivRoundingUp(
      returnValues.amountIn!,
      JSBI.BigInt(feePips),
      JSBI.subtract(MAX_FEE, JSBI.BigInt(feePips))
    )

    return [
      returnValues.sqrtRatioNextX96!,
      returnValues.amountIn!,
      returnValues.amountOut!,
      returnValues.feeAmount!
    ]
  }
}
