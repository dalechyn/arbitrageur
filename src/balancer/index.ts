import { BalancerResult } from './result'
import { balanceUniswapV2ToUniswapV2 } from './uniswapV2-uniswapV2'
import { balanceUniswapV2ToUniswapV3, balanceUniswapV3ToUniswapV2 } from './uniswapV2-uniswapV3'

import { Token } from '@uniswap/sdk-core'
import { Logger } from 'pino'
import { SupportedPoolWithContract } from '~interfaces'
import { DEXType } from '~utils'

const DEX_MODULE_ROUTER = {
  [DEXType.UNISWAPV2]: {
    [DEXType.UNISWAPV3]: balanceUniswapV2ToUniswapV3,
    [DEXType.UNISWAPV2]: balanceUniswapV2ToUniswapV2
  },
  [DEXType.UNISWAPV3]: {
    [DEXType.UNISWAPV2]: balanceUniswapV3ToUniswapV2,
    [DEXType.UNISWAPV3]: null
  }
}

/**
 * @description finds and balances the most profitable arbitrage opportunities
 */
export class Balancer {
  /**
   * Creates Balancer entity
   * @param firstPools pools from the first DEX that have quote token
   * @param secondPools pools from the second DEX that have quote token
   * @param baseToken baseToken
   */
  constructor(
    private readonly logger: Logger,
    private readonly firstPool: SupportedPoolWithContract,
    private readonly secondPool: SupportedPoolWithContract,
    private readonly baseToken: Token
  ) {}

  /**
   *
   * @param from pool to balance from
   * @param to pool to balance to
   * @returns BalanceResult - result of the balancing
   */
  private async balance(
    from: SupportedPoolWithContract,
    to: SupportedPoolWithContract
  ): Promise<BalancerResult> {
    const f = DEX_MODULE_ROUTER[from.type][to.type]
    if (!f) throw new Error(`${from.type}-${to.type} is not supported`)
    // @ts-expect-error Error is suppressed for easier typing.
    const [amountIn, profit] = await f(this.logger, from, to, this.baseToken)
    return new BalancerResult(from, to, amountIn, profit)
  }

  /**
   * @description Gets most profitable arbitrage opportunity.
   * As we don't know how much profit can be extracted from liquidity difference,
   * we have to run and check by hands all combinations of pools from and to
   */
  public async getMostProfitableArbitrage(): Promise<BalancerResult> {
    // We can only find the direction of the trades - by comparing the prices
    // and there is no sense in running an arbitrafe if from price is less than to price
    const zeroForOne = this.firstPool.price.lessThan(this.secondPool.price)
    return await this.balance(
      zeroForOne ? this.firstPool : this.secondPool,
      zeroForOne ? this.secondPool : this.firstPool
    )
  }
}
