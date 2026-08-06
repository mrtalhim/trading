import { createHash } from 'node:crypto';
import type { Candle, Action } from '@trading/core';
import type { Dataset } from '@trading/datasets';
import { JsonlLoader, ReplayLoader } from '@trading/datasets';
import { FeaturePipeline } from '@trading/features';
import { PaperExchange, createPaperExchange } from '@trading/exchanges';
import { evaluateGuardrails, defaultGuardrailConfig } from '@trading/guardrails';
import type { GuardrailConfig } from '@trading/guardrails';
import { positionSize } from '@trading/risk';
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
