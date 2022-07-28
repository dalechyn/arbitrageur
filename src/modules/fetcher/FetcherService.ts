import { FetcherUniswapV2Service } from '../fetcher-uniswapv2'
import { FetcherUniswapV3Service } from '../fetcher-uniswapv3'
import { DEXType, PoolWithContract } from '../interfaces'

import { FetcherUknownPoolTypeError } from './errors'

import { Token } from '@uniswap/sdk-core'
import { injectable } from 'inversify'

@injectable()
export class FetcherService {
  constructor(
    private readonly fetcherUniswapV2: FetcherUniswapV2Service,
    private readonly fetcherUniswapV3: FetcherUniswapV3Service
  ) {}

  async fetch(
    poolAAddress: string,
    poolBAddress: string,
    poolAType: DEXType,
    poolBType: DEXType,
    baseToken: Token,
    quoteToken: Token
  ): Promise<[PoolWithContract, PoolWithContract]> {
    let poolAInfo: PoolWithContract | undefined
    let poolBInfo: PoolWithContract | undefined

    if (poolAType === DEXType.UNISWAPV2)
      poolAInfo = await this.fetcherUniswapV2.fetch(poolAAddress, baseToken, quoteToken)
    else if (poolAType === DEXType.UNISWAPV3)
      poolAInfo = await this.fetcherUniswapV3.fetch(poolAAddress, baseToken, quoteToken)

    if (poolBType === DEXType.UNISWAPV2)
      poolBInfo = await this.fetcherUniswapV2.fetch(poolBAddress, baseToken, quoteToken)
    else if (poolBType === DEXType.UNISWAPV3)
      poolBInfo = await this.fetcherUniswapV3.fetch(poolBAddress, baseToken, quoteToken)

    if (!poolAInfo) throw new FetcherUknownPoolTypeError(poolAType)
    if (!poolBInfo) throw new FetcherUknownPoolTypeError(poolBType)

    return [poolAInfo, poolBInfo]
  }
}
