import { DEXType, DEXTypeConverter } from '../../common'

export class BalancerWrongPoolsFedError extends Error {
  constructor(readonly pool0Type: DEXType, readonly pool1Type: DEXType) {
    super(
      `Wrong Pools Fed ${DEXTypeConverter.toLongFormat(
        pool0Type
      )} and ${DEXTypeConverter.toLongFormat(pool1Type)}`
    )
    this.name = 'BalancerWrongPoolsFedError'
  }
}
