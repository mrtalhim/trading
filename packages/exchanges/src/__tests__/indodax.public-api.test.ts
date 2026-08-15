import { describe, expect, it } from 'vitest';
import {
  IndodaxPublicApiClient,
  normalizeHistorySymbol,
  normalizePairSymbol,
  parseDepth,
  parseHistoryBars,
  parsePairInfo,
  type FetchFn,
  type HistoryV2Bar,
  type SearchSymbol,
} from '../indodax/public-api.js';

const RETRY_POLICY = {
  maxRetries: 2,
  baseDelayMs: 1,
  maxDelayMs: 2,
  timeoutMs: 0,
  minIntervalMs: 0,
};
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function clientWith(handler: (url: string) => Promise<Response>): IndodaxPublicApiClient {
  return new IndodaxPublicApiClient(handler as FetchFn, RETRY_POLICY, sleep);
}

describe('parseHistoryBars', () => {
  const bars: HistoryV2Bar[] = [
    { Time: 1_700_000_000, Open: 100, High: 110, Low: 90, Close: 105, Volume: '12.5' },
    { Time: 1_700_000_900, Open: 105, High: 115, Low: 100, Close: 112, Volume: '7.25' },
  ];

  it('maps Time seconds to ms, Volume string to number, and OHLC', () => {
    const candles = parseHistoryBars(bars);
    expect(candles).toEqual([
      {
        timestamp: 1_700_000_000 * 1000,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 12.5,
      },
      {
        timestamp: 1_700_000_900 * 1000,
        open: 105,
        high: 115,
        low: 100,
        close: 112,
        volume: 7.25,
      },
    ]);
  });

  it('drops bars outside the requested [from, to) window', () => {
    const from = 1_700_000_100;
    const to = from + 900;
    const kept = parseHistoryBars(bars, { from, to });
    expect(kept).toHaveLength(1);
    expect(kept[0].timestamp).toBe(1_700_000_900 * 1000);
  });

  it('returns an empty list for an empty response (noData)', () => {
    expect(parseHistoryBars([])).toEqual([]);
  });

  it('accepts numeric or string Volume', () => {
    const mixed: HistoryV2Bar[] = [{ Time: 1, Open: 1, High: 2, Low: 1, Close: 2, Volume: 3 }];
    expect(parseHistoryBars(mixed)[0].volume).toBe(3);
  });
});

describe('IndodaxPublicApiClient (injected fetch, no network)', () => {
  it('fetchHistory: builds the history_v2 URL with uppercase symbol and returns bars', async () => {
    const seen: string[] = [];
    const client = clientWith(async (url) => {
      seen.push(url);
      return jsonResponse([{ Time: 150, Open: 1, High: 2, Low: 1, Close: 2, Volume: '0.5' }]);
    });
    const bars = await client.fetchHistory({ symbol: 'BTCIDR', tf: '15', from: 100, to: 200 });
    expect(seen[0]).toContain('/tradingview/history_v2?');
    expect(seen[0]).toContain('symbol=BTCIDR');
    expect(seen[0]).toContain('tf=15');
    expect(seen[0]).toContain('from=100');
    expect(bars).toHaveLength(1);
  });

  it('fetchHistory accepts tf as number', async () => {
    const seen: string[] = [];
    const client = clientWith(async (url) => {
      seen.push(url);
      return jsonResponse([]);
    });
    const bars = await client.fetchHistory({ symbol: 'BTCIDR', tf: 15, from: 1, to: 2 });
    expect(seen[0]).toContain('tf=15');
    expect(bars).toEqual([]);
  });

  it('searchSymbols returns the id (uppercase ticker) for a query', async () => {
    const symbols: SearchSymbol[] = [
      {
        id: 'btcidr',
        symbol: 'BTCIDR',
        full_name: 'BTCIDR',
        description: 'BTC/IDR',
        exchange: 'BTCID',
        ticker: 'BTCIDR',
        type: 'bitcoincoid',
      },
    ];
    const client = clientWith(async () => jsonResponse(symbols));
    const found = await client.searchSymbols('BTC');
    expect(found).toEqual(symbols);
  });

  it('throws after retry on 500', async () => {
    let calls = 0;
    const client = clientWith(async () => {
      calls += 1;
      return jsonResponse({ error: 'boom' }, 500);
    });
    await expect(client.fetchHistory({ symbol: 'BTCIDR', tf: 15, from: 1, to: 2 })).rejects.toThrow(
      /history_v2/,
    );
    expect(calls).toBe(RETRY_POLICY.maxRetries + 1);
  });

  it('throws on network failure after bounded retries', async () => {
    let calls = 0;
    const client = clientWith(async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    });
    await expect(client.searchSymbols('BTC')).rejects.toThrow();
    expect(calls).toBe(RETRY_POLICY.maxRetries + 1);
  });
});

