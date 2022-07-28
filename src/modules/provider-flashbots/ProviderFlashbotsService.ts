import { ConfigService } from '../config'
import { ProviderService } from '../provider'

import { BlockTag, Networkish } from '@ethersproject/providers'
import { ConnectionInfo } from '@ethersproject/web'
import {
  FlashbotsBundleProvider,
  SimulationResponse,
  TransactionSimulation,
  DEFAULT_FLASHBOTS_RELAY,
  GetBundleStatsResponse,
  GetUserStatsResponse
} from '@flashbots/ethers-provider-bundle'
import { BigNumber, Wallet } from 'ethers'
import { id, fetchJson } from 'ethers/lib/utils'
import { decorate, injectable } from 'inversify'

decorate(injectable(), FlashbotsBundleProvider)

@injectable()
export class ProviderFlashbotsService extends FlashbotsBundleProvider {
  constructor(configService: ConfigService, private readonly providerService: ProviderService) {
    const chainId = configService.get('network.chainId')

    const connectionInfo: ConnectionInfo = {
      url: configService.get('mevRelay') || DEFAULT_FLASHBOTS_RELAY
    }

    if (connectionInfo.headers === undefined) connectionInfo.headers = {}
    connectionInfo.throttleCallback = FlashbotsBundleProvider.throttleCallback
    const networkish: Networkish = {
      chainId,
      name: ''
    }

    super(providerService, new Wallet(configService.get('key')), connectionInfo, networkish)
  }

  public async getUserStats(): Promise<GetUserStatsResponse> {
    const blockDetails = await this.genericProvider.getBlock('latest')
    const evmBlockNumber = `0x${blockDetails.number.toString(16)}`

    const params = [evmBlockNumber]
    const request = JSON.stringify(this.prepareBundleRequest('flashbots_getUserStats', params))
    const response = await this.requestFlashbots(request)
    if (response.error !== undefined && response.error !== null) {
      return {
        error: {
          message: response.error.message,
          code: response.error.code
        }
      }
    }

    return response.result
  }

  public async getBundleStats(
    bundleHash: string,
    blockNumber: number
  ): Promise<GetBundleStatsResponse> {
    const evmBlockNumber = `0x${blockNumber.toString(16)}`

    const params = [{ bundleHash, blockNumber: evmBlockNumber }]
    const request = JSON.stringify(this.prepareBundleRequest('flashbots_getBundleStats', params))
    const response = await this.requestFlashbots(request)
    if (response.error !== undefined && response.error !== null) {
      return {
        error: {
          message: response.error.message,
          code: response.error.code
        }
      }
    }

    return response.result
  }

  public async simulate(
    signedBundledTransactions: string[],
    blockTag: BlockTag,
    stateBlockTag?: BlockTag,
    blockTimestamp?: number
  ): Promise<SimulationResponse> {
    let evmBlockNumber: string
    if (typeof blockTag === 'number') {
      evmBlockNumber = `0x${blockTag.toString(16)}`
    } else {
      const blockTagDetails = await this.genericProvider.getBlock(blockTag)
      const blockDetails =
        blockTagDetails !== null ? blockTagDetails : await this.genericProvider.getBlock('latest')
      evmBlockNumber = `0x${blockDetails.number.toString(16)}`
    }

    let evmBlockStateNumber: string
    if (typeof stateBlockTag === 'number') {
      evmBlockStateNumber = `0x${stateBlockTag.toString(16)}`
    } else if (!stateBlockTag) {
      evmBlockStateNumber = 'latest'
    } else {
      evmBlockStateNumber = stateBlockTag
    }

    const params: any = [
      {
        txs: signedBundledTransactions,
        blockNumber: evmBlockNumber,
        stateBlockNumber: evmBlockStateNumber,
        timestamp: blockTimestamp
      }
    ]
    const request = JSON.stringify(this.prepareBundleRequest('eth_callBundle', params))
    const response = await this.requestFlashbots(request)
    if (response.error !== undefined && response.error !== null) {
      return {
        error: {
          message: response.error.message,
          code: response.error.code
        }
      }
    }

    const callResult = response.result
    return {
      bundleHash: callResult.bundleHash,
      coinbaseDiff: BigNumber.from(callResult.coinbaseDiff),
      results: callResult.results,
      totalGasUsed: callResult.results.reduce(
        (a: number, b: TransactionSimulation) => a + b.gasUsed,
        0
      ),
      firstRevert: callResult.results.find(
        (txSim: TransactionSimulation) => 'revert' in txSim || 'error' in txSim
      )
    }
  }

  private async requestFlashbots(request: string) {
    const connectionInfo: ConnectionInfo = { url: this.providerService.connection.url }
    connectionInfo.headers = {
      'X-Flashbots-Signature': `${await this.authSigner.getAddress()}:${await this.authSigner.signMessage(
        id(request)
      )}`,
      ...this.connectionInfo.headers
    }
    return fetchJson(connectionInfo, request)
  }
}
