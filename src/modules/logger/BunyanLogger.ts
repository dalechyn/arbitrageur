import { TYPES } from './TYPES'

import bunyan from 'bunyan'
import { inject, injectable } from 'inversify'
@injectable()
export class BunyanLogger {
  private readonly logger: bunyan
  constructor(@inject(TYPES.Options) opts: bunyan.LoggerOptions) {
    this.logger = bunyan.createLogger(opts)
  }

  debug(format: any, ...params: any[]): void {
    this.logger.debug(format, ...params)
  }

  error(format: any, ...params: any[]): void {
    this.logger.error(format, ...params)
  }

  info(format: any, ...params: any[]): void {
    this.logger.info(format, ...params)
  }

  trace(format: any, ...params: any[]): void {
    this.logger.trace(format, ...params)
  }

  warn(format: any, ...params: any[]): void {
    this.logger.warn(format, ...params)
  }
}
