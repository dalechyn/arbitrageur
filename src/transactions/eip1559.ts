import { TransactionRequest } from '@ethersproject/abstract-provider'
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle'
import { ethers } from 'ethers'

import { BLOCKS_IN_THE_FUTURE, CHAIN_ID, ethProvider } from '../utils'

import { getPriorityFee } from './priorityFee'

export const createEIP1559Transaction: (
  blockNumber: number,
  to: string,
  data: string
) => Promise<TransactionRequest> = async (blockNumber, to, data) => {
  const block = await ethProvider.getBlock(blockNumber)
  if (!block.baseFeePerGas) throw new Error('Chain does not support EIP1559, write code for legacy')
  const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
    block.baseFeePerGas,
    BLOCKS_IN_THE_FUTURE
  )
  const priorityFee = getPriorityFee()
  return {
    to,
    type: 2,
    data: '0x',
    maxFeePerGas: priorityFee.add(maxBaseFeeInFutureBlock).toString(),
    maxPriorityFeePerGas: priorityFee.toString(),
    gasLimit: 21000,
    value: ethers.utils.parseEther('0.0000001').toString(),
    chainId: CHAIN_ID
  }
}
