import { Transaction } from 'ethers'

export class MempoolUniswapV3IncorrectSignatureError extends Error {
  constructor(tx: Transaction) {
    super(
      `transaction called to UniswapV3 router but has incorrect signature\nhash: ${tx.hash}\ndata: ${tx.data}`
    )
  }
}
