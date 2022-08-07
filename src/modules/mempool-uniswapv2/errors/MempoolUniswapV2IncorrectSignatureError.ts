import { Transaction } from 'ethers'

export class MempoolUniswapV2IncorrectSignatureError extends Error {
  constructor(tx: Transaction, isTargetedToV2: boolean) {
    super(
      `transaction called to UniswapV${
        isTargetedToV2 ? 2 : 3
      } router but has incorrect signature\nhash: ${tx.hash}\ndata: ${tx.data}`
    )
  }
}
