import { UniswapV3SwapSignature } from './UniswapV3SwapSignature'
import { UniswapV3SwapV3Signature } from './UniswapV3SwapV3Signature'

import { Token } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'

export type UniswapV3Swap = {
  hash?: string
  from: string
  recipient: string
} & (
  | ((
      | {
          method: UniswapV3SwapV3Signature.exactInputSingle
        }
      | {
          method: UniswapV3SwapSignature.exactInputSingle
          deadline: BigNumber
        }
    ) & {
      tokenIn: Token
      tokenOut: Token
      fee: number
      amountIn: BigNumber
      amountOutMinimum: BigNumber
      sqrtPriceLimitX96: BigNumber
    })
  | ((
      | {
          method: UniswapV3SwapV3Signature.exactInput
        }
      | {
          method: UniswapV3SwapSignature.exactInput
          deadline: BigNumber
        }
    ) & {
      path: Token[]
      amountIn: BigNumber
      amountOutMinimum: BigNumber
    })
  | ((
      | {
          method: UniswapV3SwapV3Signature.exactOutputSingle
        }
      | {
          method: UniswapV3SwapSignature.exactOutputSingle
          deadline: BigNumber
        }
    ) & {
      tokenIn: Token
      tokenOut: Token
      fee: number
      amountInMaximum: BigNumber
      amountOut: BigNumber
      sqrtPriceLimitX96: BigNumber
    })
  | ((
      | {
          method: UniswapV3SwapV3Signature.exactOutput
        }
      | {
          method: UniswapV3SwapSignature.exactOutput
          deadline: BigNumber
        }
    ) & {
      path: Token[]
      amountInMaximum: BigNumber
      amountOut: BigNumber
    })
)
