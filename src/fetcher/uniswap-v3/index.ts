import { Token } from '@uniswap/sdk-core'
import { ADDRESS_ZERO, Pool } from '@uniswap/v3-sdk'
import { Contract } from 'ethers'

import { FEE_AMOUNTS, UNISWAP_V3_FACTORY_ADDRESS } from '../../constants'
import { ethProvider } from '../../utils'
import { GetTokenPrice } from '../interfaces/getTokenPrice'

import UniswapV3FactoryABI from './abi/UniswapV3Factory.json'
import UniswapV3PoolABI from './abi/UniswapV3Pool.json'

const factory = new Contract(UNISWAP_V3_FACTORY_ADDRESS, UniswapV3FactoryABI, ethProvider)

export const UniswapV3: GetTokenPrice = {
  async getTokenPrice(tokenA: Token, tokenB: Token, lowest = false) {
    // Get all Pool addresses regarding the fees
    const poolAddressesWithFees = (
      await Promise.all(
        FEE_AMOUNTS.map(async (fee) => ({
          fee,
          address: await factory.getPool(tokenA.address, tokenB.address, fee)
        }))
      )
    ).filter(({ address }) => address !== ADDRESS_ZERO)

    if (poolAddressesWithFees.length === 0) {
      console.warn(`UniswapV3: Any pool with pair ${tokenA.symbol}-${tokenB.symbol} does not exist`)
      return null
    }

    const prices = await Promise.all(
      poolAddressesWithFees.map(async ({ fee, address }) => {
        console.info(
          `UniswapV3: Checking ${tokenA.symbol}-${tokenB.symbol} (${fee / 10_000}% Fee): ${address}`
        )
        const poolContract = new Contract(address, UniswapV3PoolABI, ethProvider)
        const { sqrtPriceX96, tick } = await poolContract.slot0()
        const poolLiquidity = await poolContract.liquidity()
        const pool = new Pool(tokenA, tokenB, fee, sqrtPriceX96, poolLiquidity, tick)
        return pool.token1Price
      })
    )
    const sortedPrices = prices.sort((p1, p2) =>
      p1.subtract(p2)[lowest ? 'lessThan' : 'greaterThan'](0) ? 1 : -1
    )

    return sortedPrices[0]
  }
}
