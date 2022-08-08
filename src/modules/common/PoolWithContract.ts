import { BigintIsh, CurrencyAmount, Price, Token } from '@uniswap/sdk-core'
import { Pair } from '@uniswap/v2-sdk'
import { FeeAmount, Pool, Tick, TickConstructorArgs, TickDataProvider } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'
import JSBI from 'jsbi'

import { DEX } from './DEX'
import { DEXType } from './DEXType'

export type PoolWithContractMeta = {
  contract: Contract
  price: Price<Token, Token>
}

export class PoolV3WithContract extends Pool {
  public readonly type = DEXType.UNISWAPV3
  constructor(
    public readonly contract: Contract,
    public readonly tokenA: Token,
    public readonly tokenB: Token,
    fee: FeeAmount,
    public readonly dex: DEX,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    tickCurrent: number,
    public readonly ticks?: TickDataProvider | Array<Tick | TickConstructorArgs> | undefined
  ) {
    super(tokenA, tokenB, fee, sqrtRatioX96, liquidity, tickCurrent, ticks)
  }

  async getInputAmount(
    outputAmount: CurrencyAmount<Token>,
    sqrtPriceLimitX96?: JSBI | undefined
  ): Promise<[CurrencyAmount<Token>, PoolV3WithContract]> {
    const [inputAmount, pool] = await super.getInputAmount(outputAmount, sqrtPriceLimitX96)
    return [
      inputAmount,
      new PoolV3WithContract(
        this.contract,
        this.tokenA,
        this.tokenB,
        this.fee,
        this.dex,
        pool.sqrtRatioX96,
        pool.liquidity,
        pool.tickCurrent,
        this.ticks
      )
    ]
  }

  async getOutputAmount(
    inputAmount: CurrencyAmount<Token>,
    sqrtPriceLimitX96?: JSBI | undefined
  ): Promise<[CurrencyAmount<Token>, PoolV3WithContract]> {
    const [outputAmount, pool] = await super.getOutputAmount(inputAmount, sqrtPriceLimitX96)

    return [
      outputAmount,
      new PoolV3WithContract(
        this.contract,
        this.tokenA,
        this.tokenB,
        this.fee,
        this.dex,
        pool.sqrtRatioX96,
        pool.liquidity,
        pool.tickCurrent,
        this.ticks
      )
    ]
  }
}

export class PoolV2WithContract extends Pair {
  public readonly type = DEXType.UNISWAPV2

  constructor(
    currencyAmountA: CurrencyAmount<Token>,
    currencyAmountB: CurrencyAmount<Token>,
    public readonly contract: Contract,
    public readonly dex: DEX,
    feeNumerator?: JSBI,
    feeDenominator?: JSBI
  ) {
    super(currencyAmountA, currencyAmountB, feeNumerator, feeDenominator)
  }

  getInputAmount(outputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, PoolV2WithContract] {
    const [inputAmount] = super.getInputAmount(outputAmount)
    return [
      inputAmount,
      new PoolV2WithContract(
        this.reserveOf(inputAmount.currency).add(inputAmount),
        this.reserveOf(outputAmount.currency).subtract(outputAmount),
        this.contract,
        this.dex,
        this.feeNumerator,
        this.feeDenominator
      )
    ]
  }

  getOutputAmount(inputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, PoolV2WithContract] {
    const [outputAmount] = super.getOutputAmount(inputAmount)
    return [
      outputAmount,
      new PoolV2WithContract(
        this.reserveOf(inputAmount.currency).add(inputAmount),
        this.reserveOf(outputAmount.currency).subtract(outputAmount),
        this.contract,
        this.dex,
        this.feeNumerator,
        this.feeDenominator
      )
    ]
  }
}

export type PoolWithContract = PoolV3WithContract | PoolV2WithContract
