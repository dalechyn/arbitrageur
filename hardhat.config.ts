import 'hardhat-deploy'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'dotenv/config'

import { HardhatUserConfig } from 'hardhat/config'

if (process.env.HARDHAT_FORK) {
  process.env.HARDHAT_DEPLOY_FORK = process.env.HARDHAT_FORK
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000
          }
        }
      },
      {
        version: '0.8.14',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000
          }
        }
      }
    ]
  },
  namedAccounts: {
    deployer: 0
  },
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: 'https://eth-goerli.alchemyapi.io/v2/oKG7sMevlL_ZQgGcZCOTEsaksS_nM922'
      }
    },
    goerli: {
      url: 'https://eth-goerli.alchemyapi.io/v2/oKG7sMevlL_ZQgGcZCOTEsaksS_nM922',
      accounts: [process.env.KEY as string]
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: '95T5DKJXV3DWIRNCD56FXVMJ8VM1W8J4AE'
  }
}

export default config
