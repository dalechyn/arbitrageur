// import { BalancerService } from '../balancer'
// import { ClusterService } from '../cluster'
// import { ConfigService } from '../config'
// import { FetcherService } from '../fetcher'

import { BunyanLogger } from '../logger'
// import { ProviderService } from '../provider'
// import { ProviderFlashbotsService } from '../provider-flashbots'
// import { TransactionService } from '../transaction'
// import { FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle'
// import { BigNumber, Wallet } from 'ethers'
import { MempoolUniswapV2Service } from '../mempool-uniswapv2'

import { injectable } from 'inversify'
// import fetch from 'node-fetch'

@injectable()
export class ArbitrageurService {
  constructor(
    private readonly logger: BunyanLogger,
    // private readonly configService: ConfigService,
    // private readonly ethProvider: ProviderService, // private readonly clusterService: ClusterService, // private readonly fetcherService: FetcherService, // private readonly balancerService: BalancerService, // private readonly transactionService: TransactionService, // private readonly providerFlashbotsService: ProviderFlashbotsService,
    private readonly mempoolUniswapV2Service: MempoolUniswapV2Service
  ) {}

  run(): void {
    this.mempoolUniswapV2Service.onUniswapV2PendingTransaction((swaps) => {
      this.logger.info(
        swaps.map((v) => ({
          amountIn: v.amountIn.toString(),
          amountOut: v.amountOut.toString(),
          path: v.path.map((p) => p.address),
          deadline: v.deadline.toString(),
          method: v.method
        }))
      )
    })
    // this.ethProvider.on('block', async (blockNumber: number) => {
    //   // logger.info(await flashbotsProvider.fetchBlocksApi(14949852))
    //   this.logger.warn(`New block arrived: ${blockNumber}`)
    //   const opportunities = this.clusterService.getOpportunities()
    //   this.logger.warn(`Worker ${process.pid} will check ${opportunities.length} opportunities`)
    //   Promise.all(
    //     opportunities.map(async (info) => {
    //       if ((info.skip ?? blockNumber - 1) > blockNumber) {
    //         this.logger.warn(`Block skipped, waiting for ${info.skip}`)
    //         return
    //       }

    //       try {
    //         const [firstPools, secondPools] = await this.fetcherService.fetch(
    //           info.poolA,
    //           info.poolB,
    //           info.typeA,
    //           info.typeB,
    //           info.baseToken,
    //           info.quoteToken
    //         )

    //         const result = await this.balancerService.balance(
    //           firstPools,
    //           secondPools,
    //           info.baseToken
    //         )

    //         const targetBlock = blockNumber + this.configService.get('network.blocksInFuture')

    //         const minerReward = result.profit.divide(2)
    //         const chainId = this.configService.get('network.chainId')
    //         const transaction = await this.transactionService.createArbitrageTransaction(
    //           blockNumber,
    //           this.configService.get('arbitrageur.address'),
    //           result,
    //           this.configService.get('network.blocksInFuture'),
    //           chainId
    //         )

    //         const authSigner = new Wallet(this.configService.get('key') as unknown as string)
    //         const preSignedTransactions = await this.providerFlashbotsService.signBundle([
    //           {
    //             signer: authSigner,
    //             transaction
    //           }
    //         ])

    //         const simulation = await this.providerFlashbotsService.simulate(
    //           preSignedTransactions,
    //           targetBlock
    //         )
    //         if ('error' in simulation) {
    //           this.logger.warn(`Simulation Error: ${simulation.error.message}`)
    //           return
    //         } else {
    //           if (simulation.firstRevert) {
    //             this.logger.warn(
    //               `Simulation Reverted: ${JSON.stringify(simulation.firstRevert, null, 2)}`
    //             )
    //             return
    //           }
    //           this.logger.info(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`)
    //         }

    //         const minerTipPerGas = BigNumber.from(minerReward.toString()).div(
    //           simulation.totalGasUsed
    //         )
    //         /// ////
    //         const signedTransactions = await this.providerFlashbotsService.signBundle([
    //           {
    //             signer: authSigner,
    //             transaction: {
    //               ...transaction,
    //               maxPriorityFeePerGas: minerTipPerGas
    //             }
    //           }
    //         ])
    //         /* const gasPrice = await this.ethProvider.getGasPrice()
    //         if (
    //           gasPrice
    //             .mul(simulation.totalGasUsed)
    //             .gt(BigNumber.from(result.profit.toString()).sub(minerReward.toString()))
    //         ) {
    //           this.logger.warn(
    //             'The transaction was dropped because the net profit is less than total gas fee'
    //           )
    //           return
    //         } */

    //         info.skip = targetBlock
    //         this.logger.info('Will skip all blocks till ' + info.skip)

    //         const bundleSubmission = await this.providerFlashbotsService.sendRawBundle(
    //           signedTransactions,
    //           targetBlock
    //         )
    //         this.logger.info('Bundle submitted, waiting')
    //         if ('error' in bundleSubmission) {
    //           throw new Error(bundleSubmission.error.message)
    //         }
    //         this.logger.info(bundleSubmission.bundleHash)
    //         const waitResponse = await bundleSubmission.wait()
    //         this.logger.info(`Wait Response: ${FlashbotsBundleResolution[waitResponse]}`)
    //         if (
    //           waitResponse === FlashbotsBundleResolution.BundleIncluded ||
    //           waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh
    //         ) {
    //           fetch(
    //             `https://api.telegram.org/bot5587264607:AAHvE_VslrYPCyqTuLlX7V0njem_wDBfHGQ/sendMessage?chat_id=316849379&text=BundleIncluded`
    //           )
    //         } else {
    //           this.logger.info({
    //             bundleStats:
    //               chainId === 5
    //                 ? {} // flashbots_getBundleStats RPC method not supported on goerli
    //                 : await this.providerFlashbotsService.getBundleStats(
    //                     simulation.bundleHash,
    //                     targetBlock
    //                   ),
    //             userStats:
    //               chainId === 5
    //                 ? {} // flashbots_getUserStats RPC method not supported on goerli
    //                 : await this.providerFlashbotsService.getUserStats()
    //           })
    //         }
    //       } catch (e: any) {
    //         this.logger.error(e)
    //       }
    //     })
    //   )
    // })
  }
}
