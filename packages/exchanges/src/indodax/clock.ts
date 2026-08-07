export type FetchServerTime = () => Promise<number>;
export type NowFn = () => number;

export class ClockSync {
  private skew = 0;

  constructor(
    private readonly fetchServerTime: FetchServerTime,
    private readonly localNow: NowFn = Date.now,
  ) {}

  async sync(): Promise<number> {
    try {
      const serverTime = await this.fetchServerTime();
      this.skew = serverTime - this.localNow();
    } catch {
      // keep the previous skew; a failed sync must not halt the agent
    }
    return this.skew;
  }

  skewMs(): number {
    return this.skew;
  }

  now(): number {
    return this.localNow() + this.skew;
  }
}
