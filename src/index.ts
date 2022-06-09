import 'module-alias/register'

import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution
} from '@flashbots/ethers-provider-bundle'
import { Token } from '@uniswap/sdk-core'
import { Wallet } from 'ethers'
import JSBI from 'jsbi'
import { pino } from 'pino'

import { Fetcher } from './fetcher'
import { createEIP1559Transaction } from './transactions'
import { createProvider } from './utils'

import { Balancer } from '~balancer'
import { config } from '~config'

const logger = pino()

const chainId = config.get('network.chainId')

const baseToken = new Token(
  chainId,
  config.get('baseToken.address'),
  config.get('baseToken.decimals'),
  config.get('baseToken.name')
)

const quoteToken = new Token(
  chainId,
  config.get('quoteToken.address'),
  config.get('quoteToken.decimals'),
  config.get('quoteToken.name')
)

const authSigner = new Wallet(config.get('key'))
const ethProvider = createProvider(config.get('network.rpcUrl'), config.get('network.chainId'))
const main = async () => {
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    ethProvider,
    authSigner,
    ...(chainId === 5 ? ['https://relay-goerli.flashbots.net'] : [])
  )

  let blockSkipTo: number | undefined

  ethProvider.on('block', async (blockNumber: number) => {
    logger.warn(`New block arrived: ${blockNumber}`)
    if (blockSkipTo ?? blockNumber - 1 > blockNumber) {
      logger.warn(`Block skipped, waiting for ${blockSkipTo}`)
      return
    }

    try {
      const fetcher = new Fetcher(config.get('dexes.first.type'), config.get('dexes.second.type'))
      const [firstPools, secondPools] = await fetcher.fetch(
        config.get('dexes.first.poolAddress'),
        config.get('dexes.second.poolAddress'),
        baseToken,
        quoteToken,
        ethProvider
      )

      const balancer = new Balancer(firstPools, secondPools, baseToken)
      const result = await balancer.getMostProfitableArbitrage()

      const targetBlock = blockNumber + config.get('network.blocksInFuture')
      blockSkipTo = targetBlock
      logger.info('Will skip all blocks till ' + blockSkipTo)
      const transaction = await createEIP1559Transaction(
        blockNumber,
        config.get('arbitrageur.address'),
        result.prepareCallData(targetBlock, baseToken.address),
        config.get('network.blocksInFuture'),
        chainId,
        JSBI.divide(result.profit, JSBI.BigInt(2)),
        ethProvider
      )

      const signedTransactions = await flashbotsProvider.signBundle([
        {
          signer: authSigner,
          transaction
        }
      ])

      // Simulation takes too long
      /* const simulation = await flashbotsProvider.simulate(signedTransactions, targetBlock)
      if ('error' in simulation) {
        logger.warn(`Simulation Error: ${simulation.error.message}`)
        process.exit(1)
      } else {
        logger.info(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`)
      } */
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
        /*   logger.info({
          bundleStats:
            chainId === 5
              ? {} // flashbots_getBundleStats RPC method not supported on goerli
              : await flashbotsProvider.getBundleStats(simulation.bundleHash, targetBlock),
          userStats:
            chainId === 5
              ? {} // flashbots_getUserStats RPC method not supported on goerli
              : await flashbotsProvider.getUserStats()
        }) */
      }
    } catch (e) {
      logger.error(e)
    }
  })
}

main()
