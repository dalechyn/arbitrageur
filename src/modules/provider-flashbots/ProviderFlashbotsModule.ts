import { ConfigModule } from '../config'
import { ProviderModule } from '../provider'

import { ProviderFlashbotsService } from './ProviderFlashbotsService'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, ConfigModule, ProviderModule],
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
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('ProviderFlashbotsModule is ready')
  }
}
