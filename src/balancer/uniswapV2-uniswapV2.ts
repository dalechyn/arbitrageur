import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import BN, { BigNumber } from 'bignumber.js'

import { SupportedPoolWithContract } from '~interfaces'

const F = new BN(0.997) // 997n

// function newtonIteration(n: bigint, x0: bigint): bigint {
//   const x1 = (n / x0 + x0) >> 1n
//   if (x0 === x1 || x0 === x1 - 1n) return x0
//   return newtonIteration(n, x1)
// }

// function sqrt(value: bigint): bigint {
//   if (value < 0n) throw Error('square root of negative numbers is not supported')
//   if (value < 2n) return value

//   return newtonIteration(value, 1n)
// }

// function pow(v: bigint, by: number = 2): bigint {
//   return v ** BigInt(by)
// }

function getReserves(
  token: Token,
  { pool: { token0, reserve0, reserve1 } }: SupportedPoolWithContract<Pair>
) {
  const streight = token.equals(token0)
  const reserves = [reserve0, reserve1].map((v) => new BN(v.quotient.toString(10)))

  return streight ? reserves : reserves.reverse()
}

// function calculateProfit(x: bigint, rA1: bigint, rB1: bigint, rA2: bigint, rB2: bigint) {
//   return (x * rB1 * rA2 * pow(F)) / (rA1 * rB2 + x * F * (rA2 * F + rA1)) - x
// }

// function calculateMaxPoint(rA1: bigint, rB1: bigint, rA2: bigint, rB2: bigint) {
//   const nom = F * sqrt(rA1 * rA2 * rB1 * rB2) - rA1 * rB2
//   const denom = F * (rA2 * F + rA1)
//   return nom / denom
// }

// https://www.wolframalpha.com/input?i=%28b_1+b_2+f%5E2+%28a_1+%28a_2+-+2+x%29+-+2+f+x%5E2%29+-+b_2%5E2+%28a_1+%2B+f+x%29%5E2+%2B+b_1%5E2+f%5E4+%28-x%5E2%29%29%2F%28b_2+%28a_1+%2B+f+x%29+%2B+b_1+f%5E2+x%29%5E2%3D0
function calculateMaxPoint(rA1: BigNumber, rB1: BigNumber, rA2: BigNumber, rB2: BigNumber) {
  const nom = rA1.times(rA2).times(rB1).times(rB2).sqrt().times(F).minus(rA1.times(rB2))
  const denom = F.times(rB1.times(F).plus(rB2))

  return nom.div(denom).integerValue()
}

// https://www.wolframalpha.com/input?i=%28a_2+b_1+f%5E2+x%29%2F%28a_1+b_2+%2B+b_1+f%5E2+x+%2B+b_2+f+x%29+-+x%2C+a_1%3D50%2C+b_1%3D100%2C+a_2%3D700%2C+b_2%3D800%2C+f%3D0.997
function calculateProfit(
  x: BigNumber,
  rA1: BigNumber,
  rB1: BigNumber,
  rA2: BigNumber,
  rB2: BigNumber
) {
  const nom = rA2.times(rB1).times(x).times(F.pow(2))
  const denom = rB2.times(rA1.plus(x.times(F))).plus(rB1.times(x).times(F.pow(2)))

  return nom.div(denom).minus(x).integerValue()
}

export async function balanceUniswapV2ToUniswapV2(
  firstPoolV2Info: SupportedPoolWithContract<Pair>,
  secondPoolV2Info: SupportedPoolWithContract<Pair>,
  tokenA: Token
) {
  const [rA1, rB1] = getReserves(tokenA, firstPoolV2Info)
  const [rA2, rB2] = getReserves(tokenA, secondPoolV2Info)

  const x = calculateMaxPoint(rA1, rB1, rA2, rB2)
  const maxProfit = calculateProfit(x, rA1, rB1, rA2, rB2)

  console.log(
    'Finished! Amount:',
    CurrencyAmount.fromRawAmount(tokenA, x.toFixed()).toSignificant(),
    ' WETH'
  )
  console.log(
    'Finished! Profit:',
    CurrencyAmount.fromRawAmount(tokenA, maxProfit.toFixed()).toSignificant(),
    ' WETH'
  )

  return [
    secondPoolV2Info.contract.address,
    firstPoolV2Info.contract.address,
    CurrencyAmount.fromRawAmount(tokenA, x.toFixed())
  ]
}
