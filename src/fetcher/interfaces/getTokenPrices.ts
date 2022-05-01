import { Token } from '@uniswap/sdk-core'

import { SupportedPoolWithContract } from '~interfaces'

export interface GetTokenPrices {
  getTokenPrices(baseToken: Token, queryToken: Token): Promise<SupportedPoolWithContract[]>
}
