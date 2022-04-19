import { Token, Price } from '@uniswap/sdk-core'

export interface GetTokenPrices {
  getTokenPrices(baseToken: Token, token: Token): Promise<Array<Price<Token, Token>>>
}
