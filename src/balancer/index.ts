import { Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { Pool } from '@uniswap/v3-sdk'

import { BalanceResult } from './result'
import { balanceUniswapV2ToUniswapV2 } from './uniswapV2-uniswapV2'
import { balanceUniswapV2ToUniswapV3, balanceUniswapV3ToUniswapV2 } from './uniswapV2-uniswapV3'

import { DEXType } from '~constants'
import { SupportedPoolWithContract } from '~interfaces'

const DEX_MODULE_ROUTER = {
  [DEXType.UNISWAPV2]: {
    [DEXType.UNISWAPV3]: balanceUniswapV2ToUniswapV3,
    [DEXType.UNISWAPV2]: balanceUniswapV2ToUniswapV2
  },
  [DEXType.UNISWAPV3]: {
    [DEXType.UNISWAPV2]: balanceUniswapV3ToUniswapV2,
    [DEXType.UNISWAPV3]: null
  }
}

// noinspection SuspiciousTypeOfGuard
/***
 @description Implementations of finding up equilibrium are different for all

 DEXes, so a lookuper is written in constructor
 */
export class Balancer {
  private readonly p1DEX: DEXType
  private readonly p2DEX: DEXType
  constructor(
    private readonly p1: SupportedPoolWithContract,
    private readonly p2: SupportedPoolWithContract,
    private readonly baseToken: Token
  ) {
    this.p1DEX = Balancer.findDEX(p1)
    this.p2DEX = Balancer.findDEX(p2)
  }

  private static findDEX(p: SupportedPoolWithContract): DEXType {
    if (p.pool instanceof Pool) return DEXType.UNISWAPV3
    if (p.pool instanceof Pair) return DEXType.UNISWAPV2
    throw new Error('DEX from one of the pools is not supported')
  }

  public async balance(): Promise<BalanceResult> {
    const f = DEX_MODULE_ROUTER[this.p1DEX][this.p2DEX]
    if (!f) throw new Error(`${this.p1DEX}-${this.p2DEX} are not supported`)
    // @ts-expect-error Error is suppressed for easier typing.
    const amountIn = await f(this.p1, this.p2, this.baseToken)
    return new BalanceResult(this.p1, this.p2, amountIn.quotient)
  }
}
