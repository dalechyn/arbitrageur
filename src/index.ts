import 'module-alias/register'
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution
} from '@flashbots/ethers-provider-bundle'
import { Token } from '@uniswap/sdk-core'
import { Wallet } from 'ethers'
import { pino } from 'pino'

import { Fetcher } from './fetcher'
import { createEIP1559Transaction } from './transactions'
import { createProvider } from './utils'

import { Balancer } from '~balancer'
import { config } from '~config'

const logger = pino()

const baseToken = new Token(
  config.get('network.chainId'),
  config.get('baseToken.address'),
  config.get('baseToken.decimals'),
  config.get('baseToken.name')
)

const quoteToken = new Token(
  config.get('network.chainId'),
  config.get('quoteToken.address'),
  config.get('quoteToken.decimals'),
  config.get('quoteToken.name')
)

let skipToBlock: undefined | number

const authSigner = new Wallet(config.get('key'))
const ethProvider = createProvider(config.get('network.rpcUrl'), config.get('network.chainId'))
const main = async () => {
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    ethProvider,
    authSigner,
    ...(config.get('network.chainId') === 5 ? ['https://relay-goerli.flashbots.net'] : [])
  )

  ethProvider.on('block', async (blockNumber) => {
    logger.warn(`New block arrived: ${blockNumber}`)
    if (skipToBlock && skipToBlock <= blockNumber) {
      logger.warn(`Skipping block ${blockNumber}, waiting for ${skipToBlock}`)
      return
    }

    try {
      const fetcher = new Fetcher(config.get('dexes.first.type'), config.get('dexes.second.type'))
      const [firstPools, secondPools] = await fetcher.fetch(
        config.get('dexes.first.factoryAddress'),
        config.get('dexes.second.factoryAddress'),
        baseToken,
        quoteToken,
        ethProvider
      )

      const balancer = new Balancer(firstPools, secondPools, baseToken)
      const result = await balancer.getMostProfitableArbitrage()

      const targetBlock = blockNumber + config.get('network.blocksInFuture')
      const transaction = await createEIP1559Transaction(
        blockNumber,
        config.get('arbitrageur.address'),
        result.prepareCallData(targetBlock, baseToken.address),
        config.get('network.blocksInFuture'),
        config.get('network.chainId'),
        ethProvider
      )

      const signedTransactions = await flashbotsProvider.signBundle([
        {
          signer: authSigner,
          transaction
        }
      ])

      const simulation = await flashbotsProvider.simulate(signedTransactions, targetBlock)
      if ('error' in simulation) {
        logger.warn(`Simulation Error: ${simulation.error.message}`)
        process.exit(1)
      } else {
        logger.info(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`)
      }
      const bundleSubmission = await flashbotsProvider.sendRawBundle(
        signedTransactions,
        targetBlock
      )
      logger.info('Bundle submitted, waiting')
      if ('error' in bundleSubmission) {
        throw new Error(bundleSubmission.error.message)
      }
      const waitResponse = await bundleSubmission.wait()
      logger.info(`Wait Response: ${FlashbotsBundleResolution[waitResponse]}`)
      if (
        waitResponse === FlashbotsBundleResolution.BundleIncluded ||
        waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh
      ) {
        process.exit(0)
      } else {
        logger.info({
          bundleStats: await flashbotsProvider.getBundleStats(simulation.bundleHash, targetBlock),
          userStats: await flashbotsProvider.getUserStats()
        })
        skipToBlock = targetBlock
      }
    } catch (e) {
      logger.error(e)
    }
  })
}

main()
