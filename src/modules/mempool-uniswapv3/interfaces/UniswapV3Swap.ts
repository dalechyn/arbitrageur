import { UniswapV3SwapV3Signature } from './UniswapV3SwapV3Signature'

import { Token } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'

export type UniswapV3Swap = {
  hash?: string
  from: string
  recipient: string
} & (
  | {
      method: UniswapV3SwapV3Signature.exactInputSingle
      tokenIn: Token
      tokenOut: Token
      fee: number
      amountIn: BigNumber
      amountOutMinimum: BigNumber
      sqrtPriceLimitX96: BigNumber
    }
  | {
      method: UniswapV3SwapV3Signature.exactInput
      path: Token[]
      amountIn: BigNumber
      amountOutMinimum: BigNumber
    }
  | {
      method: UniswapV3SwapV3Signature.exactOutputSingle
      tokenIn: Token
      tokenOut: Token
      fee: number
      amountInMaximum: BigNumber
      amountOut: BigNumber
      sqrtPriceLimitX96: BigNumber
    }
  | {
      method: UniswapV3SwapV3Signature.exactOutput
      path: Token[]
      amountInMaximum: BigNumber
      amountOut: BigNumber
    }
)
