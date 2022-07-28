import { DEXType } from './DEXType'

import { Price, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { Pool as PoolV3 } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'

export type PoolWithContractMeta = {
  contract: Contract
  price: Price<Token, Token>
}

export type PoolV3WithContract = {
  pool: PoolV3
  type: DEXType.UNISWAPV3
} & PoolWithContractMeta

export type PoolV2WithContract = {
  pool: Pair
  type: DEXType.UNISWAPV2
} & PoolWithContractMeta

export type PoolWithContract = PoolV3WithContract | PoolV2WithContract
