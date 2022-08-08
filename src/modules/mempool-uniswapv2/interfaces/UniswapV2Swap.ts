import { Token } from '@uniswap/sdk-core'
import BigNumber from 'bignumber.js'

import { DEX } from '../../common'
import { UniswapV3SwapV2Signature } from '../../mempool-uniswapv3'

import { UniswapV2SwapSignature } from './UniswapV2SwapSignature'

export type UniswapV2Swap = {
  dex: DEX.UniswapV2 | DEX.SushiSwap
  hash?: string
  from: string
  path: Token[]
  to: string
} & (
  | {
      method: UniswapV3SwapV2Signature.swapExactTokensForTokens
      amountIn: BigNumber
      amountOutMin: BigNumber
    }
  | {
      method: UniswapV3SwapV2Signature.swapTokensForExactTokens
      amountInMax: BigNumber
      amountOut: BigNumber
    }
  | ({ deadline: BigNumber } & (
      | {
          value: BigNumber
          method: UniswapV2SwapSignature.swapETHForExactTokens
          amountOut: BigNumber
        }
      | {
          method:
            | UniswapV2SwapSignature.swapExactETHForTokens
            | UniswapV2SwapSignature.swapExactETHForTokensSupportingFeeOnTransferTokens
          amountOutMin: BigNumber
          value: BigNumber
        }
      | {
          method:
            | UniswapV2SwapSignature.swapExactTokensForETH
            | UniswapV2SwapSignature.swapExactTokensForETHSupportingFeeOnTransferTokens
            | UniswapV2SwapSignature.swapExactTokensForTokens
            | UniswapV2SwapSignature.swapExactTokensForTokensSupportingFeeOnTransferTokens
          amountIn: BigNumber
          amountOutMin: BigNumber
        }
      | {
          method:
            | UniswapV2SwapSignature.swapTokensForExactETH
            | UniswapV2SwapSignature.swapTokensForExactTokens
          amountInMax: BigNumber
          amountOut: BigNumber
        }
    ))
)
