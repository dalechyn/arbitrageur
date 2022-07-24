import 'module-alias/register'

import cluster from 'cluster'
import os from 'os'

import { FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle'
import { Token } from '@uniswap/sdk-core'
import { BigNumber, Wallet } from 'ethers'
import express from 'express'
import JSBI from 'jsbi'
import fetch from 'node-fetch'
import { pino } from 'pino'

import { Fetcher } from './fetcher'
import { createEIP1559Transaction } from './transactions'
import { createProvider, FlashbotsBundleMultiProvider, PoolDoesNotExistsError } from './utils'

import { Balancer } from '~balancer'
import { config } from '~config'
import { ArbitrageInfo } from '~interfaces'

const logger = pino()

const chainId = config.get('network.chainId')

const authSigner = new Wallet(config.get('key'))
const ethProvider = createProvider(
  config.get('network.rpcOrIpcUrl'),
  config.get('network.chainId'),
  config.get('network.isIPC')
)
const main = async () => {
  const totalCPUs = os.cpus().length

  const flashbotsProvider = await FlashbotsBundleMultiProvider.createMulti(
    ethProvider,
    authSigner,
    config.get('network.rpcOrIpcUrl'),
    ...(chainId === 5
      ? ['https://relay-goerli.flashbots.net']
      : ['https://mev-relay.ethermine.org'])
  )
  if (cluster.isPrimary) {
    logger.info(`Number of CPUs is ${totalCPUs}`)
    logger.info(`Master ${process.pid} is running`)

    // Fork workers.
    for (let i = 0; i < totalCPUs; i++) {
      cluster.fork()
    }

    cluster.on('exit', (worker) => {
      logger.warn(`Worker ${worker.process.pid} died`)
    })

    cluster.on('message', (_, message) => {
      for (const id in cluster.workers) {
        cluster.workers[id]?.send(message)
      }
    })
  } else {
    const arbitrageInfo: { arbs: ArbitrageInfo[] } = { arbs: [] }
    cluster.worker?.on('message', (message) => {
      console.log('hey', message)
      if (message === 'flush') {
        logger.info('Received /flush command from worker')
        arbitrageInfo.arbs = []
      }
    })

    ethProvider.on('block', async (blockNumber: number) => {
      // logger.info(await flashbotsProvider.fetchBlocksApi(14949852))
      logger.warn(`New block arrived: ${blockNumber}`)
      logger.warn(`Worker ${process.pid} will check ${arbitrageInfo.arbs.length} opportunities`)
      Promise.all(
        arbitrageInfo.arbs.map(async (info) => {
          const asyncLogger = pino({
            name: `Worker ${process.pid}`,
            ...pino.destination({ sync: false })
          })
          if ((info.skip ?? blockNumber - 1) > blockNumber) {
            asyncLogger.warn(`Block skipped, waiting for ${info.skip}`)
            asyncLogger.flush()
            return
          }

          try {
            const fetcher = new Fetcher(asyncLogger, info.typeA, info.typeB)
            const [firstPools, secondPools] = await fetcher.fetch(
              info.poolA,
              info.poolB,
              info.baseToken,
              info.quoteToken,
              ethProvider
            )

            const balancer = new Balancer(asyncLogger, firstPools, secondPools, info.baseToken)
            const result = await balancer.getMostProfitableArbitrage()

            const targetBlock = blockNumber + config.get('network.blocksInFuture')

            const minerReward = JSBI.divide(result.profit, JSBI.BigInt(2))
            const transaction = await createEIP1559Transaction(
              blockNumber,
              config.get('arbitrageur.address'),
              result.prepareCallData(targetBlock, info.baseToken.address),
              config.get('network.blocksInFuture'),
              chainId,
              ethProvider
            )

            const preSignedTransactions = await flashbotsProvider.signBundle([
              {
                signer: authSigner,
                transaction
              }
            ])

            const simulation = await flashbotsProvider.simulate(preSignedTransactions, targetBlock)
            if ('error' in simulation) {
              asyncLogger.warn(`Simulation Error: ${simulation.error.message}`)
              asyncLogger.flush()
              return
            } else {
              if (simulation.firstRevert) {
                asyncLogger.warn(
                  `Simulation Reverted: ${JSON.stringify(simulation.firstRevert, null, 2)}`
                )
                asyncLogger.flush()
                return
              }
              asyncLogger.info(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`)
            }

            const minerTipPerGas = BigNumber.from(minerReward.toString()).div(
              simulation.totalGasUsed
            )
            /// ////
            const signedTransactions = await flashbotsProvider.signBundle([
              {
                signer: authSigner,
                transaction: {
                  ...transaction,
                  maxPriorityFeePerGas: minerTipPerGas
                }
              }
            ])
            const gasPrice = await ethProvider.getGasPrice()
            if (
              gasPrice
                .mul(simulation.totalGasUsed)
                .gt(BigNumber.from(result.profit.toString()).sub(minerReward.toString()))
            ) {
              asyncLogger.warn(
                'The transaction was dropped because the net profit is less than total gas fee'
              )
              asyncLogger.flush()
              return
            }

            info.skip = targetBlock
            asyncLogger.info('Will skip all blocks till ' + info.skip)

            const bundleSubmission = await flashbotsProvider.sendRawBundle(
              signedTransactions,
              targetBlock
            )
            asyncLogger.info('Bundle submitted, waiting')
            if ('error' in bundleSubmission) {
              throw new Error(bundleSubmission.error.message)
            }
            asyncLogger.info(bundleSubmission.bundleHash)
            const waitResponse = await bundleSubmission.wait()
            asyncLogger.info(`Wait Response: ${FlashbotsBundleResolution[waitResponse]}`)
            if (
              waitResponse === FlashbotsBundleResolution.BundleIncluded ||
              waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh
            ) {
              fetch(
                `https://api.telegram.org/bot5587264607:AAHvE_VslrYPCyqTuLlX7V0njem_wDBfHGQ/sendMessage?chat_id=316849379&text=BundleIncluded`
              )
            } else {
              logger.info({
                bundleStats:
                  chainId === 5
                    ? {} // flashbots_getBundleStats RPC method not supported on goerli
                    : await flashbotsProvider.getBundleStats(simulation.bundleHash, targetBlock),
                userStats:
                  chainId === 5
                    ? {} // flashbots_getUserStats RPC method not supported on goerli
                    : await flashbotsProvider.getUserStats()
              })
            }
          } catch (e: any) {
            if (e instanceof PoolDoesNotExistsError) {
              arbitrageInfo.arbs = arbitrageInfo.arbs.filter(
                (i) => i.poolA !== e.pool && i.poolB !== e.pool
              )
            }
            asyncLogger.error(e.message)
          } finally {
            asyncLogger.flush()
          }
        })
      )
    })

    const app = express()

    app.use(express.json())

    /**
     * POST - /add-info
     * Adds new Arbitrage info for polling, being catched randomly by one of workers
     *
     * {
     *   poolA: string
     *   typeA: number
     *   poolB: string
     *   typeB: number
     *   baseToken: {
     *     address: string
     *     decimals: number
     *     symbol: string
     *   quoteToken: {
     *     address: string
     *     decimals: number
     *     symbol: string
     *   }
     * }
     */
    app.post('/add-info', (req, res) => {
      const info = req.body

      arbitrageInfo.arbs = [
        ...arbitrageInfo.arbs,
        {
          poolA: info.poolA,
          typeA: info.typeA,
          poolB: info.poolB,
          typeB: info.typeB,
          baseToken: new Token(
            config.get('network.chainId'),
            info.baseToken.address,
            info.baseToken.decimals,
            info.baseToken.symbol
          ),
          quoteToken: new Token(
            config.get('network.chainId'),
            info.quoteToken.address,
            info.quoteToken.decimals,
            info.quoteToken.symbol
          )
        }
      ]
      res.sendStatus(201)
    })
    app.get('/flush', (_, res) => {
      arbitrageInfo.arbs = []
      logger.info('Received /flush command')
      cluster.worker?.send('flush')

      res.sendStatus(200)
    })
    app.listen(config.get('port'), () => {
      logger.info(`Express PID ${process.pid} started listening`)
    })
  }
}

main()
