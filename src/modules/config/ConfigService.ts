import convict from 'convict'
import { injectable } from 'inversify'

import schema from './ConfigSchema'

@injectable()
export class ConfigService {
  readonly #config = convict(schema).validate()
  readonly get = this.#config.get.bind(this.#config)
  readonly set = this.#config.set.bind(this.#config)
}
