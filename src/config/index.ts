import convict from 'convict'

import schema from './schema'
export const config = convict(schema)
