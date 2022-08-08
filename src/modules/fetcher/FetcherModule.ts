import { ConfigModule } from '../config'
import { FetcherUniswapV2Module } from '../fetcher-uniswapv2'
import { FetcherUniswapV3Module } from '../fetcher-uniswapv3'
import { BunyanLogger, BunyanLoggerModule } from '../logger'

import { FetcherService } from './FetcherService'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [ConfigModule, BunyanLoggerModule, FetcherUniswapV2Module, FetcherUniswapV3Module],
  deps: {
    export(exported) {
      exported.bind(FetcherService).toSelf().inSingletonScope()
    }
  }
})
export class FetcherModule implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('FetcherModule is ready')
  }
}