describe('symbol normalization (surface id inconsistency)', () => {
  it('normalizes every spelling onto the uppercase history symbol BTCIDR', () => {
    expect(normalizeHistorySymbol('BTCIDR')).toBe('BTCIDR');
    expect(normalizeHistorySymbol('btcidr')).toBe('BTCIDR');
    expect(normalizeHistorySymbol('BTC/IDR')).toBe('BTCIDR');
    expect(normalizeHistorySymbol('btc_idr')).toBe('BTCIDR');
  });

  it('normalizes every spelling onto the lowercase REST pair id btcidr', () => {
    expect(normalizePairSymbol('BTCIDR')).toBe('btcidr');
    expect(normalizePairSymbol('BTC/IDR')).toBe('btcidr');
    expect(normalizePairSymbol('btc_idr')).toBe('btcidr');
  });

  it('fetchHistory sends the uppercase symbol regardless of input spelling', async () => {
    const seen: string[] = [];
    const client = clientWith(async (url) => {
      seen.push(url);
      return jsonResponse([]);
    });
    await client.fetchHistory({ symbol: 'btc_idr', tf: 15, from: 1, to: 2 });
    expect(seen[0]).toContain('symbol=BTCIDR');
  });

  it('fetchPairInfo sends the lowercase pair id regardless of input spelling', async () => {
    const seen: string[] = [];
    const client = clientWith(async (url) => {
      seen.push(url);
      return jsonResponse({
        id: 'btcidr',
        ticker_id: 'btc_idr',
        symbol: 'BTCIDR',
        base_currency: 'idr',
        traded_currency: 'btc',
        trade_min_base_currency: 10000,
        trade_min_traded_currency: 0.00000871,
        trade_fee_percent: 0.2,
        is_maintenance: 0,
      });
    });
    await client.fetchPairInfo('BTC/IDR');
    expect(seen[0]).toContain('pair=btcidr');
  });
});

describe('retry policy hardening (timeout, throttle)', () => {
  it('aborts a hanging request after timeoutMs and retries until exhausted', async () => {
    let attempts = 0;
    const client = new IndodaxPublicApiClient(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          attempts += 1;
          if (!init?.signal) {
            reject(new TypeError('expected an abort signal'));
            return;
          }
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
      { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2, timeoutMs: 40, minIntervalMs: 0 },
      async () => {},
    );
    const started = Date.now();
    await expect(
      client.fetchHistory({ symbol: 'btcidr', tf: 15, from: 1, to: 2 }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(attempts).toBe(3);
  });

  it('enforces a minimum interval between successive requests', async () => {
    const client = new IndodaxPublicApiClient(
      async () => jsonResponse([]),
      { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 2, timeoutMs: 0, minIntervalMs: 60 },
      sleep,
    );
    const started = Date.now();
    await client.fetchHistory({ symbol: 'BTCIDR', tf: 15, from: 1, to: 2 });
    await client.fetchHistory({ symbol: 'BTCIDR', tf: 15, from: 3, to: 4 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
  });
});

describe('parseDepth', () => {
  const raw = {
    buy: [
      ['65000000', '0.05'],
      ['64000000', '0.10'],
    ],
    sell: [
      ['66000000', '0.08'],
      ['67000000', '0.02'],
    ],
  };

  it('maps buy->bids (price desc), sell->asks (price asc), stamps the timestamp', () => {
    const book = parseDepth(raw, 1234);
    expect(book.timestamp).toBe(1234);
    expect(book.bids).toEqual([
      [65000000, 0.05],
      [64000000, 0.1],
    ]);
    expect(book.asks).toEqual([
      [66000000, 0.08],
      [67000000, 0.02],
    ]);
  });

  it('accepts numeric levels and normalizes sort order regardless of input order', () => {
    const book = parseDepth(
      {
        buy: [
          [64000000, 1],
          [65000000, 2],
        ],
        sell: [
          [67000000, 1],
          [66000000, 2],
        ],
      },
      0,
    );
    expect(book.bids.map(([p]) => p)).toEqual([65000000, 64000000]);
    expect(book.asks.map(([p]) => p)).toEqual([66000000, 67000000]);
  });

  it('throws on a non-object response or malformed levels', () => {
    expect(() => parseDepth([], 0)).toThrow(/object/);
    expect(() => parseDepth({ buy: 'nope', sell: [] }, 0)).toThrow(/arrays/);
    expect(() => parseDepth({ buy: [['abc', 'def']], sell: [] }, 0)).toThrow(/non-numeric/);
    expect(() => parseDepth({ buy: [[65000000]], sell: [] }, 0)).toThrow(/malformed/);
  });
});

describe('fetchDepth', () => {
  it('hits /api/depth/{lowercase id} and returns a parsed book', async () => {
    const seen: string[] = [];
    const client = clientWith(async (url) => {
      seen.push(url);
      return jsonResponse({
        buy: [['65000000', '0.05']],
        sell: [['66000000', '0.08']],
      });
    });
    const book = await client.fetchDepth('BTC/IDR');
    expect(seen[0]).toBe('https://indodax.com/api/depth/btcidr');
    expect(book.bids[0][0]).toBe(65000000);
    expect(book.asks[0][0]).toBe(66000000);
  });

  it('retries transient failures per the retry policy', async () => {
    let calls = 0;
    const client = clientWith(async () => {
      calls += 1;
      return jsonResponse({}, 500);
    });
    await expect(client.fetchDepth('btcidr')).rejects.toThrow(/depth/);
    expect(calls).toBe(RETRY_POLICY.maxRetries + 1);
  });
});

describe('parsePairInfo', () => {
  const pairRaw = {
    id: 'btcidr',
    symbol: 'BTCIDR',
    base_currency: 'idr',
    traded_currency: 'btc',
    ticker_id: 'btc_idr',
    trade_min_base_currency: 10000,
    trade_min_traded_currency: 0.00000871,
    trade_fee_percent: 0.2,
    trade_fee_percent_taker: 0.2,
    trade_fee_percent_maker: 0.1,
    price_round: 8,
    pricescale: 1000,
    minmov: 1000,
    is_maintenance: 0,
  };
  it('maps pairs_v2 filters to PairInfo', () => {
    const info = parsePairInfo(pairRaw);
    expect(info).toEqual({
      tickerId: 'btc_idr',
      symbol: 'BTCIDR',
      baseCurrency: 'idr',
      tradedCurrency: 'btc',
      minNotional: 10000,
      minQuantity: 0.00000871,
      feeTaker: 0.002,
      feeMaker: 0.001,
      pricePrecision: 8,
      isMaintenance: false,
    });
  });
});
