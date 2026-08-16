import { createHash } from 'node:crypto';
import type { Candle, Action } from '@trading/core';
import type { Dataset } from '@trading/datasets';
import { JsonlLoader, ReplayLoader } from '@trading/datasets';
import { FeaturePipeline } from '@trading/features';
import { PaperExchange, createPaperExchange } from '@trading/exchanges';
import { evaluateGuardrails, defaultGuardrailConfig } from '@trading/guardrails';
import type { GuardrailConfig } from '@trading/guardrails';
import { positionSize, selectAdaptiveMultipliers, ADAPTIVE_STATE_WINDOW } from '@trading/risk';
import type { AdaptiveMultiplierState } from '@trading/risk';
import type { SizingConfig } from '@trading/risk';
import { parseDecision } from '@trading/core';
import type { RecordedDecision } from './decisions.js';

export interface BacktestConfig {
  dataset: Dataset;
  decisions: RecordedDecision[];
  symbol: string;
  base: string;
  quote: string;
  initialQuote: number;
  feeRate?: number;
  sizing: SizingConfig;
  atrStopMultiplier: number;
  guardrails?: Partial<GuardrailConfig>;
  collectEquity?: boolean;
  featureSpecs?: { name: string; indicator: 'atr'; params?: Record<string, unknown> }[];
  /** EXPERIMENTAL (default off): exit open positions on ATR stop/TP levels between decisions. */
  enableStops?: boolean;
  /** ATR multiplier for take-profit when `enableStops` is on (default 3). */
  atrTpMultiplier?: number;
  /**
   * EXPERIMENTAL (default `'fixed'`): when `'adaptive'` and `enableStops` is on,
   * stop/TP multipliers are selected per-entry from the trailing ATR percentile
   * (`selectAdaptiveMultipliers`) instead of the fixed multipliers.
   */
  riskParameterMode?: 'fixed' | 'adaptive';
}

export interface TradeRecord {
  timestamp: number;
  clientOrderId: string;
  side: 'buy' | 'sell';
  action: Action;
  quantity: number;
  price: number;
  fee: number;
  status: string;
  realizedPnl: number;
}

export interface OutcomeRecord {
  timestamp: number;
  action: Action;
  allowed: boolean;
  violated: string[];
  invalidDecision: boolean;
}

export interface BacktestResult {
  symbol: string;
  start: number;
  end: number;
  candleCount: number;
  initialQuote: number;
  finalQuoteFree: number;
  finalPosition: number;
  finalPortfolioValue: number;
  realizedPnl: number;
  totalFees: number;
  tradeCount: number;
  guardrailViolations: Record<string, number>;
  trades: TradeRecord[];
  outcomes: OutcomeRecord[];
  equityCurve?: { timestamp: number; equity: number }[];
  /** Counts of selected adaptive states (only present when `riskParameterMode` is `'adaptive'`). */
  adaptiveStates?: Record<AdaptiveMultiplierState, number>;
  checksum: string;
}

