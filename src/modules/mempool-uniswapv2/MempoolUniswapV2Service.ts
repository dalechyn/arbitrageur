import { IERC20ABI, SwapRouter02 } from '../abis'
import { ConfigService } from '../config'
import { BunyanLogger } from '../logger'
import {
  isUniswapV3Signature,
  isUniswapV3SwapV2Signature,
  isUniswapV3SwapV3Signature,
  UniswapV3Signature,
  UniswapV3SwapV2Signature
} from '../mempool-uniswapv3'
import { ProviderService } from '../provider'

import {
  MempoolUniswapV2IncorrectSignatureError,
  MempoolUniswapV2NoSwapsFoundError
} from './errors'
import {
  UniswapV2SwapSignature,
  UniswapV2Swap,
  isUniswapV2Signature,
  isUniswapV2SwapSignature
} from './interfaces'

import { Token } from '@uniswap/sdk-core'
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router02.json'
import BigNumber from 'bignumber.js'
import { Contract, Transaction, utils } from 'ethers'
import { injectable } from 'inversify'

/**
 * Reconstructs and finds all UniswapV2 swaps in Tx's
 *
 * UniswapV2 swaps can be found in two routers - SwapRouter02 (UniswapV3) and UniswapV2Router02 (UniswapV2)
 *
 * Important thing is that UniswapV3 swaps that trigger V2 pools are mostly being called by multicall function
 */
@injectable()
export class MempoolUniswapV2Service {
  constructor(
    private readonly logger: BunyanLogger,
    private readonly configService: ConfigService,
    private readonly providerService: ProviderService
  ) {}

  /**
   * Returns true if to is UniswapV2 router
   * @param to destination address
   */
  private isTxToUniswapV2(to?: string): boolean {
    return to === this.configService.get('dexes.uniswapV2.routerAddress')
  }

  /**
   * Returns true if to is UniswapV2 or V3 router
   * @param to destination address
   */
  private isTxToUniswapV2OrV3(to?: string): boolean {
    return (
      this.isTxToUniswapV2(to) || to === this.configService.get('dexes.uniswapV3.routerAddress')
    )
  }

