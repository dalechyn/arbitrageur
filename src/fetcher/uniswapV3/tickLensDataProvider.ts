import { BigintIsh } from '@uniswap/sdk-core'
import { Tick, TickList, TickListDataProvider } from '@uniswap/v3-sdk'

export class TickLensDataProvider extends TickListDataProvider {
  constructor(ticks: Tick[], tickSpacing: number) {
    TickList.validateList(ticks, tickSpacing)
    super(ticks, tickSpacing)
  }

  async getTick(tick: number): Promise<{ liquidityNet: BigintIsh; liquidityGross: BigintIsh }> {
    try {
      return super.getTick(tick)
    } catch (e: any) {
      // if not contained - it looked up for a unexistent Tick
      if (e.message === 'NOT_CONTAINED') return { liquidityNet: 0, liquidityGross: 0 }
      throw e
    }
  }

  async nextInitializedTickWithinOneWord(
    tick: number,
    lte: boolean,
    tickSpacing: number
  ): Promise<[number, boolean]> {
    return super.nextInitializedTickWithinOneWord(tick, lte, tickSpacing)
  }
}
