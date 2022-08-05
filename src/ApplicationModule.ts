import fs from 'fs'
import path from 'path'

import { ArbitrageurModule } from './modules/arbitrageur'
import { BalancerModule } from './modules/balancer'
import { BalancerUniswapV2UniswapV2Module } from './modules/balancer-uniswapv2-uniswapv2'
import { BalancerUniswapV2UniswapV3Module } from './modules/balancer-uniswapv2-uniswapv3'
import { ConfigModule, ConfigService } from './modules/config'
import { FetcherModule } from './modules/fetcher'
import { FetcherUniswapV2Module } from './modules/fetcher-uniswapv2'
import { FetcherUniswapV3Module } from './modules/fetcher-uniswapv3'
import { BunyanLoggerModule } from './modules/logger'
import { MempoolUniswapV2Module } from './modules/mempool-uniswapv2'
import { ProviderModule } from './modules/provider'
import { ProviderFlashbotsModule } from './modules/provider-flashbots'
import { TransactionModule } from './modules/transaction'

import { ExitListenerModule } from '@space-it-blockchain/framework-exit-listener'
import { Logger, LoggerModule } from '@space-it-blockchain/framework-logger'
import { module } from '@space-it-blockchain/framework-module'
@module({
  imports: [
    ConfigModule,
    LoggerModule,
    BunyanLoggerModule.register((c) => {
      const configService = c.get(ConfigService)
      const loggerService = c.get(Logger)
      if (!fs.existsSync(configService.get('logDirectoryPath'))) {
        fs.mkdirSync(configService.get('logDirectoryPath'), { recursive: true })
      }
      const logPath = path.resolve(configService.get('logDirectoryPath'), `arbitraguer.log`)

      loggerService.info(`Will write logs to ${logPath}`)
      return {
        name: `arbitraguer`,
        streams: [
          { stream: process.stdout },
          {
            path: logPath
          }
        ]
      }
    }),
    BalancerUniswapV2UniswapV2Module,
    BalancerUniswapV2UniswapV3Module,
    BalancerModule,
    ProviderModule,
    MempoolUniswapV2Module,
    ProviderFlashbotsModule,
    TransactionModule,
    FetcherUniswapV2Module,
    FetcherUniswapV3Module,
    FetcherModule,
    ArbitrageurModule,
    ExitListenerModule
  ]
})
export class ApplicationModule {}
