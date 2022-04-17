import { Wallet } from 'ethers'

import { SIGNER_KEY } from './constants'

export const authSigner = new Wallet(SIGNER_KEY)
