import { ConfigModule } from '../config'
import { BunyanLogger, BunyanLoggerModule } from '../logger'

import { ClusterService } from './ClusterService'
import { ClusterWebController } from './ClusterWebController'

import { InitModule, module } from '@space-it-blockchain/framework-module'
import { WebPlugin } from '@space-it-blockchain/framework-web'

@module({
  plugins: [WebPlugin],
  imports: [ConfigModule, BunyanLoggerModule],
  deps: {
    init(local) {
      local.bind(ClusterService).toSelf().inSingletonScope()
    },
    export(exported, local) {
      exported.bind(ClusterService).toConstantValue(local.get(ClusterService))
    },
    webControllers: [ClusterWebController]
  }
})
export class ClusterModule implements InitModule {
  constructor(private readonly logger: BunyanLogger) {}
  init() {
    this.logger.info('ClusterModule is ready')
  }
}
