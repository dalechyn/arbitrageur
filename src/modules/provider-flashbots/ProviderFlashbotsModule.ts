import { ConfigModule } from '../config'
import { ProviderModule } from '../provider'

import { ProviderFlashbotsService } from './ProviderFlashbotsService'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, ConfigModule, ProviderModule],
  deps: {
    export(exported) {
      exported.bind(ProviderFlashbotsService).toSelf().inSingletonScope()
    }
  }
})
export class ProviderFlashbotsModule implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('ProviderFlashbotsModule is ready')
  }
}
