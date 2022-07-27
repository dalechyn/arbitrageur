import schema from './schema'

import convict from 'convict'

export const config = convict(schema, { env: process.env })
