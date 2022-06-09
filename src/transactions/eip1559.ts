import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle'

export const createEIP1559Transaction = async (
  blockNumber: number,
  to: string,
  data: string,
  blocksInFuture: number,
  chainId: number,
  provider: Provider
): Promise<TransactionRequest> => {
  const block = await provider.getBlock(blockNumber)
  if (!block.baseFeePerGas) throw new Error('Chain does not support EIP1559, write code for legacy')
  const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
    block.baseFeePerGas,
    blocksInFuture
  )
  return {
    to,
    type: 2,
    data: data ?? '0x',
    maxFeePerGas: maxBaseFeeInFutureBlock,
    maxPriorityFeePerGas: 0,
    gasLimit: 1000000,
    chainId
  }
}
