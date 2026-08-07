export type FetchServerTime = () => Promise<number>;
export type NowFn = () => number;
export declare class ClockSync {
    private readonly fetchServerTime;
    private readonly localNow;
    private skew;
    constructor(fetchServerTime: FetchServerTime, localNow?: NowFn);
    sync(): Promise<number>;
    skewMs(): number;
    now(): number;
}
//# sourceMappingURL=clock.d.ts.map