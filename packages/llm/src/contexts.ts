import type { Candle } from '@trading/core';
import { adx, atr, detectPatternContext, ema, rsi, sma, vwap } from '@trading/indicators';
import type { DecisionContext } from './interfaces.js';

export interface ContextRenderOptions {
  includeIndicators?: boolean;
  includePatterns?: boolean;
}

export type ContextKind = 'baseline' | 'indicators' | 'patterns';

export function contextOptionsFor(kind: ContextKind): ContextRenderOptions {
  switch (kind) {
    case 'indicators':
      return { includeIndicators: true };
    case 'patterns':
      return { includeIndicators: true, includePatterns: true };
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

export function buildDecisionUserPrompt(
  candles: Candle[],
  opts: ContextRenderOptions = {},
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
    'Based on this price action, what is your decision?',
    'Respond with exactly: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
  ];
  return parts.join('\n');
}

export function buildDecisionContext(
  symbol: string,
  candles: Candle[],
  opts: ContextRenderOptions = {},
): DecisionContext {
  return {
    systemPrompt: buildDecisionSystemPrompt(symbol, opts),
    userPrompt: buildDecisionUserPrompt(candles, opts),
  };
}
