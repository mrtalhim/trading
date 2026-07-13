import type { Action } from '@trading/core';

export type ExchangeStatus = 'online' | 'degraded' | 'offline';

export interface GuardrailConfig {
  maxPositionPercent: number;
  dailyLossCap: number;
  maxTradesPerHour: number;
  minConfidence: number;
  maxSpread: number;
  minVolume: number;
  atrSpikeThreshold: number;
  maxCandleStalenessMs: number;
  maxClockSkewMs: number;
  maxLlmLatencyMs: number;
  minBatteryPercent: number;
  maxHeartbeatGapMs: number;
}

export interface MarketState {
  spread: number;
  volume: number;
  atr: number;
  atrBaseline: number;
  candleTimestamp: number;
  clockSkewMs: number;
}

export interface PortfolioState {
  positionPercent: number;
  dailyLoss: number;
  cash: number;
  proposedPositionSize: number;
  tradesThisHour: number;
  inCooldown: boolean;
  duplicateClientOrderId: boolean;
}

export interface DeviceState {
  batteryPercent: number;
  lastHeartbeatTimestamp: number;
}

export interface GuardrailContext {
  now: number;
  action: Action;
  confidence: number;
  decisionLatencyMs: number;
  exchangeStatus: ExchangeStatus;
  market: MarketState;
  portfolio: PortfolioState;
  device: DeviceState;
  config: GuardrailConfig;
}

export interface GuardrailResult {
  allowed: boolean;
  action: Action;
  violated: string[];
}
