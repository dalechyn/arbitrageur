declare namespace NodeJS {
  interface ProcessEnv {
    ETHEREUM_RPC_URL: string | undefined
    FLASHBOTS_RELAY_URL: string
    ALCHEMY_API_KEY: string
    CHAIN_ID: string
    SIGNER_KEY: string
    NODE_ENV: 'development' | 'production'
    PORT?: string
    PWD: string
  }
}
