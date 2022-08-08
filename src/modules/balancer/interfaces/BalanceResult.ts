import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

import { DEXType } from '../../common'

type BalanceUniswapV2Info = {
  type: DEXType.UNISWAPV2
  address: string
  feeNumerator: JSBI
  feeDenominator: JSBI
}

type BalanceUniswapV3Info = {
  type: DEXType.UNISWAPV3
  address: string
}

export type BalanceResult = {
  from: BalanceUniswapV2Info | BalanceUniswapV3Info
  to: BalanceUniswapV2Info | BalanceUniswapV3Info
  amountIn: CurrencyAmount<Token>
  profit: CurrencyAmount<Token>
}
