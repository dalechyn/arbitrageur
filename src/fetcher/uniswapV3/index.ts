import { Token } from '@uniswap/sdk-core'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import UniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { ADDRESS_ZERO, FeeAmount, Pool, Tick, TICK_SPACINGS, TickMath } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'

import MultiCallTickLens from '../../../deployments/goerli/MulticallTickLens.json'
import { GetPriceWithPool } from '../interfaces/getTokenPrices'

import { FEE_AMOUNTS, MULTI_CALL_TICK_LENS_ADDRESS, UNISWAP_V3_FACTORY_ADDRESS } from '~constants'
import { TickLensDataProvider } from '~fetcher/uniswapV3/tickLensDataProvider'
import { ethProvider } from '~utils'

const factory = new Contract(UNISWAP_V3_FACTORY_ADDRESS, UniswapV3Factory.abi, ethProvider)

const bitmapIndex = (tick: number, tickSpacing: number) => {
  return Math.floor(tick / tickSpacing / 256)
}

// const numSurroundingTicks = 125

export const UniswapV3: GetPriceWithPool = {
  async getPoolWithPrices(baseToken: Token, queryToken: Token) {
    // Get all Pool addresses regarding the fees
    const poolAddressesWithFees = (
      await Promise.all(
        FEE_AMOUNTS.map(async (fee) => ({
          fee: fee as FeeAmount,
          address: await factory.getPool(baseToken.address, queryToken.address, fee)
        }))
      )
    ).filter(({ address }) => address !== ADDRESS_ZERO)

    if (poolAddressesWithFees.length === 0) {
      console.warn(
        `UniswapV3: Any pool with pair ${baseToken.symbol}-${queryToken.symbol} does not exist`
      )
      return []
    }

    return await Promise.all(
      poolAddressesWithFees.map(async ({ fee, address }) => {
        console.info(
          `UniswapV3: Checking ${baseToken.symbol}-${queryToken.symbol} (${
            fee / 10_000
          }% Fee): ${address}`
        )
        const poolContract = new Contract(address, UniswapV3Pool.abi, ethProvider)
        const { sqrtPriceX96, tick } = await poolContract.slot0()
        const poolLiquidity = await poolContract.liquidity()

        // taken from https://github.com/Uniswap/interface/blob/1303416eca93c931dc45cc05d7067bf771649633/src/hooks/usePoolTickData.ts#L64
        const minIndex = bitmapIndex(
          TickMath.MIN_TICK, // tick - numSurroundingTicks * TICK_SPACINGS[fee],
          TICK_SPACINGS[fee]
        )
        const maxIndex = bitmapIndex(
          TickMath.MAX_TICK, // tick + numSurroundingTicks * TICK_SPACINGS[fee],
          TICK_SPACINGS[fee]
        )

        const multiTickLens = new Contract(
          MULTI_CALL_TICK_LENS_ADDRESS,
          MultiCallTickLens.abi,
          ethProvider
        )

        const result: any[] = await multiTickLens.getPopulatedTicks(address, minIndex, maxIndex)
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
        return { price: pool.priceOf(queryToken), contract: poolContract, pool }
      })
    )
  }
}