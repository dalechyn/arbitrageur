import { Token } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'

import { DEX } from '../../common'

import { UniswapV3SwapSignature } from './UniswapV3SwapSignature'
import { UniswapV3SwapV3Signature } from './UniswapV3SwapV3Signature'

export interface UniswapV3PathElement {
  tokenA: Token
  tokenB: Token
  fee: number
}

type UniswapV3SwapMeta = {
  dex: DEX.UniswapV3
  hash?: string
  from: string
  recipient: string
}

type UniswapV3MultiSwap = {
  path: UniswapV3PathElement[]
}

type UniswapV3SingleSwap = {
  tokenIn: Token
  tokenOut: Token
  fee: number
  sqrtPriceLimitX96: BigNumber
}

type UniswapV3ExactInMeta = {
  amountIn: BigNumber
  amountOutMinimum: BigNumber
}

type UniswapV3ExactOutMeta = {
  amountInMaximum: BigNumber
  amountOut: BigNumber
}

type UniswapV3ExactInputSwap = UniswapV3SwapMeta &
  UniswapV3MultiSwap &
  UniswapV3ExactInMeta &
  (
    | {
        signature: UniswapV3SwapV3Signature.exactInput
      }
    | {
        signature: UniswapV3SwapSignature.exactInput
        deadline: BigNumber
      }
  )

type UniswapV3ExactInputSingleSwap = UniswapV3SwapMeta &
  UniswapV3SingleSwap &
  UniswapV3ExactInMeta &
  (
    | {
        signature: UniswapV3SwapV3Signature.exactInputSingle
      }
    | {
        signature: UniswapV3SwapSignature.exactInputSingle
        deadline: BigNumber
      }
  )

type UniswapV3ExactOutputSwap = UniswapV3SwapMeta &
  UniswapV3MultiSwap &
  UniswapV3ExactOutMeta &
  (
    | {
        signature: UniswapV3SwapV3Signature.exactOutput
      }
    | {
        signature: UniswapV3SwapSignature.exactOutput
        deadline: BigNumber
      }
  )

type UniswapV3ExactOutputSingleSwap = UniswapV3SwapMeta &
  UniswapV3SingleSwap &
  UniswapV3ExactOutMeta &
  (
    | {
        signature: UniswapV3SwapV3Signature.exactOutputSingle
      }
    | {
        signature: UniswapV3SwapSignature.exactOutputSingle
        deadline: BigNumber
      }
  )

export type UniswapV3Swap =
  | UniswapV3ExactInputSingleSwap
  | UniswapV3ExactInputSwap
  | UniswapV3ExactOutputSingleSwap
  | UniswapV3ExactOutputSwap

export function isUniswapV3ExactInput(
  swap: UniswapV3Swap
): swap is UniswapV3ExactInputSwap | UniswapV3ExactInputSingleSwap {
  return (
    swap.signature === UniswapV3SwapV3Signature.exactInput ||
    swap.signature === UniswapV3SwapSignature.exactInput ||
    swap.signature === UniswapV3SwapV3Signature.exactInputSingle ||
    swap.signature === UniswapV3SwapSignature.exactInputSingle
  )
}

export function isUniswapV3ExactOutput(
  swap: UniswapV3Swap
): swap is UniswapV3ExactOutputSwap | UniswapV3ExactOutputSingleSwap {
  return (
    swap.signature === UniswapV3SwapV3Signature.exactOutput ||
    swap.signature === UniswapV3SwapV3Signature.exactOutputSingle ||
    swap.signature === UniswapV3SwapSignature.exactOutput ||
    swap.signature === UniswapV3SwapSignature.exactOutputSingle
  )
}

export function isUniswapV3Multi(
  swap: UniswapV3Swap
): swap is UniswapV3ExactInputSwap | UniswapV3ExactOutputSwap {
  return (
    swap.signature === UniswapV3SwapV3Signature.exactInput ||
    swap.signature === UniswapV3SwapV3Signature.exactOutput ||
    swap.signature === UniswapV3SwapSignature.exactInput ||
    swap.signature === UniswapV3SwapSignature.exactOutput
  )
}
