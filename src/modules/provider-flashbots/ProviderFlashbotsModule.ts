import { ConfigModule } from '../config'
import { BunyanLogger, BunyanLoggerModule } from '../logger'
import { ProviderModule } from '../provider'

import { ProviderFlashbotsService } from './ProviderFlashbotsService'

import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [BunyanLoggerModule, ConfigModule, ProviderModule],
  deps: {
    init(local) {
      local.options.skipBaseClassChecks = true
      local.bind(ProviderFlashbotsService).toSelf().inSingletonScope()
    },
    export(exported, local) {
      exported.bind(ProviderFlashbotsService).toConstantValue(local.get(ProviderFlashbotsService))
    }
  }
})
export class ProviderFlashbotsModule implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('ProviderFlashbotsModule is ready')
  }
}
