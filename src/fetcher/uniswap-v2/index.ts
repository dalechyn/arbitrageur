import { Token, CurrencyAmount } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { ADDRESS_ZERO } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'

import { UNISWAP_V2_FACTORY_ADDRESS } from '../../constants'
import { ethProvider } from '../../utils'
import { GetTokenPrice } from '../interfaces/getTokenPrice'

import UniswapV2FactoryABI from './abi/UniswapV2Factory.json'
import UniswapV2PairABI from './abi/UniswapV2Pair.json'

const factory = new Contract(UNISWAP_V2_FACTORY_ADDRESS, UniswapV2FactoryABI, ethProvider)

export const UniswapV2: GetTokenPrice = {
  async getTokenPrice(tokenA: Token, tokenB: Token, _lowest) {
    const pairAddress = await factory.getPair(tokenA.address, tokenB.address)

    if (pairAddress === ADDRESS_ZERO) {
      console.warn(`UniswapV2: ${tokenA.symbol}-${tokenB.symbol} pair does not exist`)
      return null
    }

    console.info(`UniswapV2: Checking ${tokenA.symbol}-${tokenB.symbol}: ${pairAddress}`)
    const pairContract = new Contract(pairAddress, UniswapV2PairABI, ethProvider)
    const { _reserve0, _reserve1 } = await pairContract.getReserves()
    const [reserveA, reserveB] = tokenA.sortsBefore(tokenB)
      ? [_reserve0, _reserve1]
      : [_reserve1, _reserve0]
    const pair = new Pair(
      CurrencyAmount.fromRawAmount(tokenA, reserveA),
      CurrencyAmount.fromRawAmount(tokenB, reserveB)
    )
    return pair.token0Price
  }
}
