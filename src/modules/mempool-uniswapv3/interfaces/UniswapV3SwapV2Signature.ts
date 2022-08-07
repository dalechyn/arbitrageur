export enum UniswapV3SwapV2Signature {
  swapExactTokensForTokens = '472b43f3',
  swapTokensForExactTokens = '42712a67'
}

export const UNISWAP_V3_SWAP_V2_SIGNATURES = Object.values(UniswapV3SwapV2Signature)

export const isUniswapV3SwapV2Signature = (signature: string) =>
  UNISWAP_V3_SWAP_V2_SIGNATURES.includes(signature as UniswapV3SwapV2Signature)
