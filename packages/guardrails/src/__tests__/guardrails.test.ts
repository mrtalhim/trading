import { describe, it, expect } from 'vitest';
import {
  evaluateGuardrails,
  defaultGuardrailConfig,
  LLM_LATENCY_DOWNGRADE,
} from '../guardrails.js';
import type { GuardrailContext } from '../types.js';

const NOW = 1_700_000_000_000;

function baseContext(): GuardrailContext {
  return {
    now: NOW,
    action: 'long',
    confidence: 0.8,
    decisionLatencyMs: 1000,
    exchangeStatus: 'online',
    market: {
      spread: 0.001,
      volume: 1000,
      atr: 100,
      atrBaseline: 100,
      candleTimestamp: NOW - 60_000,
      clockSkewMs: 1000,
    },
    portfolio: {
      positionPercent: 0.1,
      dailyLoss: 0,
      cash: 10_000,
      proposedPositionSize: 1000,
      tradesThisHour: 0,
      inCooldown: false,
      duplicateClientOrderId: false,
    },
    device: {
      batteryPercent: 80,
      lastHeartbeatTimestamp: NOW - 10_000,
    },
    config: defaultGuardrailConfig,
  };
}

describe('evaluateGuardrails — baseline', () => {
  it('allows a well-formed long proposal', () => {
    const result = evaluateGuardrails(baseContext());
    expect(result.allowed).toBe(true);
    expect(result.action).toBe('long');
    expect(result.violated).toHaveLength(0);
  });

  it('short-circuits hold as always allowed with no violations', () => {
    const ctx = baseContext();
    ctx.action = 'hold';
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(true);
    expect(result.action).toBe('hold');
    expect(result.violated).toHaveLength(0);
  });

  it('downgrades to hold (allowed) when LLM latency exceeds threshold', () => {
    const ctx = baseContext();
    ctx.decisionLatencyMs = defaultGuardrailConfig.maxLlmLatencyMs + 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(true);
    expect(result.action).toBe('hold');
    expect(result.violated).toEqual([LLM_LATENCY_DOWNGRADE]);
  });
});

describe('evaluateGuardrails — one rule per guardrail', () => {
  it('rejects when position at/above max %', () => {
    const ctx = baseContext();
    ctx.portfolio.positionPercent = defaultGuardrailConfig.maxPositionPercent;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('max_position_percent');
  });

  it('rejects when daily loss cap reached', () => {
    const ctx = baseContext();
    ctx.portfolio.dailyLoss = defaultGuardrailConfig.dailyLossCap;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('daily_loss_cap');
  });

  it('rejects when trades this hour >= max', () => {
    const ctx = baseContext();
    ctx.portfolio.tradesThisHour = defaultGuardrailConfig.maxTradesPerHour;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('max_trades_per_hour');
  });

  it('rejects during active cooldown', () => {
    const ctx = baseContext();
    ctx.portfolio.inCooldown = true;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('cooldown_active');
  });

  it('rejects when confidence below minimum', () => {
    const ctx = baseContext();
    ctx.confidence = defaultGuardrailConfig.minConfidence - 0.01;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('min_confidence');
  });

  it('rejects when spread above maximum', () => {
    const ctx = baseContext();
    ctx.market.spread = defaultGuardrailConfig.maxSpread + 0.001;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('max_spread');
  });

  it('rejects when volume below minimum', () => {
    const ctx = baseContext();
    ctx.market.volume = defaultGuardrailConfig.minVolume - 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('min_volume');
  });

  it('rejects on ATR spike beyond threshold', () => {
    const ctx = baseContext();
    ctx.market.atr = ctx.market.atrBaseline * defaultGuardrailConfig.atrSpikeThreshold + 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('atr_spike');
  });

  it('does not flag ATR spike when baseline is zero', () => {
    const ctx = baseContext();
    ctx.market.atrBaseline = 0;
    ctx.market.atr = 1e9;
    const result = evaluateGuardrails(ctx);
    expect(result.violated).not.toContain('atr_spike');
  });

  it('rejects on candle staleness beyond threshold', () => {
    const ctx = baseContext();
    ctx.market.candleTimestamp = ctx.now - defaultGuardrailConfig.maxCandleStalenessMs - 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('candle_staleness');
  });

  it('rejects on clock skew beyond threshold', () => {
    const ctx = baseContext();
    ctx.market.clockSkewMs = defaultGuardrailConfig.maxClockSkewMs + 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('clock_skew');
  });

  it('rejects when exchange degraded/offline', () => {
    const ctx = baseContext();
    ctx.exchangeStatus = 'degraded';
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('exchange_degraded');

    ctx.exchangeStatus = 'offline';
    expect(evaluateGuardrails(ctx).violated).toContain('exchange_degraded');
  });

  it('rejects on duplicate clientOrderId', () => {
    const ctx = baseContext();
    ctx.portfolio.duplicateClientOrderId = true;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('duplicate_client_order_id');
  });

  it('rejects on invalid (non-positive) position size', () => {
    const ctx = baseContext();
    ctx.portfolio.proposedPositionSize = 0;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('invalid_position_size');
  });

  it('rejects when proposed size exceeds available cash', () => {
    const ctx = baseContext();
    ctx.portfolio.proposedPositionSize = ctx.portfolio.cash + 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('insufficient_balance');
  });

  it('rejects when battery below minimum', () => {
    const ctx = baseContext();
    ctx.device.batteryPercent = defaultGuardrailConfig.minBatteryPercent - 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('low_battery');
  });

  it('rejects when heartbeat missed beyond threshold', () => {
    const ctx = baseContext();
    ctx.device.lastHeartbeatTimestamp = ctx.now - defaultGuardrailConfig.maxHeartbeatGapMs - 1;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(false);
    expect(result.violated).toContain('missed_heartbeat');
  });
});
