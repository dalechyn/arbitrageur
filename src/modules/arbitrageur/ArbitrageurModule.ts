import { BalancerModule } from '../balancer'
import { ConfigModule } from '../config'
import { FetcherModule } from '../fetcher'
import { BunyanLogger, BunyanLoggerModule } from '../logger'
import { MempoolUniswapV2Module } from '../mempool-uniswapv2'
import { MempoolUniswapV3Module } from '../mempool-uniswapv3/MempoolUniswapV3Module'
import { ProviderModule } from '../provider'
import { ProviderFlashbotsModule } from '../provider-flashbots'
import { TransactionModule } from '../transaction'

import { ArbitrageurService } from './ArbitrageurService'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [
    BunyanLoggerModule,
    ConfigModule,
    ProviderModule,
    FetcherModule,
    BalancerModule,
    TransactionModule,
    ProviderFlashbotsModule,
    MempoolUniswapV2Module,
    MempoolUniswapV3Module
  ],
  deps: {
    export(exported) {
      exported.bind(ArbitrageurService).toSelf().inSingletonScope()
    }
  }
})
export class ArbitrageurModule implements InitModule {
  constructor(
    private readonly logger: BunyanLogger,
    private readonly arbitrageur: ArbitrageurService
  ) {}

  init() {
    this.arbitrageur.run()
    this.logger.info('ArbitrageurModule is ready')
  }
}
