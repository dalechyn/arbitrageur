import schema from './ConfigSchema'

import convict from 'convict'
import { injectable } from 'inversify'

@injectable()
export class ConfigService {
  readonly #config = convict(schema).validate()
  readonly get = this.#config.get.bind(this.#config)
  readonly set = this.#config.set.bind(this.#config)
}
