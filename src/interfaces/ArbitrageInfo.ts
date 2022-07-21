import { Token } from '@uniswap/sdk-core'

export interface ArbitrageInfo {
  poolA: string
  typeA: number
  poolB: string
  typeB: number
  baseToken: Token
  quoteToken: Token
  skip?: number
}
