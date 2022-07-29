import cluster from 'cluster'

import { ApplicationPrimaryModule } from './ApplicationPrimaryModule'
import { ApplicationWorkerModule } from './ApplicationWorkerModule'

import { ModuleRunner } from '@space-it-blockchain/framework-module'

ModuleRunner.run(cluster.isPrimary ? ApplicationPrimaryModule : ApplicationWorkerModule)
