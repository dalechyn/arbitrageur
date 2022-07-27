import { Price, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { Pool } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'
import { DEXType } from '~utils'

export type SupportedPool = Pool | Pair

export type SupportedPoolWithContract<TPool extends SupportedPool = SupportedPool> = {
  pool: TPool
  type: DEXType
  contract: Contract
  price: Price<Token, Token>
}
