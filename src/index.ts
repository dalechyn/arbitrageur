import 'module-alias/register'
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution
} from '@flashbots/ethers-provider-bundle'

import { BLOCKS_IN_THE_FUTURE, CHAIN_ID } from './constants'
import { getProfitableOpportunities } from './fetcher'
import { createEIP1559Transaction } from './transactions'
import { ethProvider } from './utils'
import { authSigner } from './wallet'

// Standard json rpc provider directly from ethers.js (NOT Flashbots)

// `authSigner` is an Ethereum private key that does NOT store funds and is NOT your bot's primary key.
// This is an identifying key for signing payloads to establish reputation and whitelisting
// In production, this should be used across multiple bundles to build relationship. In this example, we generate a new wallet each time

// Flashbots provider requires passing in a standard provider
const main = async () => {
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    ethProvider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    authSigner, // ethers.js signer wallet, only for signing request payloads, not transactions
    ...(CHAIN_ID === 5 ? ['https://relay-goerli.flashbots.net'] : [])
  )

  ethProvider.on('block', async (blockNumber) => {
    try {
      const results = await getProfitableOpportunities(blockNumber)

      const transactions = await Promise.all(
        results.map((r) =>
          createEIP1559Transaction(
            blockNumber,
            '0x5de9D29410Ac8fd1B5043671f89C8022c55CD4c8',
            r.prepareCallData(blockNumber + BLOCKS_IN_THE_FUTURE)
          )
        )
      )

      const signedTransactions = await flashbotsProvider.signBundle(
        transactions.map((transaction) => ({
          signer: authSigner,
          transaction
        }))
      )

      const targetBlock = blockNumber + BLOCKS_IN_THE_FUTURE
      const simulation = await flashbotsProvider.simulate(signedTransactions, targetBlock)
      if ('error' in simulation) {
        console.warn(`Simulation Error: ${simulation.error.message}`)
        process.exit(1)
      } else {
        console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`)
      }
      const bundleSubmission = await flashbotsProvider.sendRawBundle(
        signedTransactions,
        targetBlock
      )
      console.log('bundle submitted, waiting')
      if ('error' in bundleSubmission) {
        throw new Error(bundleSubmission.error.message)
      }
      const waitResponse = await bundleSubmission.wait()
      console.log(`Wait Response: ${FlashbotsBundleResolution[waitResponse]}`)
      if (
        waitResponse === FlashbotsBundleResolution.BundleIncluded ||
        waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh
      ) {
        process.exit(0)
      } else {
        console.log({
          bundleStats: await flashbotsProvider.getBundleStats(simulation.bundleHash, targetBlock),
          userStats: await flashbotsProvider.getUserStats()
        })
      }
    } catch (e) {
      console.error(e)
    }
  })
}

main()
