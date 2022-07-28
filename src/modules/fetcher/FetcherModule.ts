import { FetcherUniswapV2Module } from '../fetcher-uniswapv2'
import { FetcherUniswapV3Module } from '../fetcher-uniswapv3'

import { FetcherService } from './FetcherService'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, FetcherUniswapV2Module, FetcherUniswapV3Module],
  deps: {
    export(exported) {
      exported.bind(FetcherService).toSelf().inSingletonScope()
    }
  }
})
export class FetcherModule implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('FetcherModule is ready')
  }
}
