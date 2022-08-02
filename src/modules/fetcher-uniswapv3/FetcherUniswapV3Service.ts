import MultiCallTickLens from '../../../deployments/goerli/MulticallTickLens.json'
import { ConfigService } from '../config'
import { AbstractFetcher } from '../fetcher'
import { DEXType, PoolWithContract } from '../interfaces'
import { BunyanLogger } from '../logger'
import { ProviderService } from '../provider'

import { TickLensDataProvider } from './utils'

import { BigintIsh, Token } from '@uniswap/sdk-core'
import UniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { Pool, Tick, TickMath, TICK_SPACINGS } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'
import { injectable } from 'inversify'

@injectable()
export class FetcherUniswapV3Service implements AbstractFetcher {
  constructor(
    private readonly logger: BunyanLogger,
    private readonly config: ConfigService,
    private readonly providerService: ProviderService
  ) {}

  /**
   * Returns index in the bitmap converted from tick and tick spacing
   * @param tick Tick
   * @param tickSpacing Tick spacing
   */
  private bitmapIndex(tick: number, tickSpacing: number): number {
    return Math.floor(tick / tickSpacing / 256)
  }

  async fetch(poolAddress: string, baseToken: Token, quoteToken: Token): Promise<PoolWithContract> {
    this.logger.info(`UniswapV3: Checking ${baseToken.symbol}-${quoteToken.symbol}: ${poolAddress}`)
    const multiTickLens = new Contract(
      this.config.get('multiCallTickerLensAddress'),
      MultiCallTickLens.abi,
      this.providerService
    )
    const [fee, sqrtPriceX96, tick, poolLiquidity]: [
      keyof typeof TICK_SPACINGS,
      BigintIsh,
      number,
      BigintIsh
    ] = await multiTickLens.getNeededV3Info(poolAddress)
    const poolContract = new Contract(poolAddress, UniswapV3Pool.abi, this.providerService)

    // taken from https://github.com/Uniswap/interface/blob/1303416eca93c931dc45cc05d7067bf771649633/src/hooks/usePoolTickData.ts#L64
    const minIndex = this.bitmapIndex(
      TickMath.MIN_TICK, // tick - numSurroundingTicks * TICK_SPACINGS[fee],
      TICK_SPACINGS[fee]
    )
    const maxIndex = this.bitmapIndex(
      TickMath.MAX_TICK, // tick + numSurroundingTicks * TICK_SPACINGS[fee],
      TICK_SPACINGS[fee]
    )

    const result: any[] = await multiTickLens.getPopulatedTicks(poolAddress, minIndex, maxIndex)
    const populatedTicks = result.map(
      (el) =>
        new Tick({
          index: el.tick,
          liquidityNet: el.liquidityNet,
          liquidityGross: el.liquidityGross
        })
    )

    const pool = new Pool(
      baseToken,
      quoteToken,
      fee,
      sqrtPriceX96,
      poolLiquidity,
      tick,
      new TickLensDataProvider(
        populatedTicks.sort((a, b) => a.index - b.index),
        TICK_SPACINGS[fee]
      )
    )
    return {
      price: pool.priceOf(quoteToken),
      contract: poolContract,
      pool,
      type: DEXType.UNISWAPV3
    }
  }
}
