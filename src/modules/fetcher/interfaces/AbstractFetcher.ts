import { PoolWithContract } from '../../interfaces'

import { Token } from '@uniswap/sdk-core'

export interface AbstractFetcher {
  /**
   * Returns full info on Pool
   * @param poolAddress Address of the pool
   * @param baseToken Base token
   * @param quoteToken Quote token
   */
  fetch(poolAddress: string, baseToken: Token, quoteToken: Token): Promise<PoolWithContract>
}
