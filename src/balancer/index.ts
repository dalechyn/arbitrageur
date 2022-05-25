import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { Pool } from '@uniswap/v3-sdk'

import { balanceUniswapV2ToUniswapV3, balanceUniswapV3ToUniswapV2 } from './uniswapV2-uniswapV3'

import { DEX } from '~constants'
import { SupportedPoolWithContract } from '~interfaces'

const DEX_MODULE_ROUTER = {
  [DEX.UNISWAPV2]: {
    [DEX.UNISWAPV3]: balanceUniswapV2ToUniswapV3,
    [DEX.UNISWAPV2]: null
  },
  [DEX.UNISWAPV3]: {
    [DEX.UNISWAPV2]: balanceUniswapV3ToUniswapV2,
    [DEX.UNISWAPV3]: null
  }
}

// noinspection SuspiciousTypeOfGuard
/***
 @description Implementations of finding up equilibrium are different for all

 DEXes, so a lookuper is written in constructor
 */
export class Balancer {
  private readonly p1DEX: DEX
  private readonly p2DEX: DEX
  constructor(
    private readonly p1: SupportedPoolWithContract,
    private readonly p2: SupportedPoolWithContract,
    private readonly baseToken: Token
  ) {
    this.p1DEX = Balancer.findDEX(p1)
    this.p2DEX = Balancer.findDEX(p2)
  }

  private static findDEX(p: SupportedPoolWithContract): DEX {
    if (p.pool instanceof Pool) return DEX.UNISWAPV3
    if (p.pool instanceof Pair) return DEX.UNISWAPV2
    throw new Error('DEX from one of the pools is not supported')
  }

  public balance(): Promise<[string, string, CurrencyAmount<Token>]> {
    const f = DEX_MODULE_ROUTER[this.p1DEX][this.p2DEX]
    if (!f) throw new Error(`${this.p1DEX}-${this.p2DEX} are not supported`)
    // @ts-expect-error Error is suppressed for easier typing.
    return f(this.p1, this.p2, this.baseToken)
  }
}
