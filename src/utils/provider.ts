import { providers } from 'ethers'

import { CHAIN_ID, ETHEREUM_RPC_URL } from '../constants'

export const ethProvider = ETHEREUM_RPC_URL
  ? new providers.JsonRpcProvider({ url: ETHEREUM_RPC_URL }, CHAIN_ID)
  : providers.getDefaultProvider('goerli', { alchemy: process.env.ALCHEMY_API_KEY })
