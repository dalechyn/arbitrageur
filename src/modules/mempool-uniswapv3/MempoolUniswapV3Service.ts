import { Token } from '@uniswap/sdk-core'
import SwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import BigNumber from 'bignumber.js'
import { Contract, Transaction, utils } from 'ethers'
import { injectable } from 'inversify'

import { IERC20ABI, SwapRouter02 } from '../abis'
import { DEX } from '../common'
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
import {
  isUniswapV3SwapSignature,
  UniswapV3PathElement,
  UniswapV3Swap,
  UniswapV3SwapSignature,
  UniswapV3SwapV3Signature
} from './interfaces'

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
   * Returns true if to is UniswapV3 Router1
   * @param to destination address
   */
  private isTxToUniswapV3RouterAddress(to?: string): boolean {
    return to === this.configService.get('dexes.uniswapV3.routerAddress')
  }

  /**
   * Returns true if to is UniswapV3 Router1 or Router2
   * @param to destination address
   */
  private isTxToUniswapV3(to?: string): boolean {
    return (
      to === this.configService.get('dexes.uniswapV3.router02Address') ||
      this.isTxToUniswapV3RouterAddress(to)
    )
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
      !isUniswapV3SwapSignature(rootSignature) &&
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
      const swapRouterInterface = new utils.Interface(
        this.isTxToUniswapV3RouterAddress(tx.to) ? SwapRouter.abi : SwapRouter02
      )
      callDatas = swapRouterInterface.parseTransaction({ data: tx.data }).args.data
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
        return isUniswapV3SwapSignature(signature) || isUniswapV3SwapV3Signature(signature)
      })
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

      if (
        signature === UniswapV3SwapV3Signature.exactInputSingle ||
        signature === UniswapV3SwapV3Signature.exactOutputSingle ||
        signature === UniswapV3SwapSignature.exactInputSingle ||
        signature === UniswapV3SwapSignature.exactOutputSingle
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
          // weird ts issue
          dex: DEX.UniswapV3 as DEX.UniswapV3,
          tokenIn,
          tokenOut,
          hash: tx.hash,
          from: tx.from!,
          recipient: result.recipient,
          fee: result.fee,
          sqrtPriceLimitX96: new BigNumber(result.sqrtPriceLimitX96.toString())
        }

        if (
          signature === UniswapV3SwapV3Signature.exactInputSingle ||
          signature === UniswapV3SwapSignature.exactInputSingle
        ) {
          const commonResult = {
            ...baseResult,
            amountIn: new BigNumber(result.amountIn.toString()),
            amountOutMinimum: new BigNumber(result.amountOutMinimum.toString())
          }
          if (signature === UniswapV3SwapSignature.exactInputSingle)
            swaps.push({
              ...commonResult,
              signature: signature,
              deadline: new BigNumber(result.deadline.toString())
            })
          else
            swaps.push({
              ...commonResult,
              signature: signature
            })
        } else {
          const commonResult = {
            ...baseResult,
            amountInMaximum: new BigNumber(result.amountInMaximum.toString()),
            amountOut: new BigNumber(result.amountOut.toString())
          }
          if (signature === UniswapV3SwapSignature.exactOutputSingle)
            swaps.push({
              ...commonResult,
              signature: signature,
              deadline: new BigNumber(result.deadline.toString())
            })
          else
            swaps.push({
              ...commonResult,
              signature: signature
            })
        }
      } else {
        const unparsedPathSplitted = (result.path as string).split('').reduce((acc, c) => {
          if (acc.length === 0) return [c]
          if (acc[acc.length - 1].length === 86) return [...acc, c]
          acc[acc.length - 1] += c
          return acc
        }, new Array<string>())
        const path: UniswapV3PathElement[] = await Promise.all(
          unparsedPathSplitted.map(async (path: string) => {
            const tokenAAddress = `0x${path.slice(0, 40)}`
            const fee = parseInt(path.slice(40, 46), 16)
            const tokenBAddress = `0x${path.slice(46, 86)}`
            const tokenAContract = new Contract(tokenAAddress, IERC20ABI, this.providerService)
            const tokenBContract = new Contract(tokenBAddress, IERC20ABI, this.providerService)
            const tokenASymbol = await tokenAContract.symbol()
            const tokenADecimals = await tokenAContract.decimals()
            const tokenBSymbol = await tokenBContract.symbol()
            const tokenBDecimals = await tokenBContract.decimals()
            return {
              tokenA: new Token(
                this.configService.get('network.chainId'),
                tokenAAddress,
                tokenADecimals,
                tokenASymbol
              ),
              tokenB: new Token(
                this.configService.get('network.chainId'),
                tokenBAddress,
                tokenBDecimals,
                tokenBSymbol
              ),
              fee
            }
          })
        )

        const baseResult = {
          // weird ts issue
          dex: DEX.UniswapV3 as DEX.UniswapV3,
          signature: signature,
          path,
          from: tx.from!,
          recipient: result.recipient,
          fee: result.fee,
          hash: tx.hash,
          sqrtPriceLimitX96: new BigNumber(result.sqrtPriceLimitX96.toString())
        }

        if (
          signature === UniswapV3SwapV3Signature.exactInput ||
          signature === UniswapV3SwapSignature.exactInput
        ) {
          const commonResult = {
            ...baseResult,
            amountIn: new BigNumber(result.amountIn.toString()),
            amountOutMinimum: new BigNumber(result.amountOutMinimum.toString())
          }
          if (signature === UniswapV3SwapSignature.exactInput)
            swaps.push({
              ...commonResult,
              signature,
              deadline: new BigNumber(result.deadline.toString())
            })
          else
            swaps.push({
              ...commonResult,
              signature
            })
        } else if (
          signature === UniswapV3SwapV3Signature.exactOutput ||
          signature === UniswapV3SwapSignature.exactOutput
        ) {
          const commonResult = {
            ...baseResult,
            amountInMaximum: new BigNumber(result.amountInMaximum.toString()),
            amountOut: new BigNumber(result.amountOut.toString())
          }
          if (signature === UniswapV3SwapSignature.exactOutput)
            swaps.push({
              ...commonResult,
              signature,
              deadline: new BigNumber(result.deadline.toString())
            })
          else swaps.push({ ...commonResult, signature: signature })
        }
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
