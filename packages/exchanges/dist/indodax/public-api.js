/**
 * Public (unauthenticated) Indodax endpoints: symbol search, tradingview
 * history, pair filters, and order book depth
 * (`/tradingview/search_v2`, `/tradingview/history_v2`, `/api/pairs_v2`,
 * `/api/depth/{pair}`). No credentials are involved. A fetch function is
 * injected so tests never touch the network — they reuse the same `fetch`
 * shape Node 18+ and browsers provide.
 */
export const historyRetryPolicy = {
    maxRetries: 3,
    baseDelayMs: 250,
    maxDelayMs: 8000,
    timeoutMs: 15_000,
    minIntervalMs: 150,
};
/**
 * Indodax id handling is inconsistent across surfaces: the REST pair endpoints
 * (`tickers`, `depth`, `trades`, `pairs_v2`, `search_v2`) take the lowercase
 * id (`btcidr`) while `history_v2` requires the uppercase ticker (`BTCIDR`).
 * These helpers normalize any input spelling (`BTCIDR`, `btcidr`, `BTC/IDR`)
 * onto the required form; the underscore form (`btc_idr`) is rejected by the
 * exchange and is deliberately stripped as well.
 */
export function normalizeHistorySymbol(symbol) {
    return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export function normalizePairSymbol(symbol) {
    return normalizeHistorySymbol(symbol).toLowerCase();
}
const BASE_URL = 'https://indodax.com';
const HISTORY_PATH = '/tradingview/history_v2';
const SEARCH_PATH = '/tradingview/search_v2';
const PAIRS_PATH = '/api/pairs_v2';
const DEPTH_PATH = '/api/depth';
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
function parseDepthLevels(raw) {
    if (!Array.isArray(raw))
        throw new Error('depth: buy/sell must be arrays');
    const levels = raw.map((level) => {
        if (!Array.isArray(level) || level.length < 2) {
            throw new Error('depth: malformed price level');
        }
        const price = Number(level[0]);
        const qty = Number(level[1]);
        if (!Number.isFinite(price) || !Number.isFinite(qty)) {
            throw new Error('depth: non-numeric price level');
        }
        return [price, qty];
    });
    return levels;
}
/**
 * Maps an `/api/depth/{pair}` response (`buy`/`sell` level lists, prices and
 * quantities often as strings) onto the canonical {@link OrderBook} shape:
 * `bids` sorted price-desc, `asks` sorted price-asc, plus the observation
 * `timestamp` supplied by the caller (the fetch moment / candle boundary).
 */
export function parseDepth(raw, timestamp) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('depth: expected an object response');
    }
    const r = raw;
    const bids = parseDepthLevels(r.buy).sort((a, b) => b[0] - a[0]);
    const asks = parseDepthLevels(r.sell).sort((a, b) => a[0] - b[0]);
    return { bids, asks, timestamp };
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
    async request(path, params = {}) {
        const query = Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
            .join('&');
        const url = query ? `${this.base}${path}?${query}` : `${this.base}${path}`;
        let lastErr = null;
        for (let attempt = 0; attempt <= this.policy.maxRetries; attempt += 1) {
            const started = Date.now();
            try {
                const res = await this.fetchFn(url, this.requestInit());
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
            finally {
                if (this.policy.minIntervalMs > 0) {
                    const elapsed = Date.now() - started;
                    const wait = this.policy.minIntervalMs - elapsed;
                    if (wait > 0)
                        await this.sleep(wait);
                }
            }
        }
        throw lastErr;
    }
    requestInit() {
        if (this.policy.timeoutMs <= 0)
            return undefined;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.policy.timeoutMs);
        controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
        return { signal: controller.signal };
    }
    backoff(attempt) {
        const delay = this.policy.baseDelayMs * 2 ** attempt;
        return Math.min(delay, this.policy.maxDelayMs);
    }
    fetchHistory(req) {
        return this.request(HISTORY_PATH, {
            symbol: normalizeHistorySymbol(req.symbol),
            tf: String(req.tf),
            from: req.from,
            to: req.to,
        }).then((raw) => parseHistoryBars(raw, { from: req.from, to: req.to }));
    }
    searchSymbols(query) {
        return this.request(SEARCH_PATH, { query });
    }
    fetchPairInfo(symbol) {
        return this.request(PAIRS_PATH, {
            pair: normalizePairSymbol(symbol),
        }).then(parsePairInfo);
    }
    fetchDepth(symbol) {
        const id = normalizePairSymbol(symbol);
        return this.request(`${DEPTH_PATH}/${id}`).then((raw) => parseDepth(raw, Date.now()));
    }
}
//# sourceMappingURL=public-api.js.map