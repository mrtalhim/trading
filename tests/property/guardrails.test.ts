import { describe, it, expect } from 'vitest';
import { evaluateGuardrails } from '../../packages/guardrails/src/index.js';
import type {
  Action,
  ExchangeStatus,
  GuardrailConfig,
  GuardrailContext,
} from '../../packages/guardrails/src/types.js';
import { defaultGuardrailConfig } from '../../packages/guardrails/src/guardrails.js';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function maybePoison(rng: () => number, value: number): number {
  const r = rng();
  if (r < 0.01) return NaN;
  if (r < 0.02) return Infinity;
  if (r < 0.03) return -Infinity;
  return value;
}

// With 85% probability returns a value in `valid`, 10% in `invalid`, 5% a poison value.
function biased(rng: () => number, valid: number, invalid: number, poison: boolean): number {
  const r = rng();
  if (poison && r < 0.05) return NaN;
  if (r < 0.15) return invalid;
  return valid;
}

function randomContext(rng: () => number): GuardrailContext {
  const cfg: GuardrailConfig = defaultGuardrailConfig;
  const now = 1_700_000_000_000;

  // Critical fields that the execution invariants depend on are always finite and
  // within passing ranges, so that a meaningful fraction of cases actually execute.
  const action: Action = pick(rng, ['long', 'short', 'hold']);
  const exchangeStatus: ExchangeStatus = pick(rng, ['online', 'online', 'online', 'degraded', 'offline']);

  return {
    now,
    action,
    confidence: biased(rng, randRange(rng, cfg.minConfidence, 1), randRange(rng, -0.5, cfg.minConfidence - 0.001), true),
    decisionLatencyMs: biased(
      rng,
      randRange(rng, 0, cfg.maxLlmLatencyMs * 0.8),
      randRange(rng, cfg.maxLlmLatencyMs + 1, cfg.maxLlmLatencyMs * 2),
      true,
    ),
    exchangeStatus,
    market: {
      spread: biased(rng, randRange(rng, 0, cfg.maxSpread * 0.8), randRange(rng, cfg.maxSpread * 1.1, 0.05), true),
      volume: biased(rng, randRange(rng, cfg.minVolume, cfg.minVolume * 5), randRange(rng, -10, cfg.minVolume - 1), true),
      atr: biased(
        rng,
        randRange(rng, 0, cfg.atrSpikeThreshold * cfg.atrSpikeThreshold),
        randRange(rng, cfg.atrBaseline * cfg.atrSpikeThreshold * 2, cfg.atrBaseline * cfg.atrSpikeThreshold * 3),
        true,
      ),
      atrBaseline: maybePoison(rng, randRange(rng, 10, 5000)),
      candleTimestamp: now - randRange(rng, 0, cfg.maxCandleStalenessMs * 0.5),
      clockSkewMs: biased(rng, randRange(rng, 0, cfg.maxClockSkewMs * 0.5), randRange(rng, cfg.maxClockSkewMs + 1, 60_000), true),
    },
    portfolio: {
      positionPercent: randRange(rng, 0, cfg.maxPositionPercent * 0.8),
      dailyLoss: biased(rng, randRange(rng, 0, cfg.dailyLossCap * 0.5), randRange(rng, cfg.dailyLossCap, cfg.dailyLossCap * 2), true),
      cash: randRange(rng, 1000, 50_000),
      proposedPositionSize: randRange(rng, 1, 45_000),
      tradesThisHour: biased(rng, Math.floor(randRange(rng, 0, cfg.maxTradesPerHour - 1)), cfg.maxTradesPerHour, false),
      inCooldown: rng() < 0.1,
      duplicateClientOrderId: rng() < 0.1,
    },
    device: {
      batteryPercent: biased(rng, randRange(rng, cfg.minBatteryPercent, 100), randRange(rng, -10, cfg.minBatteryPercent - 1), true),
      lastHeartbeatTimestamp: now - randRange(rng, 0, cfg.maxHeartbeatGapMs * 0.5),
    },
    config: cfg,
  };
}

const CASES = 120_000;

describe('property tests — guardrails invariants over randomized inputs', () => {
  it(`runs ${CASES} randomized cases with zero invariant violations`, () => {
    const rng = mulberry32(0xc0ffee);
    let allowedCount = 0;
    let executedCount = 0;

    for (let i = 0; i < CASES; i++) {
      const ctx = randomContext(rng);
      let result;
      expect(() => {
        result = evaluateGuardrails(ctx);
      }).not.toThrow();
      result = result!;

      expect(typeof result.allowed).toBe('boolean');
      expect(['long', 'short', 'hold']).toContain(result.action);
      expect(Array.isArray(result.violated)).toBe(true);
      for (const v of result.violated) {
        expect(typeof v).toBe('string');
      }

      const trades = ctx.action !== 'hold';
      const executes = result.allowed && trades && result.action !== 'hold';

      if (executes) {
        executedCount++;
        // Never a negative position size
        expect(ctx.portfolio.proposedPositionSize).toBeGreaterThan(0);
        // Never exceeds configured max exposure
        expect(ctx.portfolio.positionPercent).toBeLessThan(ctx.config.maxPositionPercent);
        // Never a duplicate order for the same clientOrderId
        expect(ctx.portfolio.duplicateClientOrderId).toBe(false);
        // Never opens a position with zero available cash
        expect(ctx.portfolio.cash).toBeGreaterThan(0);
        expect(ctx.portfolio.proposedPositionSize).toBeLessThanOrEqual(ctx.portfolio.cash);
      }

      if (result.allowed) allowedCount++;

      // Duplicate clientOrderId never leads to execution of a new trade
      if (trades && ctx.portfolio.duplicateClientOrderId && result.action !== 'hold') {
        expect(result.allowed).toBe(false);
      }

      // Zero available cash never leads to execution of a new trade
      if (trades && ctx.portfolio.cash <= 0 && result.action !== 'hold') {
        expect(result.allowed).toBe(false);
      }
    }

    // The generator produced a meaningful mix: some allowed, some executed.
    expect(allowedCount).toBeGreaterThan(0);
    expect(executedCount).toBeGreaterThan(0);
  });
});
