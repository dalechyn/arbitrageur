import { Transaction } from 'ethers'

export class MempoolUniswapV3NoSwapsFoundError extends Error {
  constructor(tx: Transaction) {
    super(
      `Transaction called to router but has no UniswapV3 swaps\nhash: ${tx.hash}\ndata: ${tx.data}`
    )
    this.name = 'MempoolUniswapV3NoSwapsFoundError'
  }
}
