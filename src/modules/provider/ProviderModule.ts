import { ConfigModule } from '../config'
import { BunyanLogger, BunyanLoggerModule } from '../logger'

import { ProviderService } from './ProviderService'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, ConfigModule],
  deps: {
    export(exported) {
      exported.bind(ProviderService).toSelf().inSingletonScope()
    }
  }
})
export class ProviderModule implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('ProviderModule is ready')
  }
}
