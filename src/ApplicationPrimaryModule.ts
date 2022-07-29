import { ClusterModule } from './modules/cluster'
import { ConfigModule } from './modules/config'

import { ExitListenerModule } from '@space-it-blockchain/framework-exit-listener'
import { LoggerModule } from '@space-it-blockchain/framework-logger'
import { module } from '@space-it-blockchain/framework-module'

@module({
  imports: [LoggerModule, ConfigModule, ClusterModule, ExitListenerModule]
})
export class ApplicationPrimaryModule {}
