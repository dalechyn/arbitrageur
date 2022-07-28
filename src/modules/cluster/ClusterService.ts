import cluster from 'cluster'

import { ConfigService } from '../config'
import { ArbitrageInfo } from '../interfaces'

import { Logger } from '@space-it-blockchain/framework-logger'
import { Token } from '@uniswap/sdk-core'
import { injectable } from 'inversify'

@injectable()
export class ClusterService {
  private opportunities: ArbitrageInfo[]
  constructor(private readonly configService: ConfigService, logger: Logger) {
    this.opportunities = []
    if (cluster.isPrimary) {
      const totalCPUs = configService.get('clusters')
      logger.info(`Number of CPUs is ${totalCPUs}`)
      logger.info(`Master ${process.pid} is running`)

      // Fork workers.
      for (let i = 0; i < totalCPUs; i++) {
        cluster.fork()
      }

      cluster.on('exit', (worker) => {
        logger.warn(`Worker ${worker.process.pid} died`)
      })

      cluster.on('message', (_, message) => {
        for (const id in cluster.workers) {
          cluster.workers[id]?.send(message)
        }
      })
    } else {
      cluster.worker?.on('message', (message) => {
        if (message === 'flush') {
          this.opportunities = []
        }
      })
    }
  }

  isMaster(): boolean {
    return cluster.isPrimary
  }

  getOpportunities(): ArbitrageInfo[] {
    return this.opportunities
  }

  flush(): void {
    this.opportunities = []
    cluster.worker?.send('flush')
  }

  addInfo(info: any) {
    this.opportunities = [
      ...this.opportunities,
      {
        poolA: info.poolA,
        typeA: info.typeA,
        poolB: info.poolB,
        typeB: info.typeB,
        baseToken: new Token(
          this.configService.get('network.chainId'),
          info.baseToken.address,
          info.baseToken.decimals,
          info.baseToken.symbol
        ),
        quoteToken: new Token(
          this.configService.get('network.chainId'),
          info.quoteToken.address,
          info.quoteToken.decimals,
          info.quoteToken.symbol
        )
      }
    ]
  }
}
