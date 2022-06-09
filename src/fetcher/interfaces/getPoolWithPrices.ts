import { Provider } from '@ethersproject/abstract-provider'
import { Token } from '@uniswap/sdk-core'

import { SupportedPoolWithContract } from '~interfaces'

export type GetPoolWithPricesFn = (
  factoryAddress: string,
  baseToken: Token,
  quoteToken: Token,
  provider: Provider
) => Promise<SupportedPoolWithContract[]>
