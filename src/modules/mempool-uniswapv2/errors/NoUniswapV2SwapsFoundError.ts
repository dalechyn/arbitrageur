import { Transaction } from 'ethers'

export class NoUniswapV2SwapsFoundError extends Error {
  constructor(tx: Transaction) {
    super(
      `transaction called to router but has no UniswapV2 swaps\nhash:${tx.hash}\ndata:${tx.data}`
    )
  }
}
