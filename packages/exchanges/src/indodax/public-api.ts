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

export const historyRetryPolicy: RetryPolicy = {
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
export function normalizeHistorySymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizePairSymbol(symbol: string): string {
  return normalizeHistorySymbol(symbol).toLowerCase();
}

const BASE_URL = 'https://indodax.com';
const HISTORY_PATH = '/tradingview/history_v2';
const SEARCH_PATH = '/tradingview/search_v2';
const PAIRS_PATH = '/api/pairs_v2';

function isTransient(res: Response): boolean {
  return res.status === 429 || (res.status >= 500 && res.status <= 599);
}

export function parseHistoryBars(
  raw: unknown,
  window?: { from: number; to: number },
): HistoryBar[] {
  if (!Array.isArray(raw)) throw new Error('history_v2: expected an array response');
  const fromMs = window ? window.from * 1000 : undefined;
  const toMs = window ? window.to * 1000 : undefined;
  const out: HistoryBar[] = [];
  for (const bar of raw) {
    if (typeof bar !== 'object' || bar === null) continue;
    const b = bar as HistoryV2Bar;
    const timeMs = Number(b.Time) * 1000;
    if (fromMs !== undefined && timeMs < fromMs) continue;
    if (toMs !== undefined && timeMs >= toMs) continue;
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

export function parsePairInfo(raw: Record<string, unknown>): PairInfo {
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
  constructor(
    message: string,
    public readonly context: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

export class IndodaxPublicApiClient {
  private readonly base: string;
  private readonly fetchFn: FetchFn;

  constructor(
    fetchFn: FetchFn = (url) => globalThis.fetch(url),
    private readonly policy: RetryPolicy = historyRetryPolicy,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    base = BASE_URL,
  ) {
    this.fetchFn = fetchFn;
    this.base = base;
  }

  private async request<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    const url = `${this.base}${path}?${query}`;

    let lastErr: unknown = null;
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
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        if (err instanceof PublicApiError === false && attempt < this.policy.maxRetries) {
          await this.sleep(this.backoff(attempt));
          continue;
        }
        throw err;
      } finally {
        if (this.policy.minIntervalMs > 0) {
          const elapsed = Date.now() - started;
          const wait = this.policy.minIntervalMs - elapsed;
          if (wait > 0) await this.sleep(wait);
        }
      }
    }
    throw lastErr;
  }

  private requestInit(): RequestInit | undefined {
    if (this.policy.timeoutMs <= 0) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.policy.timeoutMs);
    controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    return { signal: controller.signal };
  }

  private backoff(attempt: number): number {
    const delay = this.policy.baseDelayMs * 2 ** attempt;
    return Math.min(delay, this.policy.maxDelayMs);
  }

  fetchHistory(req: HistoryRequest): Promise<HistoryBar[]> {
    return this.request<unknown>(HISTORY_PATH, {
      symbol: normalizeHistorySymbol(req.symbol),
      tf: String(req.tf),
      from: req.from,
      to: req.to,
    }).then((raw) => parseHistoryBars(raw, { from: req.from, to: req.to }));
  }

  searchSymbols(query: string): Promise<SearchSymbol[]> {
    return this.request<SearchSymbol[]>(SEARCH_PATH, { query });
  }

  fetchPairInfo(symbol: string): Promise<PairInfo> {
    return this.request<Record<string, unknown>>(PAIRS_PATH, {
      pair: normalizePairSymbol(symbol),
    }).then(parsePairInfo);
  }
}
