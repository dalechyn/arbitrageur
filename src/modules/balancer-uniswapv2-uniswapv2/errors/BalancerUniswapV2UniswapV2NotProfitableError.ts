import { Token } from '@uniswap/sdk-core'

export class BalancerUniswapV2UniswapV2NotProfitableError extends Error {
  constructor(tokenA: Token, tokenB: Token) {
    super(`Not profitable: ${tokenA.symbol}->${tokenB.symbol}->${tokenA.symbol}`)
    this.name = 'BalancerUniswapV2UniswapV2NotProfitableError'
  }
}
