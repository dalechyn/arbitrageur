import { Token, Price } from '@uniswap/sdk-core'

export interface GetTokenPrice {
  getTokenPrice(token0: Token, token1: Token, lowest?: boolean): Promise<Price<Token, Token> | null>
}
