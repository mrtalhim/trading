import type { Action } from '@trading/core';
import type { GuardrailConfig, GuardrailContext, GuardrailResult } from './types.js';

export const defaultGuardrailConfig: GuardrailConfig = {
  maxPositionPercent: 0.5,
  dailyLossCap: 1000,
  maxTradesPerHour: 10,
  minConfidence: 0.6,
  maxSpread: 0.005,
  minVolume: 100,
  atrSpikeThreshold: 3,
  maxCandleStalenessMs: 5 * 60 * 1000,
  maxClockSkewMs: 30 * 1000,
  maxLlmLatencyMs: 2000,
  minBatteryPercent: 15,
  maxHeartbeatGapMs: 60 * 1000,
};

export const GUARDRAIL_RULES = [
  'max_position_percent',
  'daily_loss_cap',
  'max_trades_per_hour',
  'cooldown_active',
  'min_confidence',
  'max_spread',
  'min_volume',
  'atr_spike',
  'candle_staleness',
  'clock_skew',
  'exchange_degraded',
  'duplicate_client_order_id',
  'invalid_position_size',
  'insufficient_balance',
  'low_battery',
  'missed_heartbeat',
] as const;

export type GuardrailRule = (typeof GUARDRAIL_RULES)[number];

export const LLM_LATENCY_DOWNGRADE = 'llm_latency_exceeded';

function evaluateTradeRules(ctx: GuardrailContext): string[] {
  const { config, market, portfolio, device, exchangeStatus, confidence } = ctx;
  const violated: string[] = [];

  if (portfolio.positionPercent >= config.maxPositionPercent) {
    violated.push('max_position_percent');
  }
  if (portfolio.dailyLoss >= config.dailyLossCap) {
    violated.push('daily_loss_cap');
  }
  if (portfolio.tradesThisHour >= config.maxTradesPerHour) {
    violated.push('max_trades_per_hour');
  }
  if (portfolio.inCooldown) {
    violated.push('cooldown_active');
  }
  if (confidence < config.minConfidence) {
    violated.push('min_confidence');
  }
  if (market.spread > config.maxSpread) {
    violated.push('max_spread');
  }
  if (market.volume < config.minVolume) {
    violated.push('min_volume');
  }
  if (market.atrBaseline > 0 && market.atr > market.atrBaseline * config.atrSpikeThreshold) {
    violated.push('atr_spike');
  }
  if (ctx.now - market.candleTimestamp > config.maxCandleStalenessMs) {
    violated.push('candle_staleness');
  }
  if (market.clockSkewMs > config.maxClockSkewMs) {
    violated.push('clock_skew');
  }
  if (exchangeStatus !== 'online') {
    violated.push('exchange_degraded');
  }
  if (portfolio.duplicateClientOrderId) {
    violated.push('duplicate_client_order_id');
  }
  if (!(portfolio.proposedPositionSize > 0)) {
    violated.push('invalid_position_size');
  }
  if (portfolio.proposedPositionSize > portfolio.cash) {
    violated.push('insufficient_balance');
  }
  if (device.batteryPercent < config.minBatteryPercent) {
    violated.push('low_battery');
  }
  if (ctx.now - device.lastHeartbeatTimestamp > config.maxHeartbeatGapMs) {
    violated.push('missed_heartbeat');
  }

  return violated;
}

export function evaluateGuardrails(ctx: GuardrailContext): GuardrailResult {
  if (ctx.action === 'hold') {
    return { allowed: true, action: 'hold', violated: [] };
  }

  if (ctx.decisionLatencyMs > ctx.config.maxLlmLatencyMs) {
    return { allowed: true, action: 'hold', violated: [LLM_LATENCY_DOWNGRADE] };
  }

  const violated = evaluateTradeRules(ctx);
  const action: Action = ctx.action;
  return {
    allowed: violated.length === 0,
    action,
    violated,
  };
}
