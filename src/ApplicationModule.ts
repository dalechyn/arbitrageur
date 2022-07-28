import { ArbitrageurModule } from './modules/arbitrageur'
import { BalancerModule } from './modules/balancer'
import { BalancerUniswapV2UniswapV2Module } from './modules/balancer-uniswapv2-uniswapv2'
import { BalancerUniswapV2UniswapV3Module } from './modules/balancer-uniswapv2-uniswapv3'
import { ClusterModule } from './modules/cluster'
import { ConfigModule, ConfigService } from './modules/config'
import { FetcherModule } from './modules/fetcher'
import { FetcherUniswapV2Module } from './modules/fetcher-uniswapv2'
import { FetcherUniswapV3Module } from './modules/fetcher-uniswapv3'
import { ProviderModule } from './modules/provider'
import { ProviderFlashbotsModule } from './modules/provider-flashbots'
import { TransactionModule } from './modules/transaction'

import cors from '@koa/cors'
import { ExitListenerModule } from '@space-it-blockchain/framework-exit-listener'
import { KoaAdapterModule, KoaAdapter } from '@space-it-blockchain/framework-koa'
import { LoggerModule } from '@space-it-blockchain/framework-logger'
import { module, InitModule } from '@space-it-blockchain/framework-module'
import {
  HttpCatcher,
  UnhandledErrorCatcher,
  WebApplication,
  WebApplicationModule,
  WebLoggerMiddleware
} from '@space-it-blockchain/framework-web'
import koaBody from 'koa-body'
import cookie from 'koa-cookie'

@module({
  imports: [
    LoggerModule,
    ConfigModule,
    ClusterModule,
    BalancerUniswapV2UniswapV2Module,
    BalancerUniswapV2UniswapV3Module,
    BalancerModule,
    ProviderModule,
    ProviderFlashbotsModule,
    TransactionModule,
    FetcherUniswapV2Module,
    FetcherUniswapV3Module,
    FetcherModule,
    ArbitrageurModule,
    KoaAdapterModule.register((c) => ({
      port: c.get(ConfigService).get('port'),
      setup: (koa) =>
        koa
          .use(koaBody({ includeUnparsed: true }))
          .use(cookie())
          .use(
            cors({
              origin: '*'
            })
          )
    })),
    WebApplicationModule.register((c) => ({
      adapter: c.get(KoaAdapter)
    })),
    ExitListenerModule
  ]
})
export class ApplicationModule implements InitModule {
  constructor(
    private readonly app: WebApplication,
    private readonly loggerMiddleware: WebLoggerMiddleware,
    private readonly httpCatcher: HttpCatcher,
    private readonly unhandledCatcher: UnhandledErrorCatcher
  ) {}

  async init(): Promise<void> {
    return this.app
      .useGlobalMiddlewares(this.loggerMiddleware, this.unhandledCatcher, this.httpCatcher)
      .bootstrap()
  }
}
