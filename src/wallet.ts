import { Wallet } from 'ethers'

import { SIGNER_KEY } from './utils'

export const authSigner = new Wallet(SIGNER_KEY)
