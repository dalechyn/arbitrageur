export enum UniswapV2Signature {
  addLiquidity = 'e8e33700',
  addLiquidityETH = 'f305d719',
  removeLiquidity = 'baa2abde',
  removeLiquidityETH = '02751cec',
  removeLiquidityETHSupportingFeeOnTransferTokens = 'af2979eb',
  removeLiquidityETHWithPermit = 'ded9382a',
  removeLiquidityETHWithPermitSupportingFeeOnTransferTokens = '5b0d5984',
  removeLiquidityWithPermit = '2195995c'
}

export const UNISWAP_V2_SIGNATURES = Object.values(UniswapV2Signature)

export const isUniswapV2Signature = (signature: string) =>
  UNISWAP_V2_SIGNATURES.includes(signature as UniswapV2Signature)
