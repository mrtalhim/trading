import type { Candle } from '@trading/core';
import type { DecisionContext } from './interfaces.js';

export function buildDecisionSystemPrompt(symbol: string): string {
  return [
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
  ].join('\n');
}

export function buildDecisionUserPrompt(candles: Candle[]): string {
  const lines = candles.map(
    (c) => `t=${c.timestamp} O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`,
  );
  return [
    'Recent candles (oldest first):',
    ...lines,
    '',
    'Based on this price action, what is your decision?',
    'Respond with exactly: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
  ].join('\n');
}

export function buildDecisionContext(symbol: string, candles: Candle[]): DecisionContext {
  return {
    systemPrompt: buildDecisionSystemPrompt(symbol),
    userPrompt: buildDecisionUserPrompt(candles),
  };
}
