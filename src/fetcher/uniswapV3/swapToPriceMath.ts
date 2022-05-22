import { CurrencyAmount, Fraction, Token } from '@uniswap/sdk-core'
import { FeeAmount, FullMath, SqrtPriceMath } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'

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
    feePips: FeeAmount
  ): [JSBI, JSBI, JSBI, JSBI] {
    const returnValues: Partial<{
      sqrtRatioNextX96: JSBI
      amountIn: JSBI
      amountOut: JSBI
      feeAmount: JSBI
    }> = {}

    const zeroForOne = JSBI.greaterThanOrEqual(sqrtRatioCurrentX96, sqrtRatioTargetX96)

    returnValues.amountIn = zeroForOne
      ? SqrtPriceMath.getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
      : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true)
    returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96

    const max = JSBI.equal(sqrtRatioTargetX96, returnValues.sqrtRatioNextX96)

    if (zeroForOne) {
      returnValues.amountIn = max
        ? returnValues.amountIn
        : SqrtPriceMath.getAmount0Delta(
            returnValues.sqrtRatioNextX96,
            sqrtRatioCurrentX96,
            liquidity,
            true
          )
      returnValues.amountOut = SqrtPriceMath.getAmount1Delta(
        returnValues.sqrtRatioNextX96,
        sqrtRatioCurrentX96,
        liquidity,
        false
      )
    } else {
      returnValues.amountIn = max
        ? returnValues.amountIn
        : SqrtPriceMath.getAmount1Delta(
            sqrtRatioCurrentX96,
            returnValues.sqrtRatioNextX96,
            liquidity,
            true
          )
      returnValues.amountOut = SqrtPriceMath.getAmount0Delta(
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

  private static sqrt(value: JSBI) {
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

  public static computeAmountOfTokensToPrice(
    reservesIn: CurrencyAmount<Token>,
    reservesOut: CurrencyAmount<Token>,
    targetPrice: Fraction,
    FEE_NUMERATOR = JSBI.BigInt(997),
    FEE_DENOMINATOR = JSBI.BigInt(1000)
  ) {
    // dif numerators as square formula has two roots - pick biggest of em
    const rIn = reservesIn.quotient
    const rOut = reservesOut.quotient
    const tNumerator = targetPrice.numerator
    const tDenominator = targetPrice.denominator
    const numeratorLeftSide = JSBI.multiply(
      JSBI.multiply(rIn, JSBI.subtract(JSBI.unaryMinus(FEE_NUMERATOR), FEE_DENOMINATOR)),
      tNumerator
    )

    const numeratorRightSide = this.sqrt(
      JSBI.multiply(
        tNumerator,
        JSBI.multiply(
          rIn,
          JSBI.add(
            JSBI.multiply(
              tNumerator,
              JSBI.multiply(
                rIn,
                JSBI.add(
                  JSBI.exponentiate(FEE_NUMERATOR, JSBI.BigInt(2)),
                  JSBI.exponentiate(FEE_DENOMINATOR, JSBI.BigInt(2))
                )
              )
            ),
            JSBI.multiply(
              FEE_NUMERATOR,
              JSBI.multiply(
                FEE_DENOMINATOR,
                JSBI.subtract(
                  JSBI.multiply(JSBI.BigInt(4), JSBI.multiply(rOut, tDenominator)),
                  JSBI.multiply(JSBI.BigInt(2), JSBI.multiply(rIn, tNumerator))
                )
              )
            )
          )
        )
      )
    )

    const numerators = [false, true].map((sign) =>
      JSBI[sign ? 'add' : 'subtract'](numeratorLeftSide, numeratorRightSide)
    )
    const denominator = JSBI.multiply(JSBI.BigInt(2), JSBI.multiply(FEE_NUMERATOR, tNumerator))
    const roots = numerators.map((numerator) => JSBI.divide(numerator, denominator))
    return CurrencyAmount.fromRawAmount(
      reservesIn.currency,
      JSBI.greaterThan(roots[0], roots[1]) ? roots[0] : roots[1]
    )
  }
}
