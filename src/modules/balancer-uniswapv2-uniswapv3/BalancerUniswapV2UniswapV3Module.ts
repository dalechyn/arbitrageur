import { BalancerUniswapV2UniswapV3Service } from './BalancerUniswapV2UniswapV3Service'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule],
  deps: {
    export(exported) {
      exported.bind(BalancerUniswapV2UniswapV3Service).toSelf().inSingletonScope()
    }
  }
})
export class BalancerUniswapV2UniswapV3Module implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('BalancerUniswapV2UniswapV3Module is ready')
  }
}
