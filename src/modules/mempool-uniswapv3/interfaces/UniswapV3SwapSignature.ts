export enum UniswapV3SwapSignature {
  exactInput = 'c04b8d59',
  exactOutput = 'f28c0498',
  exactInputSingle = '414bf389',
  exactOutputSingle = 'db3e2198'
}

export const UNISWAP_V3_SWAP_SIGNATURES = Object.values(UniswapV3SwapSignature)

export const isUniswapV3SwapSignature = (signature: string) =>
  UNISWAP_V3_SWAP_SIGNATURES.includes(signature as UniswapV3SwapSignature)
