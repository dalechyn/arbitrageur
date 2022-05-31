// TODO: Weighted tokens filtering
import { Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

import { GetPriceWithPool } from './interfaces/getTokenPrices'
import { Sushiswap } from './sushiswap'
import { UniswapV2 } from './uniswapV2'
import { UniswapV3 } from './uniswapV3'

import { Balancer } from '~balancer'
import { Chain, BASE_TOKEN, CHAIN_ID } from '~constants'
import { FractionUtils } from '~utils'

const TOKENS_TO_SPOT = {
  [Chain.GOERLI]: [
     new Token(Chain.GOERLI, '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 18, 'UNI')
    // new Token(Chain.GOERLI, '0xdc31ee1784292379fbb2964b3b9c4124d8f89c60', 18, 'DAI')
    // new Token(Chain.GOERLI, '0x70cba46d2e933030e2f274ae58c951c800548aef', 18, 'BAT')
    // new Token(Chain.GOERLI, '0x822397d9a55d0fefd20F5c4bCaB33C5F65bd28Eb', 8, 'cDAI')
    // new Token(Chain.GOERLI, '0xd87ba7a50b2e7e660f678a895e4b72e7cb4ccd9c', 6, 'USDC'),
    // new Token(Chain.GOERLI, '0xC04B0d3107736C32e19F1c62b2aF67BE61d63a05', 8, 'WBTC')
    // new Token(Chain.GOERLI, '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6', 18, 'WETH')
  ],
  [Chain.MAINNET]: [
    new Token(Chain.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC')
  ]
}

const SWAPS: GetPriceWithPool[] = [/* UniswapV3 */ UniswapV2, Sushiswap]

export const getProfitableOpportunities = async () => {
  // TODO: create an array of two non-identical pairs from SWAPS array
  // Next code finds triangular bi-dex arbitrage opportunities
  await Promise.all(
    TOKENS_TO_SPOT[CHAIN_ID].map(async (t) => {
      const poolWithPrices0 = await SWAPS[0].getPoolWithPrices(BASE_TOKEN, t)
      console.log(
        '\tPrices:',
        poolWithPrices0.map(({ price }) => price.toSignificant(6))
      )
      const poolWithPrices1 = await SWAPS[1].getPoolWithPrices(BASE_TOKEN, t)
      console.log(
        '\tPrices: ',
        poolWithPrices1.map(({ price }) => price.toSignificant(6))
      )
      // After we got prices, compare max(prices0) - min(prices1) and max(prices1) - min(prices0)
      if (poolWithPrices0.length === 0 || poolWithPrices1.length === 0)
        return console.warn('Insufficient prices to compare')
      const sortedPoolsWithPrices0 = poolWithPrices0.sort(({ price: a }, { price: b }) =>
        a.lessThan(b) ? -1 : a.equalTo(b) ? 0 : 1
      )
      const sortedPoolsWithPrices1 = poolWithPrices1.sort(({ price: a }, { price: b }) =>
        a.lessThan(b) ? -1 : a.equalTo(b) ? 0 : 1
      )

      console.log(
        sortedPoolsWithPrices0[0].price.toSignificant(6),
        sortedPoolsWithPrices0[sortedPoolsWithPrices0.length - 1].price.toSignificant(6)
      )
      console.log(
        sortedPoolsWithPrices1[0].price.toSignificant(6),
        sortedPoolsWithPrices1[sortedPoolsWithPrices1.length - 1].price.toSignificant(6)
      )
      const minPoolsWithPrices0 = sortedPoolsWithPrices0[0]
      const maxPoolsWithPrices0 = sortedPoolsWithPrices0[sortedPoolsWithPrices0.length - 1]
      const minPoolsWithPrices1 = sortedPoolsWithPrices1[0]
      const maxPoolsWithPrices1 = sortedPoolsWithPrices1[sortedPoolsWithPrices1.length - 1]

      // We must find the biggest delta for maximum profit
      // The sign of delta is bound to the direction of the trade
      // if deltaPrices0 < 0, then the swap should occure from pool0 to pool1
      // if deltaPrices1 < 0, then the swap should occure from pool1 to pool0,
      // as the negative result means the first argument has the price lower than the second
      const deltaPrices0 = minPoolsWithPrices0.price.subtract(maxPoolsWithPrices1.price)
      const deltaPrices1 = minPoolsWithPrices1.price.subtract(maxPoolsWithPrices0.price)

      const zeroForOne = FractionUtils.ABS(deltaPrices0).greaterThan(
        FractionUtils.ABS(deltaPrices1)
      )

      const math = new Balancer(
        zeroForOne
          ? deltaPrices0.lessThan(JSBI.BigInt(0))
            ? minPoolsWithPrices0
            : maxPoolsWithPrices1
          : deltaPrices1.lessThan(JSBI.BigInt(0))
          ? minPoolsWithPrices1
          : maxPoolsWithPrices0,
        zeroForOne
          ? deltaPrices0.lessThan(JSBI.BigInt(0))
            ? maxPoolsWithPrices1
            : minPoolsWithPrices0
          : deltaPrices1.lessThan(JSBI.BigInt(0))
          ? maxPoolsWithPrices0
          : minPoolsWithPrices1,
        BASE_TOKEN
      )

      const [p1, p2, result] = await math.balance()

      console.info('Pair Address:', p1)
      console.info('Pool Address:', p2)
      console.info('Full amount:', result.quotient.toString())
    })
  )
}
