import { Provider } from '@ethersproject/abstract-provider'
import { Token } from '@uniswap/sdk-core'
import { Logger } from 'pino'
import { SupportedPoolWithContract } from '~interfaces'

export type GetPoolWithPricesFn = (
  logger: Logger,
  poolAddress: string,
  baseToken: Token,
  quoteToken: Token,
  provider: Provider
) => Promise<SupportedPoolWithContract>
