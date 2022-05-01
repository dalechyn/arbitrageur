// TODO: Weighted tokens filtering
import { Token } from '@uniswap/sdk-core'

import { GetTokenPrices } from './interfaces/getTokenPrices'
import { UniswapV2 } from './uniswapV2'
import { UniswapV3 } from './uniswapV3'

import { Chain, BASE_TOKEN, CHAIN_ID } from '~constants'
import { EquilibriumMath } from '~equilibrium'
import { FractionUtils } from '~utils'

const TOKENS_TO_SPOT = {
  [Chain.GOERLI]: [
    // new Token(Chain.GOERLI, '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 18, 'UNI'),
    new Token(Chain.GOERLI, '0x822397d9a55d0fefd20F5c4bCaB33C5F65bd28Eb', 8, 'cDAI')
  ],
  [Chain.MAINNET]: [
    new Token(Chain.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC')
  ]
}

const SWAPS: GetTokenPrices[] = [UniswapV3, UniswapV2]

export const getProfitableOpportunities = async () => {
  // TODO: create an array of two non-identical pairs from SWAPS array
  // Next code finds triangular bi-dex arbitrage opportunities
  await Promise.all(
    TOKENS_TO_SPOT[CHAIN_ID].map(async (t) => {
      const prices0 = await SWAPS[0].getTokenPrices(BASE_TOKEN, t)
      console.log(
        '\tPrices:',
        prices0.map(({ price }) => price.toSignificant(6))
      )
      const prices1 = await SWAPS[1].getTokenPrices(BASE_TOKEN, t)
      console.log(
        '\tPrices: ',
        prices1.map(({ price }) => price.toSignificant(6))
      )
      // After we got prices, compare max(prices0) - min(prices1) and max(prices1) - min(prices0)
      if (prices0.length === 0 || prices1.length === 0)
        return console.warn('Insufficient prices to compare')
      const sortedPrices0 = prices0.sort(({ price: a }, { price: b }) =>
        a.lessThan(b) ? -1 : a.equalTo(b) ? 0 : 1
      )
      const sortedPrices1 = prices1.sort(({ price: a }, { price: b }) =>
        a.lessThan(b) ? -1 : a.equalTo(b) ? 0 : 1
      )

      console.log(
        sortedPrices0[0].price.toSignificant(6),
        sortedPrices0[sortedPrices0.length - 1].price.toSignificant(6)
      )
      console.log(
        sortedPrices1[0].price.toSignificant(6),
        sortedPrices1[sortedPrices1.length - 1].price.toSignificant(6)
      )
      const minPrices0 = sortedPrices0[0]
      const maxPrices0 = sortedPrices0[sortedPrices0.length - 1]
      const minPrices1 = sortedPrices1[0]
      const maxPrices1 = sortedPrices1[sortedPrices1.length - 1]

      // finding the actual price difference
      // by default we suppose that maxPrices0 - minPrices1 is bigger than maxPrices1 - minPrices0
      let dexDirection = 0
      if (
        FractionUtils.ABS(maxPrices1.price.subtract(minPrices0.price)).greaterThan(
          FractionUtils.ABS(maxPrices0.price.subtract(minPrices1.price))
        )
      )
        dexDirection = 1

      const math = new EquilibriumMath(
        dexDirection ? maxPrices0 : maxPrices1,
        dexDirection ? minPrices1 : minPrices0,
        BASE_TOKEN
      )

      const result = await math.calculate()

      console.info(
        dexDirection === 0
          ? `Buy on UniswapV2 ${result.toSignificant(3)}, sell on UniswapV3`
          : 'Buy on UniswapV3, sell on UniswapV2'
      )
    })
  )
}
