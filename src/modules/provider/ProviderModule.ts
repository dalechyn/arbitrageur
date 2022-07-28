import { ConfigModule } from '../config'

import { ProviderService } from './ProviderService'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, ConfigModule],
  deps: {
    export(exported) {
      exported.bind(ProviderService).toSelf().inSingletonScope()
    }
  }
})
export class ProviderModule implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('ProviderModule is ready')
  }
}
