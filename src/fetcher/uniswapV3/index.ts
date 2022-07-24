import { Provider } from '@ethersproject/abstract-provider'
import { BigintIsh, Token } from '@uniswap/sdk-core'
import UniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { Pool, Tick, TICK_SPACINGS, TickMath } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'
import { Logger } from 'pino'

import MultiCallTickLens from '../../../deployments/goerli/MulticallTickLens.json'

import { config } from '~config'
import { GetPoolWithPricesFn } from '~fetcher/interfaces'
import { TickLensDataProvider } from '~fetcher/uniswapV3/tickLensDataProvider'
import { DEXType } from '~utils'

const bitmapIndex = (tick: number, tickSpacing: number) => {
  return Math.floor(tick / tickSpacing / 256)
}

export const getUniswapV3PoolWithPrices: GetPoolWithPricesFn = async (
  logger: Logger,
  poolAddress: string,
  baseToken: Token,
  queryToken: Token,
  provider: Provider
) => {
  logger.info(`UniswapV3: Checking ${baseToken.symbol}-${queryToken.symbol}: ${poolAddress}`)
  const multiTickLens = new Contract(
    config.get('multiCallTickerLensAddress'),
    MultiCallTickLens.abi,
    provider
  )
  const [fee, sqrtPriceX96, tick, poolLiquidity]: [
    keyof typeof TICK_SPACINGS,
    BigintIsh,
    number,
    BigintIsh
  ] = await multiTickLens.getNeededV3Info(poolAddress)
  const poolContract = new Contract(poolAddress, UniswapV3Pool.abi, provider)

  // taken from https://github.com/Uniswap/interface/blob/1303416eca93c931dc45cc05d7067bf771649633/src/hooks/usePoolTickData.ts#L64
  const minIndex = bitmapIndex(
    TickMath.MIN_TICK, // tick - numSurroundingTicks * TICK_SPACINGS[fee],
    TICK_SPACINGS[fee]
  )
  const maxIndex = bitmapIndex(
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
    queryToken,
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
    price: pool.priceOf(queryToken),
    contract: poolContract,
    pool,
    type: DEXType.UNISWAPV3
  }
}