  /**
   * Returns an array of UniswapV2Swaps made in the transaction
   * @param tx Transaction data
   */
  async fromRawTx(tx: Transaction): Promise<UniswapV2Swap[]> {
    // get the root signature without 0x prefix
    const rootSignature = tx.data.slice(2, 10)
    const isTargetedToRouterV2 = this.isTxToUniswapV2(tx.to)
    // check if the signature is valid
    if (
      isTargetedToRouterV2
        ? !isUniswapV2Signature(rootSignature) && !isUniswapV2SwapSignature(rootSignature)
        : !isUniswapV3Signature(rootSignature) &&
          !isUniswapV3SwapV2Signature(rootSignature) &&
          !isUniswapV3SwapV3Signature(rootSignature)
    )
      throw new MempoolUniswapV2IncorrectSignatureError(tx, isTargetedToRouterV2)

    let callDatas: string[] = []

    // if the call signature is one of the V3 multicalls and targeted to V3, we extract data from the call with ABI utils
    if (
      [
        UniswapV3Signature.multicall_1,
        UniswapV3Signature.multicall_2,
        UniswapV3Signature.multicall_3
      ].includes(rootSignature as UniswapV3Signature)
    ) {
      if (isTargetedToRouterV2) throw new MempoolUniswapV2IncorrectSignatureError(tx, true)

      const swapRouter02Interface = new utils.Interface(SwapRouter02)
      callDatas = swapRouter02Interface.parseTransaction({
        data: tx.data
      }).args.data
    } else {
      callDatas = [tx.data]
    }

    if (
      // if only one callData is parsed and the root signature is multicall signature, an empty data parameter and no multicalls have actually been made
      (callDatas.length === 1 &&
        [
          UniswapV3Signature.multicall_1,
          UniswapV3Signature.multicall_2,
          UniswapV3Signature.multicall_3
        ].includes(callDatas[0].slice(2, 10) as UniswapV3Signature)) ||
      // if no calldatas have swap signatures
      !callDatas.every((data) => {
        const signature = data.slice(2, 10)
        return isUniswapV2SwapSignature(signature) || isUniswapV3SwapV2Signature(signature)
      })
    )
      throw new MempoolUniswapV2NoSwapsFoundError(tx)

    const swaps: UniswapV2Swap[] = []
    for (const data of callDatas) {
      const signature = data.slice(2, 10)
      // look only for swap calldatas, drop the rest
      if (!isUniswapV3SwapV2Signature(signature) && !isUniswapV2SwapSignature(signature)) continue

      this.logger.debug('MempoolUniswapV2Service: Gotcha bitch!')

      const iface = new utils.Interface(
        isUniswapV2SwapSignature(signature) ? UniswapV2Router.abi : SwapRouter02
      )
      const result = iface.parseTransaction({ data }).args

      const path = await Promise.all(
        result.path.map(async (tokenAddress: string) => {
          const tokenContract = new Contract(tokenAddress, IERC20ABI, this.providerService)
          const tokenSymbol = await tokenContract.symbol()
          const tokenDecimals = await tokenContract.decimals()
          return new Token(
            this.configService.get('network.chainId'),
            tokenAddress,
            tokenDecimals,
            tokenSymbol
          )
        })
      )

      const baseResult = {
        hash: tx.hash,
        from: tx.from!,
        path,
        to: result.to
      }

      if (signature === UniswapV3SwapV2Signature.swapExactTokensForTokens)
        swaps.push({
          ...baseResult,
          method: signature,
          amountIn: new BigNumber(result.amountIn.toString()),
          amountOutMin: new BigNumber(result.amountOutMin.toString())
        })
      else if (signature === UniswapV3SwapV2Signature.swapTokensForExactTokens)
        swaps.push({
          ...baseResult,
          method: signature,
          amountInMax: new BigNumber(result.amountInMax.toString()),
          amountOut: new BigNumber(result.amountOut.toString())
        })
      else if (signature === UniswapV2SwapSignature.swapETHForExactTokens)
        swaps.push({
          ...baseResult,
          method: signature,
          amountOut: new BigNumber(result.amountOut.toString()),
          deadline: new BigNumber(result.deadline.toString()),
          value: new BigNumber(tx.value.toString())
        })
      else if (
        signature === UniswapV2SwapSignature.swapExactETHForTokens ||
        signature === UniswapV2SwapSignature.swapExactETHForTokensSupportingFeeOnTransferTokens
      )
        swaps.push({
          ...baseResult,
          method: signature,
          amountOutMin: new BigNumber(result.amountOutMin.toString()),
          deadline: new BigNumber(result.deadline.toString()),
          value: new BigNumber(tx.value.toString())
        })
      else if (
        signature === UniswapV2SwapSignature.swapExactTokensForETH ||
        signature === UniswapV2SwapSignature.swapExactTokensForETHSupportingFeeOnTransferTokens ||
        signature === UniswapV2SwapSignature.swapExactTokensForTokens ||
        signature === UniswapV2SwapSignature.swapExactTokensForTokensSupportingFeeOnTransferTokens
      )
        swaps.push({
          ...baseResult,
          method: signature,
          amountIn: new BigNumber(result.amountIn.toString()),
          amountOutMin: new BigNumber(result.amountOutMin.toString()),
          deadline: new BigNumber(result.deadline.toString())
        })
      else
        swaps.push({
          ...baseResult,
          method: signature as
            | UniswapV2SwapSignature.swapTokensForExactETH
            | UniswapV2SwapSignature.swapTokensForExactTokens,
          amountInMax: new BigNumber(result.amountInMax.toString()),
          amountOut: new BigNumber(result.amountOut.toString()),
          deadline: new BigNumber(result.deadline.toString())
        })
    }
    return swaps
  }

  onUniswapV2PendingTransaction(handler: (swaps: UniswapV2Swap[]) => unknown) {
    this.logger.debug(`MempoolUniswapV2Service: Starting to listen for pending transactions`)
    this.providerService.on('pending', async (tx: Transaction) => {
      this.logger.debug(`MempoolUniswapV2Service: Received transaction: ${tx.hash}`)
      if (!this.isTxToUniswapV2OrV3(tx.to)) {
        this.logger.debug(
          'MempoolUniswapV2Service:',
          'Transaction destination is not UniswapV2 or V3, skipping...'
        )
        return
      }
      try {
        handler(await this.fromRawTx(tx))
      } catch (e: any) {
        if (
          !(e instanceof MempoolUniswapV2NoSwapsFoundError) &&
          !(e instanceof MempoolUniswapV2IncorrectSignatureError)
        )
          throw e
        this.logger.debug(`MempoolUniswapV2Service: ${e.message}`)
      }
    })
  }
}
