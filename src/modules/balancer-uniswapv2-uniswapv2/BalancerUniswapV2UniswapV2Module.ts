import { BunyanLogger, BunyanLoggerModule } from '../logger'

import { BalancerUniswapV2UniswapV2Service } from './BalancerUniswapV2UniswapV2Service'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule],
  deps: {
    export(exported) {
      exported.bind(BalancerUniswapV2UniswapV2Service).toSelf().inSingletonScope()
    }
  }
})
export class BalancerUniswapV2UniswapV2Module implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('BalancerUniswapV2UniswapV2Service is ready')
  }
}
