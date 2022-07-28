import { DEXType } from '../../interfaces'

export class FetcherUknownPoolTypeError extends Error {
  constructor(public readonly poolType: DEXType) {
    super(`Uknown pool type at index ${poolType}`)
  }
}
