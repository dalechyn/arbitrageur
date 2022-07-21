import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle'
import pino from 'pino'

const logger = pino()

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
  const transaction = {
    to,
    type: 2,
    data: data ?? '0x',
    gasLimit: 200000,
    chainId
  }
  logger.info(
    ' | baseFeePerGas: ' +
      maxBaseFeeInFutureBlock.toString() +
      ' | maxFeePerGas ' +
      maxBaseFeeInFutureBlock.toString()
  )
  return {
    ...transaction,
    maxFeePerGas: maxBaseFeeInFutureBlock
  }
}
