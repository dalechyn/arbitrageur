import { Token } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'

import { DEX } from '../../common'
import { UniswapV3SwapV2Signature } from '../../mempool-uniswapv3'

import { UniswapV2SwapSignature } from './UniswapV2SwapSignature'

type UniswapV2SwapMeta = {
  dex: DEX.UniswapV2 | DEX.SushiSwap
  hash?: string
  from: string
  path: Token[]
  to: string
}

type UniswapV2ExactETHInSwap = {
  signature:
    | UniswapV2SwapSignature.swapExactETHForTokens
    | UniswapV2SwapSignature.swapExactETHForTokensSupportingFeeOnTransferTokens
  amountOutMin: BigNumber
  value: BigNumber
  deadline: BigNumber
} & UniswapV2SwapMeta

type UniswapV2ETHInExactTokensOutSwap = {
  signature: UniswapV2SwapSignature.swapETHForExactTokens
  amountOut: BigNumber
  value: BigNumber
  deadline: BigNumber
} & UniswapV2SwapMeta

type UniswapV2ExactTokensInSwap = {
  amountIn: BigNumber
  amountOutMin: BigNumber
} & (
  | {
      signature: UniswapV3SwapV2Signature.swapExactTokensForTokens
    }
  | {
      deadline: BigNumber
      signature:
        | UniswapV2SwapSignature.swapExactTokensForETH
        | UniswapV2SwapSignature.swapExactTokensForETHSupportingFeeOnTransferTokens
        | UniswapV2SwapSignature.swapExactTokensForTokens
        | UniswapV2SwapSignature.swapExactTokensForTokensSupportingFeeOnTransferTokens
    }
) &
  UniswapV2SwapMeta

type UniswapV2ExactTokensOutSwap = {
  amountInMax: BigNumber
  amountOut: BigNumber
} & (
  | {
      signature: UniswapV3SwapV2Signature.swapTokensForExactTokens
    }
  | {
      deadline: BigNumber
      signature:
        | UniswapV2SwapSignature.swapTokensForExactETH
        | UniswapV2SwapSignature.swapTokensForExactTokens
    }
) &
  UniswapV2SwapMeta

export type UniswapV2Swap =
  | UniswapV2ETHInExactTokensOutSwap
  | UniswapV2ExactETHInSwap
  | UniswapV2ExactTokensInSwap
  | UniswapV2ExactTokensOutSwap

export function isUniswapV2ETHInExactTokensOutSwap(
  swap: UniswapV2Swap
): swap is UniswapV2ETHInExactTokensOutSwap {
  return (
    swap.signature === UniswapV2SwapSignature.swapExactETHForTokens ||
    swap.signature === UniswapV2SwapSignature.swapExactETHForTokensSupportingFeeOnTransferTokens
  )
}

export function isUniswapV2ExactTokensInSwap(
  swap: UniswapV2Swap
): swap is UniswapV2ExactTokensInSwap {
  return (
    swap.signature === UniswapV2SwapSignature.swapExactTokensForETHSupportingFeeOnTransferTokens ||
    swap.signature === UniswapV2SwapSignature.swapExactTokensForTokens ||
    swap.signature ===
      UniswapV2SwapSignature.swapExactTokensForTokensSupportingFeeOnTransferTokens ||
    swap.signature === UniswapV3SwapV2Signature.swapExactTokensForTokens ||
    swap.signature === UniswapV2SwapSignature.swapExactTokensForETH
  )
}

export function isUniswapV2ExactOutSignature(
  swap: UniswapV2Swap
): swap is UniswapV2ExactTokensOutSwap {
  return (
    swap.signature === UniswapV2SwapSignature.swapETHForExactTokens ||
    swap.signature === UniswapV2SwapSignature.swapTokensForExactETH ||
    swap.signature === UniswapV2SwapSignature.swapTokensForExactTokens ||
    swap.signature === UniswapV3SwapV2Signature.swapTokensForExactTokens
  )
}
