// import assert from 'assert'

// import { CurrencyAmount, Token } from '@uniswap/sdk-core'
// import { Contract } from 'ethers'
import { describe, it } from 'mocha'

// import { DEX, PoolV2WithContract } from '../common'

// import { BalancerUniswapV2UniswapV3Service } from './BalancerUniswapV2UniswapV3Service'

describe('BalancerUniswapV2UniswapV3', () => {
  it('should calculate the arbitrage results correctly', async () => {
    //   const balancer = new BalancerUniswapV2UniswapV3Service()
    //   const tokenA = new Token(1, '0x0000000000000000000000000000000000000001', 9, 'TokenA')
    //   const tokenB = new Token(1, '0x0000000000000000000000000000000000000002', 18, 'TokenB')
    //   // Price tokenB/tokenA = 1/2 = 0.5
    //   const from = new PoolV2WithContract(
    //     CurrencyAmount<Token>.fromRawAmount(tokenA, 1_000_000_000000000),
    //     CurrencyAmount<Token>.fromRawAmount(tokenB, 500_000_000000000000000000),
    //     new Contract('0x0000000000000000000000000000000000000003', []),
    //     DEX.UniswapV2
    //   )
    //   // Price tokenB/tokenA = 1/4 = 0.25
    //   const to = new PoolV2WithContract(
    //     CurrencyAmount<Token>.fromRawAmount(tokenA, 1_000_000_000000000),
    //     CurrencyAmount<Token>.fromRawAmount(tokenB, 250_000_000000000000000000),
    //     new Contract('0x0000000000000000000000000000000000000004', []),
    //     DEX.UniswapV2
    //   )
    //   const result = await balancer.balance(from, to, tokenA)
    //   assert(result.profit.greaterThan(0), 'profit is negative')
  })
})
