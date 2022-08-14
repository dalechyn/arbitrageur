import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { injectable } from 'inversify'
import JSBI from 'jsbi'

import { AbstractBalancer, BalancerWrongPoolsFedError, BalanceResult } from '../balancer'
import { PoolV2WithContract, PoolWithContract, DEXType } from '../common'
import { BunyanLogger } from '../logger'
import { JSBIUtils } from '../utils'

import { BalancerUniswapV2UniswapV2NotProfitableError } from './errors'

@injectable()
export class BalancerUniswapV2UniswapV2Service implements AbstractBalancer {
  constructor(private readonly logger?: BunyanLogger) {}

  /**
   * Returns reserves by TokenIn
   * @param tokenIn TokenIn
   * @param param1 PoolV2 info
   * @returns
   */
  private getReserves(
    tokenIn: Token,
    { token0, reserve0, reserve1 }: PoolV2WithContract
  ): [JSBI, JSBI] {
    const zeroForOne = tokenIn.equals(token0)
    const reserves = [reserve0, reserve1]
    return (zeroForOne ? reserves : reserves.reverse()).map((r) => r.quotient) as [JSBI, JSBI]
  }

  /**
   * Returns the result of derivative of profit from pools estabilishment by price
   *
   * Final look of the formula: https://www.wolframalpha.com/input?i=%28f_1+f_2+f_3+f_4+r_1+r_2+r_3+r_4%29%2F%28f_1+f_3+r_2+x+%2B+f_4+r_3+%28f_2+r_1+%2B+f_1+x%29%29%5E2+-+1%3D+0
   *
   * @param reservesIn0 Reserves of Pool A in token that goes in
   * @param reservesOut0 Reserves of Pool A in token that goes out
   * @param reservesIn1 Reserves of Pool B in token that goes in
   * @param reservesOut1 Reserves of Pool B in token that goes out
   * @param FEE_NUMERATOR_0 Fee numerator of Pool A
   * @param FEE_DENOMINATOR_0 Fee denominator of Pool A
   * @param FEE_NUMERATOR_1 Fee numerator of Pool B
   * @param FEE_DENOMINATOR_1 Fee denominator of Pooe B
   */
  private calculateMaxPoint(
    reservesIn0: JSBI,
    reservesOut0: JSBI,
    reservesIn1: JSBI,
    reservesOut1: JSBI,
    FEE_NUMERATOR_0: JSBI,
    FEE_DENOMINATOR_0: JSBI,
    FEE_NUMERATOR_1: JSBI,
    FEE_DENOMINATOR_1: JSBI
  ): JSBI {
    const numerator = JSBI.subtract(
      JSBIUtils.sqrt(
        [
          reservesIn0,
          reservesOut0,
          reservesIn1,
          reservesOut1,
          FEE_NUMERATOR_0,
          FEE_DENOMINATOR_0,
          FEE_NUMERATOR_1,
          FEE_DENOMINATOR_1
        ].reduce((acc, el) => JSBI.multiply(acc, el), JSBI.BigInt(1))
      ),
      JSBI.multiply(
        reservesIn0,
        JSBI.multiply(reservesIn1, JSBI.multiply(FEE_DENOMINATOR_0, FEE_DENOMINATOR_1))
      )
    )

    const denominator = JSBI.multiply(
      FEE_NUMERATOR_0,
      JSBI.add(
        JSBI.multiply(reservesOut0, FEE_NUMERATOR_1),
        JSBI.multiply(reservesIn1, FEE_DENOMINATOR_1)
      )
    )

    return JSBI.divide(numerator, denominator)
  }

  /**
   * Returns profit of arbitrage given the input amount
   * @param from Pool From
   * @param to Pool To
   * @param amountIn Amount to arbitrage
   */
  private calculateProfit(
    from: Pair,
    to: Pair,
    amountIn: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, CurrencyAmount<Token>] {
    const [amountB] = from.getOutputAmount(amountIn)
    const [amountC] = to.getOutputAmount(amountB)
    return [amountC.subtract(amountIn), amountB]
  }

  private v2ToV2(from: PoolV2WithContract, to: PoolV2WithContract, tokenA: Token) {
    const tokenB = from.token0.equals(tokenA) ? from.token1 : from.token0
    this.logger?.info(
      `Balancing pools, V2 price: ${from.priceOf(tokenA).toSignificant(6)} ${tokenB.symbol}/${
        tokenA.symbol
      }, V2 price: ${to.priceOf(tokenA).toSignificant(6)} ${tokenB.symbol}/${tokenA.symbol}`
    )
    const [reservesIn0, reservesOut0] = this.getReserves(tokenA, from)
    const [reservesOut1, reservesIn1] = this.getReserves(tokenA, to)

    const x = this.calculateMaxPoint(
      reservesIn0,
      reservesOut0,
      reservesIn1,
      reservesOut1,
      from.feeNumerator,
      from.feeDenominator,
      to.feeNumerator,
      to.feeDenominator
    )
    // convert to an amount without a reminder - integer division problem
    const amountInFalsy = CurrencyAmount.fromRawAmount(tokenA, x)
    const amountIn = from.getInputAmount(from.getOutputAmount(amountInFalsy)[0])[0]
    const [maxProfit] = this.calculateProfit(from, to, amountIn)

    if (maxProfit.lessThan(0) || amountIn.lessThan(0))
      throw new BalancerUniswapV2UniswapV2NotProfitableError(tokenA, tokenB)
    this.logger?.info('Finished! Amount:', amountIn.toSignificant(), tokenA.symbol)
    this.logger?.info('Finished! Profit:', maxProfit.toSignificant(), tokenA.symbol)

    return {
      from: {
        address: from.contract.address,
        type: from.type,
        feeNumerator: from.feeNumerator,
        feeDenominator: from.feeDenominator
      },
      to: {
        address: to.contract.address,
        type: to.type,
        feeNumerator: to.feeNumerator,
        feeDenominator: to.feeDenominator
      },
      amountIn,
      profit: maxProfit
    }
  }

  balance(
    poolA: PoolWithContract,
    poolB: PoolWithContract,
    baseToken: Token
  ): Promise<BalanceResult> {
    const zeroForOne = poolA.priceOf(baseToken).greaterThan(poolB.priceOf(baseToken))
    if (poolA.type === DEXType.UNISWAPV2 && poolB.type === DEXType.UNISWAPV2)
      return Promise.resolve(
        this.v2ToV2(zeroForOne ? poolA : poolB, zeroForOne ? poolB : poolA, baseToken)
      )

    throw new BalancerWrongPoolsFedError(poolA.type, poolB.type)
  }
}
