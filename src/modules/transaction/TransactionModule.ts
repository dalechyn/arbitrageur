import { ConfigModule } from '../config'
import { ProviderModule } from '../provider'

import { TransactionService } from './TransactionService'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, ConfigModule, ProviderModule],
  deps: {
    export(exported) {
      exported.bind(TransactionService).toSelf().inSingletonScope()
    }
  }
})
export class TransactionModule implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('TransactionModule is ready')
  }
}
