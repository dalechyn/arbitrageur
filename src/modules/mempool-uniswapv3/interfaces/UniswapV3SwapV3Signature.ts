export enum UniswapV3SwapV3Signature {
  exactInput = 'b858183f',
  exactInputSingle = '04e45aaf',
  exactOutput = '09b81346',
  exactOutputSingle = '5023b4df'
}

export const UNISWAP_V3_SWAP_V3_SIGNATURES = Object.values(UniswapV3SwapV3Signature)

export const isUniswapV3SwapV3Signature = (signature: string) =>
  UNISWAP_V3_SWAP_V3_SIGNATURES.includes(signature as UniswapV3SwapV3Signature)
