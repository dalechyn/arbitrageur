import { ConfigModule } from '../config'
import { BunyanLogger, BunyanLoggerModule } from '../logger'
import { ProviderModule } from '../provider'

import { FetcherUniswapV3Service } from './FetcherUniswapV3Service'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, ConfigModule, ProviderModule],
  deps: {
    export(exported) {
      exported.bind(FetcherUniswapV3Service).toSelf().inSingletonScope()
    }
  }
})
export class FetcherUniswapV3Module implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('FetcherUniswapV3Module is ready')
  }
}
