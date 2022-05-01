/**
 * @description Unwraps Uniswap-V3 SDK's FeeAmount
 */
import { FeeAmount } from '@uniswap/v3-sdk'

export const FEE_AMOUNTS: number[] = Object.keys(FeeAmount)
  .filter((k) => typeof FeeAmount[k as any] === 'number')
  .map((k) => FeeAmount[k as any] as unknown as number)
