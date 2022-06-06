import { Pair } from '@uniswap/v2-sdk'
import { Pool } from '@uniswap/v3-sdk'
import { ethers } from 'ethers'
import JSBI from 'jsbi'

import Arbitrageur from '../../deployments/goerli/Arbitrageur.json'

import { BASE_TOKEN, DEXType } from '~constants'
import { SupportedPoolWithContract } from '~interfaces'

export class BalanceResult {
  private readonly arbMethodName = 'arbitrage'
  constructor(
    private readonly from: SupportedPoolWithContract,
    private readonly to: SupportedPoolWithContract,
    private readonly amount: JSBI
  ) {}

  log() {
    console.log(
      'Start arbitrage from',
      this.from.contract.address,
      'to',
      this.to.contract.address,
      'with',
      this.amount.toString()
    )
  }

  private findDex(p: SupportedPoolWithContract): DEXType {
    if (p.pool instanceof Pool) return DEXType.UNISWAPV3
    if (p.pool instanceof Pair) return DEXType.UNISWAPV2
    throw new Error('DEX from one of the pools is not supported')
  }

  get dexA(): DEXType {
    return this.findDex(this.from)
  }

  get dexB(): DEXType {
    return this.findDex(this.to)
  }

  prepareCallData(blockNumber: number): string {
    const iface = new ethers.utils.Interface(Arbitrageur.abi)
    return iface.encodeFunctionData(this.arbMethodName, [
      blockNumber.toString(),
      this.amount.toString(),
      BASE_TOKEN.address,
      this.from.contract.address,
      this.to.contract.address,
      this.dexA,
      this.dexB
    ])
  }
}
