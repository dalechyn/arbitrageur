import { ConfigService } from '../config'

import { IpcProvider, JsonRpcProvider } from '@ethersproject/providers'
import { decorate, injectable } from 'inversify'

function createFakeBaseClass<T>(): new () => Pick<T, keyof T> {
  // we use a pick to remove the abstract modifier
  return class {} as any
}

const FakeBaseClass = createFakeBaseClass<JsonRpcProvider>()

decorate(injectable(), FakeBaseClass)

@injectable()
export class ProviderService extends FakeBaseClass {
  private readonly provider: IpcProvider | JsonRpcProvider
  constructor(readonly configService: ConfigService) {
    super()
    const provider = new (configService.get('network.isIPC') ? IpcProvider : JsonRpcProvider)(
      configService.get('network.rpcOrIpcUrl'),
      configService.get('network.chainId')
    )
    this.provider = provider

    const handler = {
      get: function (target: ProviderService, prop: keyof typeof provider, receiver: any) {
        if (provider[prop] !== null) {
          return target.provider[prop]
        }

        return Reflect.get(target, prop, receiver)
      }
    }
    return new Proxy(this, handler)
  }
}
