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
    let feeNumeratorA: JSBI
    let feeDenominatorA: JSBI
    let feeNumeratorB: JSBI
    let feeDenominatorB: JSBI
    if (this.from.pool instanceof Pair) {
      feeNumeratorA = (this.from.pool as Pair).feeNumerator
      feeDenominatorA = (this.from.pool as Pair).feeDenominator
    }
    if (this.to.pool instanceof Pair) {
      feeNumeratorB = (this.to.pool as Pair).feeNumerator
      feeDenominatorB = (this.to.pool as Pair).feeDenominator
    }
    const poolTypes =
      (this.dexA === DEXType.UNISWAPV3 ? '0' : '1') + (this.dexB === DEXType.UNISWAPV3 ? '0' : '1')
    const x = JSBI.bitwiseOr(
      JSBI.bitwiseOr(
        JSBI.BigInt(BASE_TOKEN.address),
        JSBI.leftShift(feeNumeratorA! ?? feeNumeratorB!, JSBI.BigInt(176))
      ),
      JSBI.leftShift(feeDenominatorA! ?? feeDenominatorB!, JSBI.BigInt(160))
    )
    const y = JSBI.leftShift(JSBI.BigInt(poolTypes), JSBI.BigInt(192))

    const packedPoolAWithTypesAndBaseTokenAndFeeInfo = JSBI.bitwiseOr(x, y)

    const packedPoolBAndFeeInfo = JSBI.bitwiseOr(
      JSBI.bitwiseOr(
        JSBI.BigInt(this.to.contract.address),
        JSBI.leftShift(!feeNumeratorA! ? feeNumeratorB! : JSBI.BigInt(0), JSBI.BigInt(176))
      ),
      JSBI.leftShift(!feeDenominatorA! ? feeDenominatorB! : JSBI.BigInt(0), JSBI.BigInt(160))
    )

    const iface = new ethers.utils.Interface(Arbitrageur.abi)
    return iface.encodeFunctionData(this.arbMethodName, [
      blockNumber.toString(),
      this.amount.toString(),
      packedPoolAWithTypesAndBaseTokenAndFeeInfo.toString(),
      this.from.contract.address,
      packedPoolBAndFeeInfo.toString()
    ])
  }
}
