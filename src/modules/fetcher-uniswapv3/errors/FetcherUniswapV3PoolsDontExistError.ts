import { Token } from '@uniswap/sdk-core'

export class FetcherUniswapV3PoolsDontExistError extends Error {
  constructor(tokenA: Token, tokenB: Token) {
    super(
      `FetcherUniswapV3PoolsDontExistError: no pools exist for tokens does not exist\npool address:\ntokenA: ${tokenA.symbol} (${tokenA.address})\ntokenB: ${tokenB.symbol} (${tokenB.address})`
    )
  }
}
