import { DEXType, DEXTypeConverter } from '../../interfaces'

export class BalancerNotSupportedError extends Error {
  constructor(readonly pool0Type: DEXType, readonly pool1Type: DEXType) {
    super(
      `Arbitrage between DEXes ${DEXTypeConverter.toLongFormat(
        pool0Type
      )} and ${DEXTypeConverter.toLongFormat(pool1Type)} is not supported`
    )
  }
}