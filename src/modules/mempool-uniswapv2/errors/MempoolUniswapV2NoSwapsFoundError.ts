import { Transaction } from 'ethers'

export class MempoolUniswapV2NoSwapsFoundError extends Error {
  constructor(tx: Transaction) {
    super(
      `Transaction called to router but has no UniswapV2 swaps\nhash: ${tx.hash}\ndata: ${tx.data}`
    )
    this.name = 'MempoolUniswapV2NoSwapsFoundError'
  }
}
