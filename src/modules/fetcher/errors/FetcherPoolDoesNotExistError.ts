export class FetcherPoolDoesNotExistError extends Error {
  constructor(public readonly pool: string) {
    super(`Pool does not exist ${pool}`)
  }
}
