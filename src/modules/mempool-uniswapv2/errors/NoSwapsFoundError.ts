import { Transaction } from 'ethers'

export class NoSwapsFoundError extends Error {
  constructor(tx: Transaction) {
    super(`transaction called to router but has no swaps\nhash:${tx.hash}\ndata:${tx.data}`)
  }
}
