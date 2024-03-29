export enum UniswapV3Signature {
  approveMax = '571ac8b',
  approveMaxMinusOne = 'cab372ce',
  approveZeroThanMax = '639d71a9',
  approveZeroThenMaxMinusOne = 'ab3fdd5',
  callPositionManager = 'b3a2af13',
  checkOracleSlippage_1 = 'efdeed8e',
  checkOracleSlippage_2 = 'f25801a7',
  getApprovalType = 'dee00f35',
  increaseLiquidity = 'f100b205',
  mint = '11ed56c9',
  multicall_1 = '1f0464d1',
  multicall_2 = '5ae401dc',
  multicall_3 = 'ac9650d8',
  pull = 'f2d5d56b',
  refundETH = '12210e8a',
  selfPermit = 'f3995c67',
  selfPermitAllowed = '4659a494',
  selfPermitAllowedIfNeccesary = 'a4a78f0c',
  selfPermitIfNeccessary = 'c2e3140a',
  sweepToken_1 = 'df2ab5bb',
  sweepToken_2 = 'e90a182f',
  sweepTokenWithFee_1 = '3068c554',
  sweepTokenWithFee_2 = 'e0e189a0',
  uniswapV3Callback = 'fa461e33',
  unwrapWETH9_1 = '49404b7c',
  unwrapWETH9_2 = '49616997',
  unwrapWETH9WithFee_1 = '9b2c0a37',
  unwrapWETH9WithFee_2 = 'd4ef38de',
  wrapETH = '1c58db4f'
}

export const UNISWAP_V3_SIGNATURES = Object.values(UniswapV3Signature)

export const isUniswapV3Signature = (signature: string) =>
  UNISWAP_V3_SIGNATURES.includes(signature as UniswapV3Signature)
