import { Provider } from '@ethersproject/abstract-provider'
import { Token, CurrencyAmount } from '@uniswap/sdk-core'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import { Pair } from '@uniswap/v2-sdk'
import { ADDRESS_ZERO } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'

import { GetPoolWithPricesFn } from '../interfaces'

import { DEXType } from '~utils'

export const getUniswapV2PairWithPrices: GetPoolWithPricesFn = async (
  factoryAddress: string,
  baseToken: Token,
  quoteToken: Token,
  provider: Provider
) => {
  const factory = new Contract(factoryAddress, UniswapV2Factory.abi, provider)

  const pairAddress = await factory.getPair(baseToken.address, quoteToken.address)

  if (pairAddress === ADDRESS_ZERO) {
    console.warn(`UniswapV2: ${baseToken.symbol}-${quoteToken.symbol} pair does not exist`)
    return []
  }

  console.info(`UniswapV2: Checking ${baseToken.symbol}-${quoteToken.symbol}: ${pairAddress}`)
  const pairContract = new Contract(pairAddress, UniswapV2Pair.abi, provider)
  const { _reserve0, _reserve1 } = await pairContract.getReserves()
  const [reserveA, reserveB] = baseToken.sortsBefore(quoteToken)
    ? [_reserve0, _reserve1]
    : [_reserve1, _reserve0]
  const pair = new Pair(
    CurrencyAmount.fromRawAmount(baseToken, reserveA),
    CurrencyAmount.fromRawAmount(quoteToken, reserveB)
  )
  return [
    {
      price: pair.priceOf(quoteToken),
      contract: pairContract,
      pool: pair,
      type: DEXType.UNISWAPV2
    }
  ]
}
