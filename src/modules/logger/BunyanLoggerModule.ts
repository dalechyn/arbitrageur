import { LoggerOptions } from 'bunyan'

import { BunyanLogger } from './BunyanLogger'
import { TYPES } from './TYPES'

import { module, DynamicModule, Configure } from '@space-it-blockchain/framework-module'

@module(BunyanLoggerModule.register())
export class BunyanLoggerModule {
  static register(configure?: Configure<LoggerOptions>): DynamicModule {
    return {
      deps: {
        init(local) {
          local
            .bind<LoggerOptions>(TYPES.Options)
            .toDynamicValue(() => configure?.(local) ?? { name: 'default' })
        },
        export(exported, local) {
          exported
            .bind(BunyanLogger)
            .toDynamicValue(() => local.resolve(BunyanLogger))
            .inSingletonScope()
        }
      },
      module: this
    }
  }
}
