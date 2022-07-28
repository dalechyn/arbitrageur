// currently only 16 enums are supported
export enum DEXType {
  UNISWAPV3,
  UNISWAPV2
}

export abstract class DEXTypeConverter {
  /**
   * Returns a long format of pool
   * @param d DEXType to convert
   */
  static toLongFormat(d: DEXType): string {
    if (d === DEXType.UNISWAPV2) return 'Uniswap V2'
    if (d === DEXType.UNISWAPV3) return 'Uniswap V3'
    throw new Error('Wrong DEXType given')
  }
}
