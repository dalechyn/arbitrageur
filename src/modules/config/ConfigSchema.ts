import os from 'os'
import path from 'path'

import bunyan from 'bunyan'
import { validate } from 'multicoin-address-validator'

const formatEth = (address: string) => {
  const result = validate(address, '0x')
  if (!result) throw new Error('ETH address is incorrect')
}

export default {
  network: {
    chainId: {
      doc: 'Network Chain ID',
      format: 'nat',
      default: 5,
      env: 'NETWORK_CHAIN_ID'
    },
    rpcUrl: {
      doc: 'Network RPC or IPC URL',
      format: String,
      default: 'http://eth-goerli.alchemyapi.io/v2/oKG7sMevlL_ZQgGcZCOTEsaksS_nM922',
      env: 'NETWORK_RPC_OR_IPC_URL'
    },
    blocksInFuture: {
      doc: 'Blocks in future to target',
      format: 'nat',
      default: 1,
      env: 'NETWORK_BLOCKS_IN_FUTURE'
    }
  },
  rewardToken: {
    address: {
      format: String,
      default: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      env: 'REWARD_TOKEN_ADDRESS'
    },
    symbol: {
      format: String,
      default: 'WETH',
      env: 'REWARD_TOKEN_SYMBOL'
    },
    decimals: {
      format: Number,
      default: 18,
      env: 'REWARD_TOKEN_DECIMALS'
    }
  },
  multiCallTickerLensAddress: {
    doc: 'MultiCall TickerLens Address',
    format: String,
    default: '0xFAd707E7A61B280beA15Df44018725D941d91B33',
    env: 'MULTICALL_TICKERLENS_ADDRESS'
  },
  arbitrageur: {
    address: {
      doc: 'Arbitrageur Address',
      format: formatEth,
      default: '0xf425006e4032f5639a0e892bfd7381e7b27f2db6',
      env: 'ARBITRAGEUR_ADDRESS'
    }
  },
  key: {
    doc: 'Private Key',
    default: null,
    format: String,
    env: 'KEY'
  },
  port: {
    doc: 'Port',
    format: 'nat',
    default: 8080,
    env: 'PORT'
  },
  mevRelay: {
    doc: 'MEV Relay',
    format: String,
    default: 'https://mev-relay.ethermine.org',
    env: 'MEV_RELAY'
  },
  clusters: {
    doc: 'Clusters',
    format: Number,
    default: os.cpus().length,
    env: 'CLUSTERS'
  },
  entryMethodName: {
    format: String,
    default: 'arbitrage_003xYAO9',
    env: 'ENTRYPOINT_METHOD_NAME'
  },
  logger: {
    level: {
      format: (v: any) => {
        if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(v)) return
        throw new Error(
          `logger level should be one of: 'trace' , 'debug' , 'info' , 'warn' , 'error' , 'fatal'`
        )
      },
      default: 'info' as bunyan.LogLevelString,
      env: 'LOG_LEVEL'
    },
    path: {
      format: String,
      default: path.resolve(process.env.HOME ?? '/', 'arbitrage', '.logs'),
      env: 'LOG_DIRECTORY_PATH'
    }
  },
  dexes: {
    uniswapV2: {
      routerAddress: {
        format: String,
        default: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        env: 'DEXES_UNISWAPV2_ROUTER_ADDRESS'
      }
    },
    uniswapV3: {
      routerAddress: {
        format: String,
        default: '0xe592427a0aece92de3edee1f18e0157c05861564',
        env: 'DEXES_UNISWAPV3_ROUTER_ADDRESS'
      },
      // note - router2 can also make v2 transactions
      router02Address: {
        format: String,
        default: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        env: 'DEXES_UNISWAPV3_ROUTER02_ADDRESS'
      }
    },
    sushiswap: {
      routerAddress: {
        format: String,
        default: '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f',
        env: 'DEXES_SUSHISWAP_ROUTER_ADDRESS'
      },
      pairCodeHash: {
        format: String,
        default: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
        env: 'DEXES_SUSHISWAP_PAIR_CODE_HASH'
      },
      factoryAddress: {
        format: String,
        default: '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac',
        env: 'DEXES_SUSHISWAP_FACTORY_ADDRESS'
      }
    }
  }
}
