import { ConfigService } from './ConfigService'

import { module } from '@space-it-blockchain/framework-module'

@module({
  deps: {
    export(exported) {
      exported.bind(ConfigService).toSelf().inSingletonScope()
    }
  }
})
export class ConfigModule {}
