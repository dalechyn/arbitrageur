import { Token, CurrencyAmount } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { ADDRESS_ZERO } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'

import { GetTokenPrices } from '../interfaces/getTokenPrices'

import UniswapV2FactoryABI from './abi/UniswapV2Factory.json'
import UniswapV2PairABI from './abi/UniswapV2Pair.json'

import { UNISWAP_V2_FACTORY_ADDRESS } from '~constants'
import { ethProvider } from '~utils'

const factory = new Contract(UNISWAP_V2_FACTORY_ADDRESS, UniswapV2FactoryABI, ethProvider)

export const UniswapV2: GetTokenPrices = {
  async getTokenPrices(baseToken: Token, quoteToken: Token) {
    const pairAddress = await factory.getPair(baseToken.address, quoteToken.address)

    if (pairAddress === ADDRESS_ZERO) {
      console.warn(`UniswapV2: ${baseToken.symbol}-${quoteToken.symbol} pair does not exist`)
      return []
    }

    console.info(`UniswapV2: Checking ${baseToken.symbol}-${quoteToken.symbol}: ${pairAddress}`)
    const pairContract = new Contract(pairAddress, UniswapV2PairABI, ethProvider)
    const { _reserve0, _reserve1 } = await pairContract.getReserves()
    const [reserveA, reserveB] = baseToken.sortsBefore(quoteToken)
      ? [_reserve0, _reserve1]
      : [_reserve1, _reserve0]
    const pair = new Pair(
      CurrencyAmount.fromRawAmount(baseToken, reserveA),
      CurrencyAmount.fromRawAmount(quoteToken, reserveB)
    )
    return [{ price: pair.priceOf(quoteToken), contract: pairContract, pool: pair }]
  }
}
