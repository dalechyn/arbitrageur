import { Token } from '@uniswap/sdk-core'

import { CHAIN_ID } from './network'

export const BASE_TOKEN = new Token(
  CHAIN_ID,
  process.env.BASE_TOKEN_ADDRESS,
  parseInt(process.env.BASE_TOKEN_DECIMALS),
  process.env.BASE_TOKEN_NAME
)
