/**
 * Public (unauthenticated) Indodax endpoints: symbol search, tradingview
 * history, and pair filters (`/tradingview/search_v2`, `/tradingview/history_v2`,
 * `/api/pairs_v2`). No credentials are involved. A fetch function is injected
 * so tests never touch the network — they reuse the same `fetch` shape Node
 * 18+ and browsers provide.
 */
export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface HistoryV2Bar {
    Time: number;
    Open: number;
    High: number;
    Low: number;
    Close: number;
    Volume: string | number;
}
export interface SearchSymbol {
    id: string;
    symbol: string;
    full_name: string;
    description: string;
    exchange: string;
    ticker: string;
    type: string;
}
export interface HistoryBar {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface HistoryRequest {
    /** Exchange ticker symbol, e.g. `BTCIDR` (from {@link SearchSymbol.id}). */
    symbol: string;
    /** TradingView resolution: minutes as string/number or `h`, `D`, ... */
    tf: string | number;
    from: number;
    to: number;
}
export interface PairInfo {
    tickerId: string;
    symbol: string;
    baseCurrency: string;
    tradedCurrency: string;
    minNotional: number;
    minQuantity: number;
    feeTaker: number;
    feeMaker: number;
    pricePrecision: number;
    isMaintenance: boolean;
}
export interface RetryPolicy {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    /**
     * Per-attempt hard timeout, 0 disables. Indodax can hang tens of seconds on
     * some paths (e.g. unknown symbols), so every request needs a ceiling.
     */
    timeoutMs: number;
    /** Minimum gap between successive request attempts (client-side throttle). */
    minIntervalMs: number;
}
export declare const historyRetryPolicy: RetryPolicy;
/**
 * Indodax id handling is inconsistent across surfaces: the REST pair endpoints
 * (`tickers`, `depth`, `trades`, `pairs_v2`, `search_v2`) take the lowercase
 * id (`btcidr`) while `history_v2` requires the uppercase ticker (`BTCIDR`).
 * These helpers normalize any input spelling (`BTCIDR`, `btcidr`, `BTC/IDR`)
 * onto the required form; the underscore form (`btc_idr`) is rejected by the
 * exchange and is deliberately stripped as well.
 */
export declare function normalizeHistorySymbol(symbol: string): string;
export declare function normalizePairSymbol(symbol: string): string;
export declare function parseHistoryBars(raw: unknown, window?: {
    from: number;
    to: number;
}): HistoryBar[];
export declare function parsePairInfo(raw: Record<string, unknown>): PairInfo;
export declare class PublicApiError extends Error {
    readonly context: string;
    readonly status: number;
    constructor(message: string, context: string, status: number);
}
export declare class IndodaxPublicApiClient {
    private readonly policy;
    private readonly sleep;
    private readonly base;
    private readonly fetchFn;
    constructor(fetchFn?: FetchFn, policy?: RetryPolicy, sleep?: (ms: number) => Promise<void>, base?: string);
    private request;
    private requestInit;
    private backoff;
    fetchHistory(req: HistoryRequest): Promise<HistoryBar[]>;
    searchSymbols(query: string): Promise<SearchSymbol[]>;
    fetchPairInfo(symbol: string): Promise<PairInfo>;
}
//# sourceMappingURL=public-api.d.ts.map