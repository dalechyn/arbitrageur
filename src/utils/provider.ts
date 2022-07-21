import { providers } from 'ethers'

export const createProvider = (url: string, chainId: number, isIPC: boolean = false) => {
  const provider = isIPC
    ? new providers.IpcProvider(url, chainId)
    : new providers.JsonRpcProvider({ url }, chainId)
  return provider
}
