import { Token } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'

export class FetcherUniswapV3PoolDoesNotExistError extends Error {
  constructor(poolAddress: string, tokenA: Token, tokenB: Token, fee: FeeAmount) {
    super(
      `FetcherUniswapV3PoolDoesNotExistError: pool does not exist\npool address: ${poolAddress}\ntokenA: ${tokenA.symbol} (${tokenA.address})\ntokenB: ${tokenB.symbol} (${tokenB.address})\nfee: ${fee}`
    )
  }
}
