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
    rpcOrIpcUrl: {
      doc: 'Network RPC or IPC URL',
      format: String,
      default: 'https://eth-goerli.alchemyapi.io/v2/oKG7sMevlL_ZQgGcZCOTEsaksS_nM922',
      env: 'NETWORK_RPC_OR_IPC_URL'
    },
    isIPC: {
      doc: 'Is IPC?',
      format: Boolean,
      default: false,
      env: 'NETWORK_IS_IPC'
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
    format: String,
    default: '',
    env: 'KEY'
  },
  port: {
    doc: 'Port',
    format: 'nat',
    default: 8080,
    env: 'PORT'
  }
}
