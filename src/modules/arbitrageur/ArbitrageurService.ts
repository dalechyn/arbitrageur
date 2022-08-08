// import { BalancerService } from '../balancer'
// import { ClusterService } from '../cluster'
// import { ConfigService } from '../config'
// import { FetcherService } from '../fetcher'

import { Token } from '@uniswap/sdk-core'
import { injectable } from 'inversify'

import { BalanceResult, BalancerService } from '../balancer'
import { DEX, PoolV2WithContract, PoolV3WithContract, PoolWithContract } from '../common'
import { ConfigService } from '../config'
import { FetcherService } from '../fetcher'
import { BunyanLogger } from '../logger'
// import { ProviderService } from '../provider'
// import { ProviderFlashbotsService } from '../provider-flashbots'
// import { TransactionService } from '../transaction'
// import { FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle'
// import { BigNumber, Wallet } from 'ethers'
import { MempoolUniswapV2Service } from '../mempool-uniswapv2'
import { UniswapV3SwapSignature, UniswapV3SwapV3Signature } from '../mempool-uniswapv3'
import { MempoolUniswapV3Service } from '../mempool-uniswapv3/MempoolUniswapV3Service'

// import fetch from 'node-fetch'

type NodeWithNeighbours = { node: PoolWithContract; neighbours: PoolWithContract[] }

@injectable()
export class ArbitrageurService {
  private readonly rewardToken: Token
  constructor(
    private readonly logger: BunyanLogger,
    private readonly configService: ConfigService,
    private readonly fetcherService: FetcherService,
    private readonly balancerService: BalancerService,
    // private readonly ethProvider: ProviderService, // private readonly clusterService: ClusterService, // private readonly fetcherService: FetcherService, // private readonly balancerService: BalancerService, // private readonly transactionService: TransactionService, // private readonly providerFlashbotsService: ProviderFlashbotsService,
    private readonly mempoolUniswapV2Service: MempoolUniswapV2Service,
    private readonly mempoolUniswapV3Service: MempoolUniswapV3Service
  ) {
    this.rewardToken = new Token(
      this.configService.get('network.chainId'),
      this.configService.get('rewardToken.address'),
      this.configService.get('rewardToken.decimals'),
      this.configService.get('rewardToken.symbol')
    )
  }

  private async getPoolsWithNeighboursFromPoolsInTx(
    pools: PoolWithContract[]
  ): Promise<NodeWithNeighbours[]> {
    // here we need to find so called "neighbours" - pools with the same tokens on other dexes
    const neighbourPoolsUntilftered: NodeWithNeighbours[] = []

    for (const pool of pools)
      neighbourPoolsUntilftered.push({
        node: pool,
        neighbours: await this.fetcherService.fetchNeihgbours(pool.token0, pool.token1, pool.dex)
      })

    return neighbourPoolsUntilftered.reduce(
      (acc, { node: pool, neighbours: neighbourPoolsSet }) => {
        if (
          acc.find(
            ({ node: uniquePool, neighbours: uniquePoolNeighbours }) =>
              uniquePool.contract.address === pool.contract.address ||
              uniquePoolNeighbours.find(
                (uniquePoolNeighbour) =>
                  uniquePoolNeighbour.contract.address === pool.contract.address
              )
          )
        )
          return acc

        return [...acc, { node: pool, neighbours: neighbourPoolsSet }]
      },
      new Array<NodeWithNeighbours>()
    )
  }

  run(): void {
    this.mempoolUniswapV2Service.onUniswapV2PendingTransaction(async (swaps) => {
      // loop all swaps in tx
      for (const swap of swaps) {
        // loop through all pools in the path as they all change and can create an arbitrage opportunity
        const pools = new Array<PoolV2WithContract>()
        for (let i = 1; i < swap.path.length; i++) {
          const tokenPrev = swap.path[i - 1]
          const token = swap.path[i]

          // we don't want to look for swaps of tokens we are not interested in
          if (!tokenPrev.equals(this.rewardToken) && !token.equals(this.rewardToken)) return pools
          console.log(swap.dex)
          pools.push(
            await this.fetcherService.fetchUniswapV2(
              this.rewardToken,
              token.equals(this.rewardToken) ? tokenPrev : token,
              swap.dex,
              ...(swap.dex === DEX.UniswapV2
                ? []
                : [
                    this.configService.get(`dexes.${swap.dex}.factoryAddress`),
                    this.configService.get(`dexes.${swap.dex}.pairCodeHash`)
                  ])
            )
          )
        }
        const poolsWithNeighbours = await this.getPoolsWithNeighboursFromPoolsInTx(pools)

        this.logger.debug('NEIGHBOURS:', poolsWithNeighbours)

        // Run the balancer on the pool and it's neighbours
        const balanceResults: BalanceResult[] = []
        for (const { node: pool, neighbours } of poolsWithNeighbours) {
          for (const neighbourNode of neighbours) {
            try {
              balanceResults.push(
                await this.balancerService.balance(pool, neighbourNode, this.rewardToken)
              )
            } catch (e) {}
          }
        }
        this.logger.debug(
          'BalanceResults:',
          balanceResults.map((b) => ({
            ...b,
            profit: b.profit.toSignificant(6),
            amountIn: b.amountIn.toSignificant(6)
          }))
        )
      }
    })
    this.mempoolUniswapV3Service.onUniswapV3PendingTransaction(async (swaps) => {
      // loop all swaps in tx
      for (const swap of swaps) {
        // loop through all pools in the path as they all change and can create an arbitrage opportunity
        const pools = new Array<PoolV3WithContract>()
        if (
          swap.method === UniswapV3SwapV3Signature.exactInput ||
          swap.method === UniswapV3SwapSignature.exactInput ||
          swap.method === UniswapV3SwapV3Signature.exactOutput ||
          swap.method === UniswapV3SwapSignature.exactOutput
        )
          for (const { tokenA, tokenB, fee } of swap.path) {
            // we don't want to look for swaps of tokens we are not interested in
            if (!tokenA.equals(this.rewardToken) && !tokenB.equals(this.rewardToken)) return pools
            pools.push(
              await this.fetcherService.fetchUniswapV3(
                this.rewardToken,
                tokenA.equals(this.rewardToken) ? tokenB : tokenA,
                fee,
                swap.dex
              )
            )
          }
        else {
          pools.push(
            await this.fetcherService.fetchUniswapV3(
              this.rewardToken,
              swap.tokenIn.equals(this.rewardToken) ? swap.tokenOut : swap.tokenIn,
              swap.fee,
              swap.dex
            )
          )
        }
        const poolsWithNeighbours = await this.getPoolsWithNeighboursFromPoolsInTx(pools)
        this.logger.debug('NEIGHBOURS:', poolsWithNeighbours)

        // TODO: DROP duplicates

        this.logger.info(swaps)

        // Run the balancer on the pool and it's neighbours
        const balanceResults: BalanceResult[] = []
        for (const { node: pool, neighbours } of poolsWithNeighbours) {
          for (const neighbourNode of neighbours) {
            try {
              balanceResults.push(
                await this.balancerService.balance(pool, neighbourNode, this.rewardToken)
              )
            } catch (e) {}
          }
        }
        this.logger.debug(
          'BalanceResults:',
          balanceResults.map((b) => ({
            ...b,
            profit: b.profit.toSignificant(6),
            amountIn: b.amountIn.toSignificant(6)
          }))
        )
      }
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
