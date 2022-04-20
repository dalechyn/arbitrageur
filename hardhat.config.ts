/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import 'hardhat-deploy'
import '@nomiclabs/hardhat-ethers'

import { HardhatUserConfig } from 'hardhat/config'

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.9',
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
    goerli: {
      url: 'https://eth-goerli.alchemyapi.io/v2/oKG7sMevlL_ZQgGcZCOTEsaksS_nM922',
      accounts: [process.env.KEY]
    }
  }
}

export default config
