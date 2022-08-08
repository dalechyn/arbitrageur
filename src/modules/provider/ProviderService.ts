import { EventType, Listener, WebSocketProvider } from '@ethersproject/providers'
import { decorate, injectable } from 'inversify'

import { ConfigService } from '../config'
import { BunyanLogger } from '../logger'

decorate(injectable(), WebSocketProvider)

@injectable()
export class ProviderService extends WebSocketProvider {
  constructor(readonly configService: ConfigService, readonly logger: BunyanLogger) {
    super(configService.get('network.rpcUrl'), configService.get('network.chainId'))
  }

  on(eventName: EventType, listner: Listener): this {
    if (eventName === 'pending')
      return super.on(eventName, (hash: string) =>
        this.getTransaction(hash).then((tx) => tx && listner(tx))
      )
    return super.on(eventName, listner)
  }
}
