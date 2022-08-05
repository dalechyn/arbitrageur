import { IERC20ABI, SwapRouter02 } from '../abis'
import { ConfigService } from '../config'
import { BunyanLogger } from '../logger'
import { UniswapV3Signature } from '../mempool-uniswapv3'
import { ProviderService } from '../provider'

import { NoUniswapV2SwapsFoundError } from './errors'
import { UniswapV2SwapSignature, UniswapV2Swap, UniswapV2Signature } from './interfaces'
import { UniswapV3RouterV2SwapSignature } from './interfaces/UniswapV3RouterV2SwapSignature'

import { Token } from '@uniswap/sdk-core'
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router02.json'
import BigNumber from 'bignumber.js'
import { Contract, Transaction, utils } from 'ethers'
import { injectable } from 'inversify'

/**
 * Reconstructs and finds all UniswapV2 swaps in Tx's
 *
 * Uniswap V2 swaps can be found in two routers - SwapRouter02 (UniswapV3) and UniswapV2Router02 (UniswapV2)
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
   * Returns true if to is UniswapV2 or V3 router
   * @param to destination address
   */
  private isTxToUniswapV2OrV3(to?: string): boolean {
    return (
      to === this.configService.get('dexes.uniswapV2.routerAddress') ||
      to === this.configService.get('dexes.uniswapV3.routerAddress')
    )
  }

  /**
   * Returns an array of UniswapV2Swaps made in the transaction
   * @param tx Transaction data
   */
  async fromRawTx(tx: Transaction): Promise<UniswapV2Swap[]> {
    // split data by 32 bytes (64 hexadecimal symbols)
    const dataSplitBySlots = ('0'.repeat(56) + tx.data.slice(2)).split('').reduce((acc, el) => {
      if (acc.length === 0) {
        acc.push(el)
        return acc
      }
      if (acc[acc.length - 1].length === 64) return [...acc, el]
      acc[acc.length - 1] += el
      return acc
    }, new Array<string>())
    // unfortunately this could produce incorrect calldatas as amount or other value in slot could be the same as signature
    const callDatas = dataSplitBySlots.reduce((acc, el) => {
      const method = el.slice(56)

      if (
        // check if slot starts with v3 method that is useless for us
        Object.values(UniswapV3Signature).includes(method as UniswapV3Signature) ||
        // check if slot starts with v2 method that is useless for us
        Object.values(UniswapV2Signature).includes(method as UniswapV2Signature) ||
        // check if slot starts with v3 method which implements v2 swap
        Object.values(UniswapV3RouterV2SwapSignature).includes(
          method as UniswapV3RouterV2SwapSignature
        ) ||
        // check if slot starts with v2 swap
        Object.values(UniswapV2SwapSignature).includes(method as UniswapV2SwapSignature)
      ) {
        acc.push([el])
        return acc
      }
      acc[acc.length - 1].push(el)
      return acc
    }, new Array<string[]>())
    if (
      callDatas.length === 0 ||
      // if only one callData is parsed and the root signature is multicall signature, that means it was a multicall that triggered only v3 swap
      (callDatas.length === 1 &&
        [
          UniswapV3Signature.multicall_1,
          UniswapV3Signature.multicall_2,
          UniswapV3Signature.multicall_3
        ].includes(callDatas[0][0].slice(56) as UniswapV3Signature))
    )
      throw new NoUniswapV2SwapsFoundError(tx)

    const swaps: UniswapV2Swap[] = []
    for (const callData of callDatas) {
      // look only for swap calldatas, drop the rest
      const method = callData[0].slice(56)
      if (
        !Object.values(UniswapV3RouterV2SwapSignature).includes(
          method as UniswapV3RouterV2SwapSignature
        ) &&
        !Object.values(UniswapV2SwapSignature).includes(method as UniswapV2SwapSignature)
      )
        continue

      const iface = new utils.Interface(
        Object.values(UniswapV2SwapSignature).includes(method as UniswapV2SwapSignature)
          ? UniswapV2Router.abi
          : SwapRouter02
      )
      const result = iface.decodeFunctionData(`0x${method}`, '0x' + callData.join('').slice(56)) // cut off zeroes that we added at the beginning

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
      swaps.push({
        amountIn: new BigNumber(
          (
            result.amountIn ??
            result.amountInMax ??
            tx.value.mul(new BigNumber(10).pow(18).toString())
          ).toString()
        ),
        amountOut: new BigNumber((result.amountOut ?? result.amountOutMin).toString()),
        path,
        from: tx.from!,
        to: tx.to!, // replace to receipient
        method: method as UniswapV2SwapSignature,
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
        this.logger.debug(`MempoolUniswapV2Service: ${e.message}`)
      }
    })
  }
}
