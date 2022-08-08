import { Token } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'
import { injectable } from 'inversify'

import { DEX, PoolV2WithContract, PoolV3WithContract, PoolWithContract } from '../common'
import { ConfigService } from '../config'
import { FetcherUniswapV2Service } from '../fetcher-uniswapv2'
import { FetcherUniswapV3Service } from '../fetcher-uniswapv3'

@injectable()
export class FetcherService {
  constructor(
    private readonly configService: ConfigService,
    private readonly fetcherUniswapV2Service: FetcherUniswapV2Service,
    private readonly fetcherUniswapV3Service: FetcherUniswapV3Service
  ) {}

  async fetchNeihgbours(tokenA: Token, tokenB: Token, dex: DEX): Promise<PoolWithContract[]> {
    const pools = new Array<PoolWithContract>()
    try {
      if (dex !== DEX.UniswapV2) {
        const pool = await this.fetcherUniswapV2Service.fetch(tokenA, tokenB, dex)
        pools.push(pool)
      }
      if (dex !== DEX.SushiSwap) {
        const pool = await this.fetcherUniswapV2Service.fetch(
          tokenA,
          tokenB,
          dex,
          this.configService.get('dexes.sushiswap.factoryAddress'),
          this.configService.get('dexes.sushiswap.pairCodeHash')
        )
        pools.push(pool)
      }
      if (dex !== DEX.UniswapV3) {
        const poolsV3 = await this.fetcherUniswapV3Service.fetchAll(tokenA, tokenB)
        pools.push(...poolsV3)
      }
    } catch (e) {}
    return pools
  }

  async fetchUniswapV2(
    tokenA: Token,
    tokenB: Token,
    dex: DEX,
    factoryAddress?: string,
    initCodeHash?: string
  ): Promise<PoolV2WithContract> {
    return this.fetcherUniswapV2Service.fetch(tokenA, tokenB, dex, factoryAddress, initCodeHash)
  }

  async fetchUniswapV3(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    dex: DEX
  ): Promise<PoolV3WithContract> {
    return this.fetcherUniswapV3Service.fetch(tokenA, tokenB, fee, dex)
  }
}
