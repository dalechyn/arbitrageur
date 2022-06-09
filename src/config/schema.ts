import { validate } from 'multicoin-address-validator'

const formatEth = (address: string) => {
  const result = validate(address, '0x')
  if (!result) throw new Error('ETH address is incorrect')
}

export default {
  baseToken: {
    address: {
      doc: 'Address of the base token',
      format: formatEth,
      default: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
      env: 'BASE_TOKEN_ADDRESS'
    },
    decimals: {
      doc: 'Decimals of the base token',
      format: 'nat',
      default: 18,
      env: 'BASE_TOKEN_DECIMALS'
    },
    name: {
      doc: 'Name of the base token',
      format: String,
      default: 'WETH',
      env: 'BASE_TOKEN_NAME'
    }
  },
  quoteToken: {
    address: {
      doc: 'Address of the quote token',
      format: formatEth,
      default: '0xd87ba7a50b2e7e660f678a895e4b72e7cb4ccd9c',
      env: 'QUOTE_TOKEN_ADDRESS'
    },
    decimals: {
      doc: 'Decimals of the quote token',
      format: 'nat',
      default: 6,
      env: 'QUOTE_TOKEN_DECIMALS'
    },
    name: {
      doc: 'Name of the quote token',
      format: String,
      default: 'USDC',
      env: 'QUOTE_TOKEN_NAME'
    }
  },
  network: {
    chainId: {
      doc: 'Network Chain ID',
      format: 'nat',
      default: 5,
      env: 'NETWORK_CHAIN_ID'
    },
    rpcUrl: {
      doc: 'Network RPC URL',
      format: String,
      default: 'https://eth-goerli.alchemyapi.io/v2/oKG7sMevlL_ZQgGcZCOTEsaksS_nM922',
      env: 'NETWORK_RPC_URL'
    },
    blocksInFuture: {
      doc: 'Blocks in future to target',
      format: 'nat',
      default: 1,
      env: 'NETWORK_BLOCKS_IN_FUTURE'
    }
  },
  multiCallTickerLensAddress: {
    doc: 'MultiCall TickerLens Address',
    format: String,
    default: '0xACb6b805f86D68900e3C5eabe871eAe8687E4a16',
    env: 'MULTICALL_TICKERLENS_ADDRESS'
  },
  dexes: {
    first: {
      type: {
        doc: 'First DEX Type',
        format: 'nat',
        default: 0, // UniswapV3
        env: 'DEX_FIRST_TYPE'
      },
      factoryAddress: {
        doc: 'First DEX Factory Address',
        format: formatEth,
        default: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        env: 'DEX_FIRST_FACTORY_ADDRESS'
      },
      fee: {
        numerator: {
          doc: 'Fee Numerator (fill with non-zero if DEX Type is UniswapV2',
          format: 'nat',
          default: 0,
          env: 'DEX_FIRST_FEE_NUMERATOR'
        },
        denominator: {
          doc: 'Fee Denominator (fill with non-zero if DEX Type is UniswapV2',
          format: 'nat',
          default: 0,
          env: 'DEX_FIRST_FEE_DENOMINATOR'
        }
      }
    },
    second: {
      type: {
        doc: 'Second DEX Type',
        format: 'nat',
        default: 1, // UniswapV2
        env: 'DEX_SECOND_TYPE'
      },
      factoryAddress: {
        doc: 'Second DEX Factory Address',
        format: formatEth,
        default: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
        env: 'DEX_SECOND_FACTORY_ADDRESS'
      },
      fee: {
        numerator: {
          doc: 'Fee Numerator (fill with non-zero if DEX Type is UniswapV2',
          format: 'nat',
          default: 997,
          env: 'DEX_SECOND_FEE_NUMERATOR'
        },
        denominator: {
          doc: 'Fee Denominator (fill with non-zero if DEX Type is UniswapV2',
          format: 'nat',
          default: 1000,
          env: 'DEX_SECOND_FEE_DENOMINATOR'
        }
      }
    }
  },
  arbitrageur: {
    address: {
      doc: 'Arbitrageur Address',
      format: formatEth,
      default: '0xB6aD438a80249caB2771991169dB834Db79BA7F6',
      env: 'ARBITRAGEUR_ADDRESS'
    }
  },
  key: {
    doc: 'Private Key',
    format: String,
    default: '',
    env: 'KEY'
  }
}
