import { ConfigModule } from '../config'
import { ProviderModule } from '../provider'

import { FetcherUniswapV3Service } from './FetcherUniswapV3Service'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, ConfigModule, ProviderModule],
  deps: {
    export(exported) {
      exported.bind(FetcherUniswapV3Service).toSelf().inSingletonScope()
    }
  }
})
export class FetcherUniswapV3Module implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('FetcherUniswapV3Module is ready')
  }
}
