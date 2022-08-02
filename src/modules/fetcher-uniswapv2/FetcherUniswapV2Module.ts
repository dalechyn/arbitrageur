import { BunyanLogger, BunyanLoggerModule } from '../logger'
import { ProviderModule } from '../provider'

import { FetcherUniswapV2Service } from './FetcherUniswapV2Service'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, ProviderModule],
  deps: {
    export(exported) {
      exported.bind(FetcherUniswapV2Service).toSelf().inSingletonScope()
    }
  }
})
export class FetcherUniswapV2Module implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('FetcherUniswapV2Module is ready')
  }
}
