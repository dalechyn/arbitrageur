// TODO: Weighted tokens filtering
import { Token } from '@uniswap/sdk-core'

import { Chain, BASE_TOKEN, CHAIN_ID } from '../constants'

import { GetTokenPrice } from './interfaces/getTokenPrice'
import { UniswapV2 } from './uniswap-v2'
import { UniswapV3 } from './uniswap-v3'

const TOKENS_TO_SPOT = {
  [Chain.GOERLI]: [
    new Token(Chain.GOERLI, '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 18, 'UNI')
  ],
  [Chain.MAINNET]: [
    new Token(Chain.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC')
  ]
}

const SWAPS: GetTokenPrice[] = [UniswapV3, UniswapV2]

export const getProfitableOpportunities = async () => {
  // TODO: create an array of two non-identical pairs from SWAPS array
  await Promise.all(
    TOKENS_TO_SPOT[CHAIN_ID].map(async (t) => {
      const price0 = await SWAPS[0].getTokenPrice(BASE_TOKEN, t, true)
      if (!price0) return null
      console.log('Price0', price0.toSignificant(6))
      const price1 = await SWAPS[1].getTokenPrice(BASE_TOKEN, t)
      if (!price1) return null
      console.log('Price1', price1.toSignificant(6))
    })
  )
}
