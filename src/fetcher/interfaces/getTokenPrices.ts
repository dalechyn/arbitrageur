import { Token } from '@uniswap/sdk-core'

import { SupportedPoolWithContract } from '~interfaces'

export interface GetPriceWithPool {
  getPoolWithPrices(baseToken: Token, queryToken: Token): Promise<SupportedPoolWithContract[]>
}
