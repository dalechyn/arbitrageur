import { Token } from '@uniswap/sdk-core'

export class FetcherUniswapV2PoolDoesNotExistError extends Error {
  constructor(poolAddress: string, tokenA: Token, tokenB: Token) {
    super(
      `FetcherUniswapV2PoolDoesNotExistError: pool does not exist\npool address: ${poolAddress}\ntokenA: ${tokenA.symbol} (${tokenA.address})\ntokenB: ${tokenB.symbol} (${tokenB.address})`
    )
  }
}
