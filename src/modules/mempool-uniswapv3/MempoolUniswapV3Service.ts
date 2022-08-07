import { IERC20ABI, SwapRouter02 } from '../abis'
import { ConfigService } from '../config'
import { BunyanLogger } from '../logger'
import {
  isUniswapV3Signature,
  isUniswapV3SwapV2Signature,
  isUniswapV3SwapV3Signature,
  UniswapV3Signature
} from '../mempool-uniswapv3'
import { ProviderService } from '../provider'

import {
  MempoolUniswapV3IncorrectSignatureError,
  MempoolUniswapV3NoSwapsFoundError
} from './errors'
import { UniswapV3Swap, UniswapV3SwapV3Signature } from './interfaces'

import { Token } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'
import { Contract, Transaction, utils } from 'ethers'
import { injectable } from 'inversify'

/**
 * Reconstructs and finds all UniswapV3 swaps in Tx's
 *
 * UniswapV3 swaps can be found in two routers - SwapRouter02 (UniswapV3)
 *
 * Important thing is that UniswapV3 swaps that trigger V2 pools are mostly being called by multicall function
 */
@injectable()
export class MempoolUniswapV3Service {
  constructor(
    private readonly logger: BunyanLogger,
    private readonly configService: ConfigService,
    private readonly providerService: ProviderService
  ) {}

  /**
   * Returns true if to is UniswapV3 router
   * @param to destination address
   */
  private isTxToUniswapV3(to?: string): boolean {
    return to === this.configService.get('dexes.uniswapV3.routerAddress')
  }

  /**
   * Returns an array of UniswapV2Swaps made in the transaction
   * @param tx Transaction data
   */
  async fromRawTx(tx: Transaction): Promise<UniswapV3Swap[]> {
    // get the root signature without 0x prefix
    const rootSignature = tx.data.slice(2, 10)
    // check if the signature is valid
    if (
      !isUniswapV3Signature(rootSignature) &&
      !isUniswapV3SwapV2Signature(rootSignature) &&
      !isUniswapV3SwapV3Signature(rootSignature)
    )
      throw new MempoolUniswapV3IncorrectSignatureError(tx)

    let callDatas: string[] = []

    // if the call signature is one of the V3 multicalls, we extract data from the call with ABI utils
    if (
      [
        UniswapV3Signature.multicall_1,
        UniswapV3Signature.multicall_2,
        UniswapV3Signature.multicall_3
      ].includes(rootSignature as UniswapV3Signature)
    ) {
      const swapRouter02Interface = new utils.Interface(SwapRouter02)
      callDatas = swapRouter02Interface.parseTransaction({ data: tx.data }).args.data
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
      !callDatas.every((data) => isUniswapV3SwapV3Signature(data.slice(2, 10)))
    )
      throw new MempoolUniswapV3NoSwapsFoundError(tx)

    const swaps: UniswapV3Swap[] = []
    for (const data of callDatas) {
      const signature = data.slice(2, 10)
      // look only for swap calldatas, drop the rest
      if (!isUniswapV3SwapV3Signature(signature)) continue

      this.logger.debug('MempoolUniswapV3Service: Gotcha bitch!')

      const iface = new utils.Interface(SwapRouter02)
      const result = iface.parseTransaction({ data }).args.params
      console.log(result)

      if (
        signature === UniswapV3SwapV3Signature.exactInputSingle ||
        signature === UniswapV3SwapV3Signature.exactOutputSingle
      ) {
        const tokenInAddress = result.tokenIn
        const tokenInContract = new Contract(tokenInAddress, IERC20ABI, this.providerService)
        const tokenInSymbol = await tokenInContract.symbol()
        const tokenInDecimals = await tokenInContract.decimals()
        const tokenIn = new Token(
          this.configService.get('network.chainId'),
          tokenInAddress,
          tokenInDecimals,
          tokenInSymbol
        )

        const tokenOutAddress = result.tokenOut
        const tokenOutContract = new Contract(tokenOutAddress, IERC20ABI, this.providerService)
        const tokenOutSymbol = await tokenOutContract.symbol()
        const tokenOutDecimals = await tokenOutContract.decimals()
        const tokenOut = new Token(
          this.configService.get('network.chainId'),
          tokenOutAddress,
          tokenOutDecimals,
          tokenOutSymbol
        )

        const baseResult = {
          tokenIn,
          tokenOut,
          hash: tx.hash,
          from: tx.from!,
          recipient: result.recipient,
          fee: result.fee,
          sqrtPriceLimitX96: new BigNumber(result.sqrtPriceLimitX96.toString())
        }

        if (signature === UniswapV3SwapV3Signature.exactInputSingle)
          swaps.push({
            ...baseResult,
            method: signature,
            amountIn: new BigNumber(result.amountIn),
            amountOutMinimum: new BigNumber(result.amountOutMinimum.toString())
          })
        else
          swaps.push({
            ...baseResult,
            method: signature,
            amountInMaximum: new BigNumber(result.amountInMaximum),
            amountOut: new BigNumber(result.amountOut.toString())
          })
      } else {
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
          method: signature,
          path,
          from: tx.from!,
          recipient: result.recipient,
          fee: result.fee,
          hash: tx.hash,
          sqrtPriceLimitX96: new BigNumber(result.sqrtPriceLimitX96.toString())
        }

        if (signature === UniswapV3SwapV3Signature.exactInput)
          swaps.push({
            ...baseResult,
            method: signature,
            amountIn: new BigNumber(result.amountIn),
            amountOutMinimum: new BigNumber(result.amountOutMinimum.toString())
          })
        else if (signature === UniswapV3SwapV3Signature.exactOutput)
          swaps.push({
            ...baseResult,
            method: signature,
            amountInMaximum: new BigNumber(result.amountInMaximum),
            amountOut: new BigNumber(result.amountOut.toString())
          })
      }
    }
    return swaps
  }

  onUniswapV3PendingTransaction(handler: (swaps: UniswapV3Swap[]) => unknown) {
    this.logger.debug(`MempoolUniswapV3Service: Starting to listen for pending transactions`)
    this.providerService.on('pending', async (tx: Transaction) => {
      this.logger.debug(`MempoolUniswapV3Service: Received transaction: ${tx.hash}`)
      if (!this.isTxToUniswapV3(tx.to)) {
        this.logger.debug(
          'MempoolUniswapV3Service:',
          'Transaction destination is not UniswapV3, skipping...'
        )
        return
      }
      try {
        handler(await this.fromRawTx(tx))
      } catch (e: any) {
        this.logger.debug(`MempoolUniswapV3Service: ${e.message}`)
      }
    })
  }
}
