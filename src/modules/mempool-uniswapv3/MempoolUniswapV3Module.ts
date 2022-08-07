import { ConfigModule } from '../config'
import { BunyanLogger, BunyanLoggerModule } from '../logger'

import { MempoolUniswapV3Service } from './MempoolUniswapV3Service'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, ConfigModule],
  deps: {
    export(exported) {
      exported.bind(MempoolUniswapV3Service).toSelf().inSingletonScope()
    }
  }
})
export class MempoolUniswapV3Module implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('MempoolUniswapV3Module is ready')
  }
}
