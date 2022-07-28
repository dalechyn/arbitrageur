import { ClusterService } from './ClusterService'

import { body, get, controller, post, status } from '@space-it-blockchain/framework-web'

@controller({ path: '/' })
export class ClusterWebController {
  constructor(private readonly clusterService: ClusterService) {}

  @get('/flush')
  @status(200)
  onFlush(): void {
    return this.clusterService.flush()
  }

  @post('/')
  @status(200)
  onAddArbitrageInfo(@body() info: any): void {
    return this.clusterService.addInfo(info)
  }
}
