import { Token } from '@uniswap/sdk-core'

export class FetcherUniswapV2PoolDoesNotExistError extends Error {
  constructor(poolAddress: string, tokenA: Token, tokenB: Token) {
    super(
      `Pool does not exist\npool address: ${poolAddress}\ntokenA: ${tokenA.symbol} (${tokenA.address})\ntokenB: ${tokenB.symbol} (${tokenB.address})`
    )
    this.name = 'FetcherUniswapV2PoolDoesNotExistError'
  }
}
