import { ProviderModule } from '../provider'

import { FetcherUniswapV2Service } from './FetcherUniswapV2Service'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, ProviderModule],
  deps: {
    export(exported) {
      exported.bind(FetcherUniswapV2Service).toSelf().inSingletonScope()
    }
  }
})
export class FetcherUniswapV2Module implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('FetcherUniswapV2Module is ready')
  }
}
