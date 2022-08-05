import { FetcherPoolDoesNotExistError, AbstractFetcher } from '../fetcher'
import { DEXType, PoolWithContract } from '../interfaces'
import { BunyanLogger } from '../logger'
import { ProviderService } from '../provider'

import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import { Pair } from '@uniswap/v2-sdk'
import { Contract } from 'ethers'
import { injectable } from 'inversify'

@injectable()
export class FetcherUniswapV2Service implements AbstractFetcher {
  constructor(
    private readonly logger: BunyanLogger,
    private readonly providerService: ProviderService
  ) {}

  async fetch(poolAddress: string, baseToken: Token, quoteToken: Token): Promise<PoolWithContract> {
    this.logger.info(`UniswapV2: Checking ${baseToken.symbol}-${quoteToken.symbol}: ${poolAddress}`)
    const pairContract = new Contract(poolAddress, UniswapV2Pair.abi, this.providerService)
    try {
      const { _reserve0, _reserve1 } = await pairContract.getReserves()
      const [reserveA, reserveB] = baseToken.sortsBefore(quoteToken)
        ? [_reserve0, _reserve1]
        : [_reserve1, _reserve0]
      const pair = new Pair(
        CurrencyAmount.fromRawAmount(baseToken, reserveA),
        CurrencyAmount.fromRawAmount(quoteToken, reserveB)
      )
      return {
        price: pair.priceOf(quoteToken),
        contract: pairContract,
        pool: pair,
        type: DEXType.UNISWAPV2
      }
    } catch {
      throw new FetcherPoolDoesNotExistError(poolAddress)
    }
  }
}
