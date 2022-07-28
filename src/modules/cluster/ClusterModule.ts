import { ConfigModule } from '../config'

import { ClusterService } from './ClusterService'
import { ClusterWebController } from './ClusterWebController'

import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { InitModule, module } from '@space-it-blockchain/framework-module'
import { WebPlugin } from '@space-it-blockchain/framework-web'

@module({
  plugins: [WebPlugin],
  imports: [ConfigModule, LoggerModule],
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
  constructor(private readonly logger: Logger) {}
  init() {
    this.logger.info('ClusterModule is ready')
  }
}
