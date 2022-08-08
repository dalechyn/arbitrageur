import { Token } from '@uniswap/sdk-core'

import { PoolWithContract } from '../../common'

import { BalanceResult } from '.'

/**
 * Abstract Balancer interface which opens up a single method
 */
export interface AbstractBalancer {
  /**
   * Returns the balance result
   *
   * @param from Pool A
   * @param to Pool B
   * @param baseToken Base Token
   */
  balance(from: PoolWithContract, to: PoolWithContract, baseToken: Token): Promise<BalanceResult>
}
