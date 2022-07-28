import { ConfigService } from './ConfigService'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule],
  deps: {
    export(exported) {
      exported.bind(ConfigService).toSelf().inSingletonScope()
    }
  }
})
export class ConfigModule implements InitModule {
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('ConfigModule is ready')
  }
}
