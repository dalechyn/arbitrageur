import { ConfigService } from '../config'
import { BunyanLogger } from '../logger'

import { JsonRpcProvider } from '@ethersproject/providers'
import { decorate, injectable } from 'inversify'

decorate(injectable(), JsonRpcProvider)

@injectable()
export class ProviderService extends JsonRpcProvider {
  constructor(readonly configService: ConfigService, readonly logger: BunyanLogger) {
    super(configService.get('network.rpcUrl'), configService.get('network.chainId'))
  }
}
