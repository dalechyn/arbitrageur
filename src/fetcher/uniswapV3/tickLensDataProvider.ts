import { Tick, TickDataProvider, TickList } from '@uniswap/v3-sdk'
import invariant from 'tiny-invariant'

export class TickLensDataProvider implements TickDataProvider {
  constructor(private readonly ticks: Tick[], tickSpacing: number) {
    TickList.validateList(ticks, tickSpacing)
  }

  getTick(tick: number): Promise<Tick> {
    const tickData = this.ticks.find((t) => t.index === tick)
    return Promise.resolve(
      tickData ?? new Tick({ index: tick, liquidityGross: 0, liquidityNet: 0 })
    )
  }

  /**
   * Finds the largest tick in the list of ticks that is less than or equal to tick
   * @param ticks list of ticks
   * @param tick tick to find the largest tick that is less than or equal to tick
   * @private
   */
  private static binarySearch(ticks: readonly Tick[], tick: number): number {
    invariant(!TickList.isBelowSmallest(ticks, tick), 'BELOW_SMALLEST')

    let l = 0
    let r = ticks.length - 1
    let i
    while (true) {
      i = Math.floor((l + r) / 2)

      if (ticks[i].index <= tick && (i === ticks.length - 1 || ticks[i + 1].index > tick)) {
        return i
      }

      if (ticks[i].index < tick) {
        l = i + 1
      } else {
        r = i - 1
      }
    }
  }

  // IMPORTANT NOTICE: looks up not within one word
  // the tick passed may be valid but not initialized
  nextInitializedTickWithinOneWord(
    tick: number,
    lte: boolean,
    tickSpacing: number
  ): Promise<[number, boolean]> {
    // find the tick in array, or the next one
    try {
      const nextTickIndex = TickLensDataProvider.binarySearch(this.ticks, tick - 1)
      return Promise.resolve([this.ticks[lte ? nextTickIndex : nextTickIndex + 1].index, true])
    } catch {
      return Promise.resolve([0, false])
    }
  }
}
