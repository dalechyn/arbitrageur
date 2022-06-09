import { providers } from 'ethers'

export const createProvider = (url: string, chainId: number) =>
  new providers.JsonRpcProvider({ url }, chainId)
