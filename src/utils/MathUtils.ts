import JSBI from 'jsbi'
import invariant from 'tiny-invariant'

export abstract class MathUtils {
  public static sqrt(value: JSBI) {
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
}
