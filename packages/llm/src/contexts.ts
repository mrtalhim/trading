import { createHash } from 'node:crypto';
import type { Candle, OrderBook } from '@trading/core';
import { adx, atr, detectPatternContext, ema, rsi, sma, vwap } from '@trading/indicators';
import type { DecisionContext } from './interfaces.js';

export interface ContextRenderOptions {
  includeIndicators?: boolean;
  includePatterns?: boolean;
  includeOrderflow?: boolean;
}

export type ContextKind = 'baseline' | 'indicators' | 'patterns' | 'orderflow';

export function contextOptionsFor(kind: ContextKind): ContextRenderOptions {
  switch (kind) {
    case 'indicators':
      return { includeIndicators: true };
    case 'patterns':
      return { includeIndicators: true, includePatterns: true };
    case 'orderflow':
      return { includeIndicators: true, includeOrderflow: true };
    case 'baseline':
    default:
      return {};
  }
}

export function buildDecisionSystemPrompt(symbol: string, opts: ContextRenderOptions = {}): string {
  const lines = [
    'You are a crypto trading decision engine.',
    `You trade ${symbol}.`,
    '',
    'Rules:',
    '- You must respond with EXACTLY a JSON object: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
    '- action: "long" = buy, "short" = sell, "hold" = do nothing',
    '- confidence: your certainty in this decision (0.0 to 1.0)',
    '- No other text, no markdown fences, just the raw JSON object.',
    '',
    'Consider the recent price action, volume, and trend.',
  ];
  if (opts.includeIndicators) {
    lines.push('- Indicator values are supplied to help judge momentum and volatility.');
  }
  if (opts.includePatterns) {
    lines.push(
      '- Candlestick patterns are supplied; weigh them only as evidence, not as signals on their own.',
    );
  }
  if (opts.includeOrderflow) {
    lines.push(
      '- Order book imbalance is supplied; weigh it only as evidence, not as a signal on its own.',
    );
  }
  return lines.join('\n');
}

function fmt(value: number): string {
  return Number.isNaN(value) ? 'n/a' : value.toFixed(2);
}

export function buildIndicatorBlock(candles: Candle[]): string {
  return [
    'Indicators:',
    `- RSI(14): ${fmt(rsi(candles, 14).value)}`,
    `- ATR(14): ${fmt(atr(candles, 14).value)}`,
    `- ADX(14): ${fmt(adx(candles, 14).value)}`,
    `- EMA(20): ${fmt(ema(candles, 20).value)}`,
    `- SMA(20): ${fmt(sma(candles, 20).value)}`,
    `- VWAP: ${fmt(vwap(candles).value)}`,
  ].join('\n');
}

export function buildPatternBlock(candles: Candle[]): string {
  const ctx = detectPatternContext(candles);
  const single = Object.entries(ctx.single)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  const doubly = Object.entries(ctx.double)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  const triple = Object.entries(ctx.triple)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return [
    'Patterns:',
    `- version: ${ctx.patternVersion}`,
    `- trend: ${ctx.structural.trendStructure}`,
    `- nearSupport: ${ctx.structural.nearSupport}; nearResistance: ${ctx.structural.nearResistance}`,
    `- single: ${single}`,
    `- double: ${doubly}`,
    `- triple: ${triple}`,
  ].join('\n');
}

export const ORDERFLOW_VERSION = '1.0.0';
export const ORDERFLOW_LEVELS = 5;

export interface OrderFlowMetrics {
  bestBid: number;
  bestAsk: number;
  /** `(bestAsk - bestBid) / bestAsk * 100`, percent. */
  spreadPct: number;
  /** Sum of the top-{@link ORDERFLOW_LEVELS} bid sizes. */
  topBidSize: number;
  /** Sum of the top-{@link ORDERFLOW_LEVELS} ask sizes. */
  topAskSize: number;
  /** `(topBidSize - topAskSize) / (topBidSize + topAskSize)`, in [-1, 1]. */
  imbalance: number;
  /** 16-char hex hash over the definition; changes only when the definition changes. */
  version: string;
}

/**
 * Pre-committed M3.7 metric: top-N bid vs ask size imbalance plus spread.
 * Deterministic — the same book and level count always produce the same
 * metrics, including `version`.
 */
export function computeOrderFlow(book: OrderBook, levels = ORDERFLOW_LEVELS): OrderFlowMetrics {
  const bids = [...book.bids].sort((a, b) => b[0] - a[0]).slice(0, levels);
  const asks = [...book.asks].sort((a, b) => a[0] - b[0]).slice(0, levels);
  const topBidSize = bids.reduce((sum, [, qty]) => sum + qty, 0);
  const topAskSize = asks.reduce((sum, [, qty]) => sum + qty, 0);
  const bestBid = bids[0]?.[0] ?? NaN;
  const bestAsk = asks[0]?.[0] ?? NaN;
  const spreadPct =
    Number.isFinite(bestAsk) && Number.isFinite(bestBid) && bestAsk > 0
      ? ((bestAsk - bestBid) / bestAsk) * 100
      : NaN;
  const total = topBidSize + topAskSize;
  const imbalance = total > 0 ? (topBidSize - topAskSize) / total : NaN;
  const version = createHash('sha256')
    .update(JSON.stringify({ version: ORDERFLOW_VERSION, levels }))
    .digest('hex')
    .slice(0, 16);
  return { bestBid, bestAsk, spreadPct, topBidSize, topAskSize, imbalance, version };
}

export function buildOrderFlowBlock(book: OrderBook | null | undefined): string {
  if (!book || book.bids.length === 0 || book.asks.length === 0) {
    return 'Orderbook: unavailable';
  }
  const m = computeOrderFlow(book);
  const side =
    m.imbalance > 0.05
      ? 'bids outweigh asks'
      : m.imbalance < -0.05
        ? 'asks outweigh bids'
        : 'balanced';
  return [
    'Orderbook (depth, top 5 levels):',
    `- version: ${m.version}`,
    `- bestBid: ${fmt(m.bestBid)}; bestAsk: ${fmt(m.bestAsk)}; spread: ${fmt(m.spreadPct)}%`,
    `- top-5 bid size: ${m.topBidSize.toFixed(6)}; top-5 ask size: ${m.topAskSize.toFixed(6)}`,
    `- imbalance: ${m.imbalance.toFixed(3)} (${side})`,
  ].join('\n');
}

export function buildDecisionUserPrompt(
  candles: Candle[],
  opts: ContextRenderOptions = {},
  book?: OrderBook | null,
): string {
  const lines = candles.map(
    (c) => `t=${c.timestamp} O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`,
  );
  const parts = [
    'Recent candles (oldest first):',
    ...lines,
    '',
    ...(opts.includeIndicators ? [buildIndicatorBlock(candles), ''] : []),
    ...(opts.includePatterns ? [buildPatternBlock(candles), ''] : []),
    ...(opts.includeOrderflow ? [buildOrderFlowBlock(book ?? null), ''] : []),
    'Based on this price action, what is your decision?',
    'Respond with exactly: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
  ];
  return parts.join('\n');
}

export function buildDecisionContext(
  symbol: string,
  candles: Candle[],
  opts: ContextRenderOptions = {},
  book?: OrderBook | null,
): DecisionContext {
  return {
    systemPrompt: buildDecisionSystemPrompt(symbol, opts),
    userPrompt: buildDecisionUserPrompt(candles, opts, book),
  };
}
