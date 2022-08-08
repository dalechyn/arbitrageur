import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import { Contract } from 'ethers'
import { injectable } from 'inversify'
import JSBI from 'jsbi'

import { DEX, PoolV2WithContract } from '../common'
import { BunyanLogger } from '../logger'
import { ProviderService } from '../provider'

import { FetcherUniswapV2PoolDoesNotExistError } from './errors'

/**
 * FetcherUniswapV2Service
 *
 * Provides API for fetching any pool that matches UniswapV2 interface.
 */
@injectable()
export class FetcherUniswapV2Service {
  constructor(
    private readonly logger: BunyanLogger,
    private readonly providerService: ProviderService
  ) {}

  async fetch(
    tokenA: Token,
    tokenB: Token,
    dex: DEX,
    factoryAddress?: string,
    initCodeHash?: string,
    feeNumerator?: number,
    feeDenominator?: number
  ): Promise<PoolV2WithContract> {
    const poolAddress = PoolV2WithContract.getAddress(tokenA, tokenB, factoryAddress, initCodeHash)
    this.logger.info(`UniswapV2: Checking ${tokenA.symbol}-${tokenB.symbol}: ${poolAddress}`)
    const pairContract = new Contract(poolAddress, UniswapV2Pair.abi, this.providerService)
    try {
      const { _reserve0, _reserve1 } = await pairContract.getReserves()
      const [reserveA, reserveB] = tokenA.sortsBefore(tokenB)
        ? [_reserve0, _reserve1]
        : [_reserve1, _reserve0]
      return new PoolV2WithContract(
        CurrencyAmount.fromRawAmount(tokenA, reserveA),
        CurrencyAmount.fromRawAmount(tokenB, reserveB),
        pairContract,
        dex,
        feeNumerator ? JSBI.BigInt(feeNumerator) : undefined,
        feeDenominator ? JSBI.BigInt(feeDenominator) : undefined
      )
    } catch {
      throw new FetcherUniswapV2PoolDoesNotExistError(poolAddress, tokenA, tokenB)
    }
  }
}
