import { Provider } from '@ethersproject/abstract-provider'
import { Token } from '@uniswap/sdk-core'

import { GetPoolWithPricesFn } from './interfaces'
import { getUniswapV2PairWithPrices } from './uniswapV2'
import { getUniswapV3PoolWithPrices } from './uniswapV3'

import { SupportedPoolWithContract } from '~interfaces'
import { DEXType } from '~utils'

export class Fetcher {
  private readonly dexRecord: Record<DEXType, GetPoolWithPricesFn> = {
    [DEXType.UNISWAPV2]: getUniswapV2PairWithPrices,
    [DEXType.UNISWAPV3]: getUniswapV3PoolWithPrices
  }

  constructor(private readonly dexTypeA: DEXType, private readonly dexTypeB: DEXType) {}

  async fetch(
    factoryAddressA: string,
    factoryAddressB: string,
    baseToken: Token,
    quoteToken: Token,
    provider: Provider
  ): Promise<[SupportedPoolWithContract[], SupportedPoolWithContract[]]> {
    return [
      await this.dexRecord[this.dexTypeA](factoryAddressA, baseToken, quoteToken, provider),
      await this.dexRecord[this.dexTypeB](factoryAddressB, baseToken, quoteToken, provider)
    ]
  }
}