const FEATURE_SPECS_DEFAULT = [{ name: 'atr', indicator: 'atr' as const, params: { period: 14 } }];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export class BacktestEngine {
  private readonly config: BacktestConfig;
  private readonly guardrailConfig: GuardrailConfig;
  private readonly featureSpecs: {
    name: string;
    indicator: 'atr';
    params?: Record<string, unknown>;
  }[];

  private exchange!: PaperExchange;
  private candles: Candle[] = [];
  private atrByTimestamp = new Map<number, number>();
  private atrBaseline = 0;
  private atrWindow: number[] = [];
  private adaptiveStateCounts: Record<AdaptiveMultiplierState, number> | null = null;

  private pos = 0;
  private avgEntry = 0;
  private realizedPnl = 0;
  private totalFees = 0;
  private trades: TradeRecord[] = [];
  private outcomes: OutcomeRecord[] = [];
  private clientOrderSeq = 0;

  private tradesThisHour = 0;
  private currentHour = -1;
  private cooldownUntil = 0;
  private dailyLoss = 0;
  private currentDay = -1;
  private equityCurve: { timestamp: number; equity: number }[] = [];
  private exitLevels: { stop: number; tp: number } | null = null;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.guardrailConfig = { ...defaultGuardrailConfig, ...config.guardrails };
    this.featureSpecs = config.featureSpecs ?? FEATURE_SPECS_DEFAULT;
  }

  async run(): Promise<BacktestResult> {
    await this.prepareFeatures();
    await this.loadCandles();

    this.exchange = createPaperExchange({
      balances: { [this.config.quote]: this.config.initialQuote, [this.config.base]: 0 },
      feeRate: this.config.feeRate ?? 0,
    });

    if (this.config.riskParameterMode === 'adaptive') {
      this.adaptiveStateCounts = { expanding: 0, neutral: 0, contracting: 0 };
    }

    let currentDecision = 0;
    const decisions = this.config.decisions;

    for (const candle of this.candles) {
      this.exchange.updatePrice(this.config.symbol, candle.close, candle.timestamp);
      this.advanceHourAndDay(candle.timestamp);

      // pick the decision aligned to this candle (one per timestamp)
      let decision: RecordedDecision | null = null;
      while (
        currentDecision < decisions.length &&
        decisions[currentDecision].timestamp < candle.timestamp
      ) {
        currentDecision++;
      }
      if (
        currentDecision < decisions.length &&
        decisions[currentDecision].timestamp === candle.timestamp
      ) {
        decision = decisions[currentDecision];
        currentDecision++;
      }

      await this.processCandle(candle, decision);

      if (this.config.collectEquity) {
        this.equityCurve.push(await this.equityAt(candle.timestamp, candle.close));
      }
    }

    return this.buildResult();
  }

  private async equityAt(
    timestamp: number,
    price: number,
  ): Promise<{ timestamp: number; equity: number }> {
    const balances = await this.exchange.fetchBalance();
    const quoteFree = balances.find((b) => b.asset === this.config.quote)?.free ?? 0;
    const baseTotal = balances.find((b) => b.asset === this.config.base)?.total ?? 0;
    return { timestamp, equity: quoteFree + baseTotal * price };
  }

  private async finalBook(price: number): Promise<{
    finalQuoteFree: number;
    baseTotal: number;
    finalPortfolioValue: number;
  }> {
    const balances = await this.exchange.fetchBalance();
    const quoteFree = balances.find((b) => b.asset === this.config.quote)?.free ?? 0;
    const baseTotal = balances.find((b) => b.asset === this.config.base)?.total ?? 0;
    return {
      finalQuoteFree: quoteFree,
      baseTotal,
      finalPortfolioValue: quoteFree + baseTotal * price,
    };
  }

  private async prepareFeatures(): Promise<void> {
    const pipeline = new FeaturePipeline(this.config.dataset, this.featureSpecs);
    for await (const row of pipeline.rows()) {
      const atr = row.features.atr;
      if (typeof atr === 'number' && !Number.isNaN(atr)) {
        this.atrByTimestamp.set(row.candle.timestamp, atr);
      }
    }
    this.atrBaseline = median([...this.atrByTimestamp.values()]);
  }

  private async loadCandles(): Promise<void> {
    const replay = new ReplayLoader(this.config.dataset);
    const all = await replay.all();
    this.candles = [...all].sort((a, b) => a.timestamp - b.timestamp);
  }

  private advanceHourAndDay(ts: number): void {
    const hour = Math.floor(ts / 3_600_000);
    if (hour !== this.currentHour) {
      this.currentHour = hour;
      this.tradesThisHour = 0;
    }
    const day = Math.floor(ts / 86_400_000);
    if (day !== this.currentDay) {
      this.currentDay = day;
      this.dailyLoss = 0;
    }
  }

  private async processCandle(candle: Candle, decision: RecordedDecision | null): Promise<void> {
    const timestamp = candle.timestamp;
    const price = candle.close;

    if (this.config.riskParameterMode === 'adaptive') {
      const atrNow = this.atrByTimestamp.get(timestamp);
      if (typeof atrNow === 'number' && atrNow > 0) {
        this.atrWindow.push(atrNow);
        if (this.atrWindow.length > ADAPTIVE_STATE_WINDOW) {
          this.atrWindow.shift();
        }
      }
    }

    if (this.config.enableStops && this.pos !== 0 && this.exitLevels) {
      await this.checkStopTp(timestamp, candle);
    }

    if (!decision) {
      this.outcomes.push({
        timestamp,
        action: 'hold',
        allowed: true,
        violated: [],
        invalidDecision: false,
      });
      return;
    }

    const validated = parseDecision({ action: decision.action, confidence: decision.confidence });
    if (!validated.success || !validated.data) {
      this.outcomes.push({
        timestamp,
        action: decision.action,
        allowed: false,
        violated: ['invalid_decision'],
        invalidDecision: true,
      });
      return;
    }

    const action = validated.data.action;
    const confidence = validated.data.confidence;

    if (action === 'hold') {
      this.outcomes.push({
        timestamp,
        action: 'hold',
        allowed: true,
        violated: [],
        invalidDecision: false,
      });
      return;
    }

    const balances = await this.exchange.fetchBalance();
    const quoteBal = balances.find((b) => b.asset === this.config.quote);
    const baseBal = balances.find((b) => b.asset === this.config.base);
    const quoteFree = quoteBal?.free ?? 0;
    const baseTotal = baseBal?.total ?? 0;

    const portfolioValue = quoteFree + baseTotal * price;
    const positionPercent = portfolioValue > 0 ? (baseTotal * price) / portfolioValue : 0;
    const proposedPositionSize = positionSize(portfolioValue, quoteFree, this.config.sizing);
    const atr = this.atrByTimestamp.get(timestamp) ?? 0;

    const result = evaluateGuardrails({
      now: timestamp,
      action,
      confidence,
      decisionLatencyMs: 0,
      exchangeStatus: 'online',
      market: {
        spread: 0,
        volume: candle.volume,
        atr,
        atrBaseline: this.atrBaseline,
        candleTimestamp: timestamp,
        clockSkewMs: 0,
      },
      portfolio: {
        positionPercent,
        dailyLoss: this.dailyLoss,
        cash: quoteFree,
        proposedPositionSize,
        tradesThisHour: this.tradesThisHour,
        inCooldown: timestamp < this.cooldownUntil,
        duplicateClientOrderId: false,
      },
      device: {
        batteryPercent: 100,
        lastHeartbeatTimestamp: timestamp,
      },
      config: this.guardrailConfig,
    });

    if (!result.allowed) {
      this.outcomes.push({
        timestamp,
        action: result.action,
        allowed: false,
        violated: result.violated,
        invalidDecision: false,
      });
      return;
    }

    await this.executeTrade(timestamp, action, price, proposedPositionSize);
    this.outcomes.push({
      timestamp,
      action: result.action,
      allowed: true,
      violated: [],
      invalidDecision: false,
    });
  }

  private async checkStopTp(timestamp: number, candle: Candle): Promise<void> {
    const { stop, tp } = this.exitLevels!;
    const resume = candle.close;
    if (this.pos > 0) {
      if (candle.low <= stop) {
        await this.closePosition(timestamp, stop, resume);
        return;
      }
      if (candle.high >= tp) {
        await this.closePosition(timestamp, tp, resume);
      }
    } else {
      if (candle.high >= stop) {
        await this.closePosition(timestamp, stop, resume);
        return;
      }
      if (candle.low <= tp) {
        await this.closePosition(timestamp, tp, resume);
      }
    }
  }

  private async closePosition(timestamp: number, price: number, resume: number): Promise<void> {
    const side: 'buy' | 'sell' = this.pos > 0 ? 'sell' : 'buy';
    const quantity = Math.abs(this.pos);
    this.exchange.updatePrice(this.config.symbol, price, timestamp);
    const clientOrderId = `bt-${++this.clientOrderSeq}`;
    const filled = await this.exchange.createOrder({
      symbol: this.config.symbol,
      side,
      type: 'market',
      quantity,
      clientOrderId,
    });
    this.exchange.updatePrice(this.config.symbol, resume, timestamp);

    const fillPrice = filled.averagePrice ?? filled.price ?? price;
    const fee = fillPrice * quantity * (this.config.feeRate ?? 0);
    this.totalFees += fee;
    const realized = this.applyFill(side, quantity, fillPrice);

    this.trades.push({
      timestamp,
      clientOrderId,
      side,
      action: side === 'sell' ? 'short' : 'long',
      quantity,
      price: fillPrice,
      fee,
      status: filled.status,
      realizedPnl: realized,
    });
    this.exitLevels = null;
    this.tradesThisHour += 1;
  }

  private async executeTrade(
    timestamp: number,
    action: Action,
    price: number,
    proposedPositionSize: number,
  ): Promise<void> {
    const orders: { side: 'buy' | 'sell'; quantity: number }[] = [];

    // flatten any opposite position first
    if (this.pos > 0 && action === 'short') {
      orders.push({ side: 'sell', quantity: this.pos });
    } else if (this.pos < 0 && action === 'long') {
      orders.push({ side: 'buy', quantity: -this.pos });
    }

    const openQty = proposedPositionSize / price;
    orders.push({ side: action === 'long' ? 'buy' : 'sell', quantity: openQty });

    let openPrice = price;
    for (const order of orders) {
      const clientOrderId = `bt-${++this.clientOrderSeq}`;
      const filled = await this.exchange.createOrder({
        symbol: this.config.symbol,
        side: order.side,
        type: 'market',
        quantity: order.quantity,
        clientOrderId,
      });

      const fillPrice = filled.averagePrice ?? filled.price ?? price;
      openPrice = fillPrice;
      const fee = fillPrice * order.quantity * (this.config.feeRate ?? 0);
      this.totalFees += fee;
      const realized = this.applyFill(order.side, order.quantity, fillPrice);

      this.trades.push({
        timestamp,
        clientOrderId,
        side: order.side,
        action,
        quantity: order.quantity,
        price: fillPrice,
        fee,
        status: filled.status,
        realizedPnl: realized,
      });
    }

    this.tradesThisHour += 1;

    if (this.config.enableStops) {
      const atr = this.atrByTimestamp.get(timestamp) ?? 0;
      if (atr > 0) {
        if (this.config.riskParameterMode === 'adaptive') {
          const sel = selectAdaptiveMultipliers(this.atrWindow, atr);
          if (this.adaptiveStateCounts) this.adaptiveStateCounts[sel.state] += 1;
          this.exitLevels =
            action === 'long'
              ? { stop: openPrice - atr * sel.stopMult, tp: openPrice + atr * sel.tpMult }
              : { stop: openPrice + atr * sel.stopMult, tp: openPrice - atr * sel.tpMult };
        } else {
          const stopMult = this.config.atrStopMultiplier;
          const tpMult = this.config.atrTpMultiplier ?? 3;
          this.exitLevels =
            action === 'long'
              ? { stop: openPrice - atr * stopMult, tp: openPrice + atr * tpMult }
              : { stop: openPrice + atr * stopMult, tp: openPrice - atr * tpMult };
        }
      } else {
        this.exitLevels = null;
      }
    }
  }

  private applyFill(side: 'buy' | 'sell', quantity: number, price: number): number {
    let realized = 0;
    if (side === 'buy') {
      if (this.pos < 0) {
        const closeQty = Math.min(quantity, -this.pos);
        realized = (this.avgEntry - price) * closeQty;
        this.pos += closeQty;
        if (this.pos === 0) this.avgEntry = 0;
        const remaining = quantity - closeQty;
        if (remaining > 0) {
          this.pos += remaining;
          this.avgEntry = price;
        }
      } else {
        const newPos = this.pos + quantity;
        this.avgEntry = newPos > 0 ? (this.avgEntry * this.pos + price * quantity) / newPos : price;
        this.pos = newPos;
      }
    } else {
      if (this.pos > 0) {
        const closeQty = Math.min(quantity, this.pos);
        realized = (price - this.avgEntry) * closeQty;
        this.pos -= closeQty;
        if (this.pos === 0) this.avgEntry = 0;
        const remaining = quantity - closeQty;
        if (remaining > 0) {
          this.pos -= remaining;
          this.avgEntry = price;
        }
      } else {
        const newPos = this.pos - quantity;
        this.avgEntry = newPos < 0 ? (this.avgEntry * this.pos - price * quantity) / newPos : price;
        this.pos = newPos;
      }
    }
    if (realized !== 0) {
      this.realizedPnl += realized;
      if (realized < 0) this.dailyLoss += -realized;
    }
    return realized;
  }

  private async buildResult(): Promise<BacktestResult> {
    const first = this.candles[0];
    const last = this.candles[this.candles.length - 1];
    const price = last ? last.close : 0;

    const book = await this.finalBook(price);

    const guardrailViolations: Record<string, number> = {};
    for (const o of this.outcomes) {
      for (const v of o.violated) {
        guardrailViolations[v] = (guardrailViolations[v] ?? 0) + 1;
      }
    }

    const result: Omit<BacktestResult, 'checksum'> = {
      symbol: this.config.symbol,
      start: first?.timestamp ?? 0,
      end: last?.timestamp ?? 0,
      candleCount: this.candles.length,
      initialQuote: this.config.initialQuote,
      finalQuoteFree: book.finalQuoteFree,
      finalPosition: book.baseTotal,
      finalPortfolioValue: book.finalPortfolioValue,
      realizedPnl: this.realizedPnl,
      totalFees: this.totalFees,
      tradeCount: this.trades.length,
      guardrailViolations,
      trades: this.trades,
      outcomes: this.outcomes,
      ...(this.config.collectEquity ? { equityCurve: this.equityCurve } : {}),
      ...(this.adaptiveStateCounts ? { adaptiveStates: { ...this.adaptiveStateCounts } } : {}),
    };

    const checksum = createHash('sha256')
      .update(JSON.stringify({ ...result, checksum: undefined }))
      .digest('hex')
      .slice(0, 16);

    return { ...result, checksum };
  }
}

export function loadDataset(dir: string): Dataset {
  return new JsonlLoader(dir);
}
