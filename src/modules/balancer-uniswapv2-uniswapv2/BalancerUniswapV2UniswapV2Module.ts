import { BalancerUniswapV2UniswapV2Service } from './BalancerUniswapV2UniswapV2Service'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule],
  deps: {
    export(exported) {
      exported.bind(BalancerUniswapV2UniswapV2Service).toSelf().inSingletonScope()
    }
  }
})
export class BalancerUniswapV2UniswapV2Module implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('BalancerUniswapV2UniswapV2Service is ready')
  }
}
