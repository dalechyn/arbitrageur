import { Fraction } from '@uniswap/sdk-core'

export class FractionUtils {
  static ABS(f: Fraction) {
    if (f.lessThan(0)) return f.multiply(-1)
    return f
  }
}
