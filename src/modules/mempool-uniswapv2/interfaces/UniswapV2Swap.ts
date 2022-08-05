import { UniswapV2SwapSignature } from './UniswapV2SwapSignature'
import { UniswapV3RouterV2SwapSignature } from './UniswapV3RouterV2SwapSignature'

import { Token } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'

export interface UniswapV2Swap {
  method: UniswapV2SwapSignature | UniswapV3RouterV2SwapSignature
  from: string
  to: string
  amountIn: BigNumber
  amountOut: BigNumber
  deadline: BigNumber
  path: Token[]
}
