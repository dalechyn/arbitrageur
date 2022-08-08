import { Token } from '@uniswap/sdk-core'
import { injectable } from 'inversify'

import { BalancerUniswapV2UniswapV2Service } from '../balancer-uniswapv2-uniswapv2/BalancerUniswapV2UniswapV2Service'
import { BalancerUniswapV2UniswapV3Service } from '../balancer-uniswapv2-uniswapv3/BalancerUniswapV2UniswapV3Service'
import { DEXType, PoolWithContract } from '../common'

import { BalancerNotSupportedError } from './errors/BalancerNotSupportedError'
import { AbstractBalancer, BalanceResult } from './interfaces'

@injectable()
export class BalancerService implements AbstractBalancer {
  constructor(
    private readonly balancerUniswapV2UniswapV2Service: BalancerUniswapV2UniswapV2Service,
    private readonly balancerUniswapV2UniswapV3Service: BalancerUniswapV2UniswapV3Service
  ) {}

  balance(from: PoolWithContract, to: PoolWithContract, baseToken: Token): Promise<BalanceResult> {
    if (from.type === DEXType.UNISWAPV3) {
      if (to.type === DEXType.UNISWAPV2)
        return this.balancerUniswapV2UniswapV3Service.balance(from, to, baseToken)
    } else {
      if (to.type === DEXType.UNISWAPV3)
        return this.balancerUniswapV2UniswapV3Service.balance(from, to, baseToken)
      if (to.type === DEXType.UNISWAPV2)
        return this.balancerUniswapV2UniswapV2Service.balance(from, to, baseToken)
    }

    throw new BalancerNotSupportedError(from.type, to.type)
  }
}
