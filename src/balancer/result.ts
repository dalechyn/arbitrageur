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

    let feeNumeratorA: JSBI
    let feeDenominatorA: JSBI
    let feeNumeratorB: JSBI
    let feeDenominatorB: JSBI
    if (this.from.pool instanceof Pair) {
      feeNumeratorA = (this.from.pool as Pair).feeNumerator
      feeDenominatorA = (this.from.pool as Pair).feeDenominator
    } else if (this.from.pool instanceof Pool) {
      feeNumeratorA = JSBI.BigInt(0)
      feeDenominatorA = JSBI.BigInt(0)
    }
    if (this.to.pool instanceof Pair) {
      feeNumeratorB = (this.to.pool as Pair).feeNumerator
      feeDenominatorB = (this.to.pool as Pair).feeDenominator
    } else if (this.to.pool instanceof Pool) {
      feeNumeratorB = JSBI.BigInt(0)
      feeDenominatorB = JSBI.BigInt(0)
    }

    const packedFeesAndTypesAndBaseToken = JSBI.bitwiseOr(
      JSBI.BigInt(BASE_TOKEN.address),
      JSBI.bitwiseOr(
        JSBI.leftShift(JSBI.BigInt(this.dexB), JSBI.BigInt(160)),
        JSBI.bitwiseOr(
          JSBI.leftShift(JSBI.BigInt(this.dexA), JSBI.BigInt(164)),
          JSBI.bitwiseOr(
            JSBI.leftShift(JSBI.BigInt(feeDenominatorB!), JSBI.BigInt(168)),
            JSBI.bitwiseOr(
              JSBI.leftShift(JSBI.BigInt(feeNumeratorB!), JSBI.BigInt(184)),
              JSBI.bitwiseOr(
                JSBI.leftShift(JSBI.BigInt(feeDenominatorA!), JSBI.BigInt(200)),
                JSBI.leftShift(JSBI.BigInt(feeNumeratorA!), JSBI.BigInt(216))
              )
            )
          )
        )
      )
    )
    return iface.encodeFunctionData(this.arbMethodName, [
      blockNumber.toString(),
      this.amount.toString(),
      packedFeesAndTypesAndBaseToken.toString(),
      this.from.contract.address,
      this.to.contract.address
    ])
  }
}