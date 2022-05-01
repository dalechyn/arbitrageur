import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { Pool } from '@uniswap/v3-sdk'

import {
  equilibriumFromUniswapV2ToUniswapV3,
  equilibriumFromUniswapV3ToUniswapV2
} from './uniswapV2-uniswapV3'

import { DEX } from '~constants'
import { SupportedPoolWithContract } from '~interfaces'

const DEX_MODULE_ROUTER = {
  [DEX.UNISWAPV2]: {
    [DEX.UNISWAPV3]: equilibriumFromUniswapV2ToUniswapV3,
    [DEX.UNISWAPV2]: null
  },
  [DEX.UNISWAPV3]: {
    [DEX.UNISWAPV2]: equilibriumFromUniswapV3ToUniswapV2,
    [DEX.UNISWAPV3]: null
  }
}

// noinspection SuspiciousTypeOfGuard
/***
 @description Implementations of finding up equilibrium are different for all

 DEXes, so a lookuper is written in constructor
 */
export class EquilibriumMath {
  private readonly p1DEX: DEX
  private readonly p2DEX: DEX
  constructor(
    private readonly p1: SupportedPoolWithContract,
    private readonly p2: SupportedPoolWithContract,
    private readonly baseToken: Token
  ) {
    console.log('IM SORRY')
    this.p1DEX = EquilibriumMath.findDEX(p1)
    this.p2DEX = EquilibriumMath.findDEX(p2)
  }

  private static findDEX(p: SupportedPoolWithContract): DEX {
    if (p.pool instanceof Pool) return DEX.UNISWAPV3
    if (p.pool instanceof Pair) return DEX.UNISWAPV2
    throw new Error('DEX from one of the pools is not supported')
  }

  public calculate(): CurrencyAmount<Token> {
    console.log('heey')
    const f = DEX_MODULE_ROUTER[this.p1DEX][this.p2DEX]
    if (!f) throw new Error(`${this.p1DEX}-${this.p2DEX} are not supported`)
    // @ts-expect-error Error is suppressed for easier typing.
    return f(this.p1, this.p2, this.baseToken)
  }
}
