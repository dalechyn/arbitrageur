import { ConfigModule } from '../config'
import { BunyanLogger, BunyanLoggerModule } from '../logger'

import { MempoolUniswapV2Service } from './MempoolUniswapV2Service'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, ConfigModule],
  deps: {
    export(exported) {
      exported.bind(MempoolUniswapV2Service).toSelf().inSingletonScope()
    }
  }
})
export class MempoolUniswapV2Module implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('MempoolUniswapV2Module is ready')
  }
}
