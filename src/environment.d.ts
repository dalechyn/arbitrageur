declare namespace NodeJS {
  interface ProcessEnv {
    ETHEREUM_RPC_URL: string | undefined
    FLASHBOTS_RELAY_URL: string
    ALCHEMY_API_KEY: string
    CHAIN_ID: string
    KEY: string
    NODE_ENV: 'development' | 'production'
    PORT?: string
    PWD: string
    BASE_TOKEN_ADDRESS: string
    BASE_TOKEN_DECIMALS: string
    BASE_TOKEN_NAME: string
    UNISWAP_V3_FACTORY_ADDRESS: string
    UNISWAP_V2_FACTORY_ADDRESS: string
  }
}
