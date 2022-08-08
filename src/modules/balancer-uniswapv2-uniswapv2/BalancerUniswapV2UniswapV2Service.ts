import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { injectable } from 'inversify'
import JSBI from 'jsbi'

import { AbstractBalancer, BalancerWrongPoolsFedError, BalanceResult } from '../balancer'
import { PoolV2WithContract, PoolWithContract, DEXType } from '../common'
import { BunyanLogger } from '../logger'
import { JSBIUtils } from '../utils'

@injectable()
export class BalancerUniswapV2UniswapV2Service implements AbstractBalancer {
  constructor(private readonly logger: BunyanLogger) {}

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
   * @param firstPair Pool A
   * @param secondPair Pool B
   * @param amountIn Amount to arbitrage
   */
  private calculateProfit(
    firstPair: Pair,
    secondPair: Pair,
    amountIn: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, CurrencyAmount<Token>] {
    const [amountB] = firstPair.getOutputAmount(amountIn)
    const [amountC] = secondPair.getOutputAmount(amountB)
    return [amountC.subtract(amountIn), amountB]
  }

  private v2ToV2(
    firstPoolV2Info: PoolV2WithContract,
    secondPoolV2Info: PoolV2WithContract,
    tokenA: Token
  ) {
    const tokenB = firstPoolV2Info.token0.equals(tokenA)
      ? firstPoolV2Info.token1
      : firstPoolV2Info.token0
    this.logger.info(
      `Balancing pools, V2 price: ${firstPoolV2Info.priceOf(tokenA).toSignificant(6)} ${
        tokenB.symbol
      }/${tokenA.symbol}, V2 price: ${secondPoolV2Info.priceOf(tokenA).toSignificant(6)} ${
        tokenB.symbol
      }/${tokenA.symbol}`
    )
    const [reservesIn0, reservesOut0] = this.getReserves(tokenA, firstPoolV2Info)
    const [reservesOut1, reservesIn1] = this.getReserves(tokenA, secondPoolV2Info)

    const x = this.calculateMaxPoint(
      reservesIn0,
      reservesOut0,
      reservesIn1,
      reservesOut1,
      firstPoolV2Info.feeNumerator,
      firstPoolV2Info.feeDenominator,
      secondPoolV2Info.feeNumerator,
      secondPoolV2Info.feeDenominator
    )
    // convert to an amount without a reminder - integer division problem
    const amountInFalsy = CurrencyAmount.fromRawAmount(tokenA, x)
    const amountIn = firstPoolV2Info.getInputAmount(
      firstPoolV2Info.getOutputAmount(amountInFalsy)[0]
    )[0]
    const [maxProfit] = this.calculateProfit(firstPoolV2Info, secondPoolV2Info, amountIn)

    if (maxProfit.lessThan(0)) throw new Error('not profitable')
    this.logger.info('Finished! Amount:', x.toString(), ' weiWETH')
    this.logger.info('Finished! Profit:', maxProfit.toSignificant(), ' WETH')

    return {
      from: {
        address: firstPoolV2Info.contract.address,
        type: firstPoolV2Info.type,
        feeNumerator: firstPoolV2Info.feeNumerator,
        feeDenominator: firstPoolV2Info.feeDenominator
      },
      to: {
        address: secondPoolV2Info.contract.address,
        type: secondPoolV2Info.type,
        feeNumerator: secondPoolV2Info.feeNumerator,
        feeDenominator: secondPoolV2Info.feeDenominator
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
    const zeroForOne = poolA.priceOf(baseToken).lessThan(poolB.priceOf(baseToken))
    if (poolA.type === DEXType.UNISWAPV2 && poolB.type === DEXType.UNISWAPV2)
      return Promise.resolve(
        this.v2ToV2(zeroForOne ? poolA : poolB, zeroForOne ? poolB : poolA, baseToken)
      )

    throw new BalancerWrongPoolsFedError(poolA.type, poolB.type)
  }
}
