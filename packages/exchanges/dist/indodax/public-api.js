/**
 * Public (unauthenticated) Indodax endpoints: symbol search, tradingview
 * history, and pair filters (`/tradingview/search_v2`, `/tradingview/history_v2`,
 * `/api/pairs_v2`). No credentials are involved. A fetch function is injected
 * so tests never touch the network — they reuse the same `fetch` shape Node
 * 18+ and browsers provide.
 */
export const historyRetryPolicy = {
    maxRetries: 3,
    baseDelayMs: 250,
    maxDelayMs: 8000,
};
const BASE_URL = 'https://indodax.com';
const HISTORY_PATH = '/tradingview/history_v2';
const SEARCH_PATH = '/tradingview/search_v2';
const PAIRS_PATH = '/api/pairs_v2';
function isTransient(res) {
    return res.status === 429 || (res.status >= 500 && res.status <= 599);
}
export function parseHistoryBars(raw, window) {
    if (!Array.isArray(raw))
        throw new Error('history_v2: expected an array response');
    const fromMs = window ? window.from * 1000 : undefined;
    const toMs = window ? window.to * 1000 : undefined;
    const out = [];
    for (const bar of raw) {
        if (typeof bar !== 'object' || bar === null)
            continue;
        const b = bar;
        const timeMs = Number(b.Time) * 1000;
        if (fromMs !== undefined && timeMs < fromMs)
            continue;
        if (toMs !== undefined && timeMs >= toMs)
            continue;
        out.push({
            timestamp: timeMs,
            open: Number(b.Open),
            high: Number(b.High),
            low: Number(b.Low),
            close: Number(b.Close),
            volume: Number(b.Volume),
        });
    }
    return out;
}
export function parsePairInfo(raw) {
    return {
        tickerId: String(raw.ticker_id ?? ''),
        symbol: String(raw.symbol ?? ''),
        baseCurrency: String(raw.base_currency ?? ''),
        tradedCurrency: String(raw.traded_currency ?? ''),
        minNotional: Number(raw.trade_min_base_currency ?? 0),
        minQuantity: Number(raw.trade_min_traded_currency ?? 0),
        feeTaker: Number(raw.trade_fee_percent_taker ?? raw.trade_fee_percent ?? 0) / 100,
        feeMaker: Number(raw.trade_fee_percent_maker ?? raw.trade_fee_percent ?? 0) / 100,
        pricePrecision: Number(raw.price_round ?? 0),
        isMaintenance: Number(raw.is_maintenance ?? 0) !== 0,
    };
}
export class PublicApiError extends Error {
    context;
    status;
    constructor(message, context, status) {
        super(message);
        this.context = context;
        this.status = status;
        this.name = 'PublicApiError';
    }
}
export class IndodaxPublicApiClient {
    policy;
    sleep;
    base;
    fetchFn;
    constructor(fetchFn = (url) => globalThis.fetch(url), policy = historyRetryPolicy, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), base = BASE_URL) {
        this.policy = policy;
        this.sleep = sleep;
        this.fetchFn = fetchFn;
        this.base = base;
    }
    async request(path, params) {
        const query = Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
            .join('&');
        const url = `${this.base}${path}?${query}`;
        let lastErr = null;
        for (let attempt = 0; attempt <= this.policy.maxRetries; attempt += 1) {
            try {
                const res = await this.fetchFn(url);
                if (!res.ok) {
                    if (isTransient(res) && attempt < this.policy.maxRetries) {
                        await this.sleep(this.backoff(attempt));
                        continue;
                    }
                    throw new PublicApiError(`${path} failed with status ${res.status}`, path, res.status);
                }
                return (await res.json());
            }
            catch (err) {
                lastErr = err;
                if (err instanceof PublicApiError === false && attempt < this.policy.maxRetries) {
                    await this.sleep(this.backoff(attempt));
                    continue;
                }
                throw err;
            }
        }
        throw lastErr;
    }
    backoff(attempt) {
        const delay = this.policy.baseDelayMs * 2 ** attempt;
        return Math.min(delay, this.policy.maxDelayMs);
    }
    fetchHistory(req) {
        return this.request(HISTORY_PATH, {
            symbol: req.symbol,
            tf: String(req.tf),
            from: req.from,
            to: req.to,
        }).then((raw) => parseHistoryBars(raw, { from: req.from, to: req.to }));
    }
    searchSymbols(query) {
        return this.request(SEARCH_PATH, { query });
    }
    fetchPairInfo(symbol) {
        return this.request(PAIRS_PATH, { pair: symbol }).then(parsePairInfo);
    }
}
//# sourceMappingURL=public-api.js.map