import { Wallet } from 'ethers'

import { KEY } from './constants'

export const authSigner = new Wallet(KEY)
