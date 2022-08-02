import { ConfigModule } from '../config'
import { BunyanLogger, BunyanLoggerModule } from '../logger'
import { ProviderModule } from '../provider'

import { TransactionService } from './TransactionService'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, ConfigModule, ProviderModule],
  deps: {
    export(exported) {
      exported.bind(TransactionService).toSelf().inSingletonScope()
    }
  }
})
export class TransactionModule implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('TransactionModule is ready')
  }
}
