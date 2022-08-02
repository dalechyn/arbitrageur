import { BalancerUniswapV2UniswapV2Module } from '../balancer-uniswapv2-uniswapv2'
import { BalancerUniswapV2UniswapV3Module } from '../balancer-uniswapv2-uniswapv3'
import { BunyanLogger, BunyanLoggerModule } from '../logger'

import { BalancerService } from './BalancerService'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, BalancerUniswapV2UniswapV3Module, BalancerUniswapV2UniswapV2Module],
  deps: {
    export(exported) {
      exported.bind(BalancerService).toSelf().inSingletonScope()
    }
  }
})
export class BalancerModule implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('BalancerModule is ready')
  }
}
