import { Token } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'

export class FetcherUniswapV3PoolDoesNotExistError extends Error {
  constructor(poolAddress: string, tokenA: Token, tokenB: Token, fee: FeeAmount) {
    super(
      `Pool does not exist\npool address: ${poolAddress}\ntokenA: ${tokenA.symbol} (${tokenA.address})\ntokenB: ${tokenB.symbol} (${tokenB.address})\nfee: ${fee}`
    )
    this.name = 'FetcherUniswapV3PoolDoesNotExistError'
  }
}
