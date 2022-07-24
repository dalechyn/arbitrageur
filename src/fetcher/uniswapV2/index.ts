import { Provider } from '@ethersproject/abstract-provider'
import { Token, CurrencyAmount } from '@uniswap/sdk-core'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import { Pair } from '@uniswap/v2-sdk'
import { Contract } from 'ethers'
import { Logger } from 'pino'

import { GetPoolWithPricesFn } from '../interfaces'

import { DEXType, PoolDoesNotExistsError } from '~utils'

export const getUniswapV2PairWithPrices: GetPoolWithPricesFn = async (
  logger: Logger,
  poolAddress: string,
  baseToken: Token,
  quoteToken: Token,
  provider: Provider
) => {
  logger.info(`UniswapV2: Checking ${baseToken.symbol}-${quoteToken.symbol}: ${poolAddress}`)
  const pairContract = new Contract(poolAddress, UniswapV2Pair.abi, provider)
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
    throw new PoolDoesNotExistsError(poolAddress)
  }
}
