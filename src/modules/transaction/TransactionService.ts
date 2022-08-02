import Arbitrageur from '../../../deployments/mainnet/Arbitrageur.json'
import { BalanceResult } from '../balancer'
import { ConfigService } from '../config'
import { DEXType } from '../interfaces'
import { BunyanLogger } from '../logger'
import { ProviderService } from '../provider'

import { TransactionRequest } from '@ethersproject/abstract-provider'
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle'
import { ethers } from 'ethers'
import { injectable } from 'inversify'
import JSBI from 'jsbi'

@injectable()
export class TransactionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: BunyanLogger,
    private readonly providerService: ProviderService
  ) {}

  private prepareCallData(result: BalanceResult, blockNumber: number): string {
    const iface = new ethers.utils.Interface(Arbitrageur.abi)

    let feeNumeratorA: JSBI
    let feeDenominatorA: JSBI
    let feeNumeratorB: JSBI
    let feeDenominatorB: JSBI
    if (result.from.type === DEXType.UNISWAPV2) {
      feeNumeratorA = result.from.feeNumerator
      feeDenominatorA = result.from.feeDenominator
    } else if (result.from.type === DEXType.UNISWAPV3) {
      feeNumeratorA = JSBI.BigInt(0)
      feeDenominatorA = JSBI.BigInt(0)
    }
    if (result.to.type === DEXType.UNISWAPV2) {
      feeNumeratorB = result.to.feeNumerator
      feeDenominatorB = result.to.feeDenominator
    } else if (result.to.type === DEXType.UNISWAPV3) {
      feeNumeratorB = JSBI.BigInt(0)
      feeDenominatorB = JSBI.BigInt(0)
    }

    const packedFeesAndTypesAndBaseToken = JSBI.bitwiseOr(
      JSBI.BigInt(result.amountIn.currency.address),
      JSBI.bitwiseOr(
        JSBI.leftShift(JSBI.BigInt(result.to.type), JSBI.BigInt(160)),
        JSBI.bitwiseOr(
          JSBI.leftShift(JSBI.BigInt(result.from.type), JSBI.BigInt(164)),
          JSBI.bitwiseOr(
            JSBI.leftShift(JSBI.BigInt(feeDenominatorB!), JSBI.BigInt(168)),
            JSBI.bitwiseOr(
              JSBI.leftShift(JSBI.BigInt(feeNumeratorB!), JSBI.BigInt(184)),
              JSBI.bitwiseOr(
                JSBI.leftShift(JSBI.BigInt(feeDenominatorA!), JSBI.BigInt(200)),
                JSBI.leftShift(JSBI.BigInt(feeNumeratorA!), JSBI.BigInt(216))
              )
            )
          )
        )
      )
    )
    return iface.encodeFunctionData(this.configService.get('entryMethodName'), [
      blockNumber.toString(),
      result.amountIn.quotient.toString(),
      packedFeesAndTypesAndBaseToken.toString(),
      result.from.address,
      result.to.address
    ])
  }

  async createArbitrageTransaction(
    blockNumber: number,
    to: string,
    result: BalanceResult,
    blocksInFuture: number,
    chainId: number
  ): Promise<TransactionRequest> {
    const data = this.prepareCallData(result, blockNumber)
    const block = await this.providerService.getBlock(blockNumber)
    if (!block.baseFeePerGas)
      throw new Error('Chain does not support EIP1559, write code for legacy')
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
    this.logger.info(
      ' | baseFeePerGas: ' +
        maxBaseFeeInFutureBlock.toString() +
        ' | maxFeePerGas ' +
        maxBaseFeeInFutureBlock.toString()
    )
    return {
      ...transaction,
      maxFeePerGas: maxBaseFeeInFutureBlock,
      maxPriorityFeePerGas: '1000000000'
    }
  }
}
