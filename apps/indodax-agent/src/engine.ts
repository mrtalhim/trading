import { createHash } from 'node:crypto';
import type { Action, Candle } from '@trading/core';
import { parseDecision } from '@trading/core';
import type { Dataset } from '@trading/datasets';
import { ReplayLoader } from '@trading/datasets';
import { FeaturePipeline } from '@trading/features';
import { BudgetTracker, createPaperExchange, type PaperExchange } from '@trading/exchanges';
import { evaluateGuardrails, defaultGuardrailConfig } from '@trading/guardrails';
import type { GuardrailConfig } from '@trading/guardrails';
import { positionSize } from '@trading/risk';
import type { OutcomeRecord, RecordedDecision, TradeRecord } from '@trading/backtest';
import {
  DecisionLogStore,
  type DecisionLogEntry,
  type DecisionTrade,
  type PauseSource,
} from '@trading/storage';
import {
  clearCommand as clearDefaultCommandFn,
  readCommand as readDefaultCommandFn,
  readEvaluatorPause as readDefaultEvaluatorPauseFn,
  writeStatus as writeDefaultStatusFn,
  type AgentCommand,
  type EvaluatorPauseFile,
  type StatusFile,
} from './signal.js';
import { StateStore, type AgentState } from './state.js';
import type { AgentConfig } from './config.js';

export interface AgentClock {
  skewMs(): number;
  now(): number;
}

export interface AgentResult {
  ownerId: string;
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
  checksum: string;
}

export interface AgentDeps {
  clock?: AgentClock;
  budget?: BudgetTracker;
  store?: StateStore;
  readCommand?: (dir: string) => Promise<AgentCommand | null>;
  clearCommand?: (dir: string) => Promise<void>;
  readEvaluatorPauseFn?: (dir: string, now: number) => Promise<EvaluatorPauseFile | null>;
  decisionLog?: DecisionLogStore;
  writeStatusFn?: (
    runDir: string,
    status: {
      state: 'paused' | 'running' | 'stopped';
      candleCount: number;
      evaluatorPause?: StatusFile['evaluatorPause'];
    },
  ) => Promise<void>;
}

const DEFAULT_CLOCK: AgentClock = { skewMs: () => 0, now: () => Date.now() };

async function loadCandles(dataset: Dataset): Promise<Candle[]> {
  const replay = new ReplayLoader(dataset);
  return [...(await replay.all())].sort((a, b) => a.timestamp - b.timestamp);
}

async function computeAtr(dataset: Dataset): Promise<{
  atrByTimestamp: Map<number, number>;
  atrBaseline: number;
}> {
  const pipeline = new FeaturePipeline(dataset, [
    { name: 'atr', indicator: 'atr', params: { period: 14 } },
  ]);
  const atrByTimestamp = new Map<number, number>();
  for await (const row of pipeline.rows()) {
    const atr = row.features.atr;
    if (typeof atr === 'number' && !Number.isNaN(atr)) {
      atrByTimestamp.set(row.candle.timestamp, atr);
    }
  }
  const values = [...atrByTimestamp.values()].sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const atrBaseline =
    values.length === 0
      ? 0
      : values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
  return { atrByTimestamp, atrBaseline };
}

export class AgentEngine {
  private readonly guardrailConfig: GuardrailConfig;
  private readonly store: StateStore;
  private readonly clock: AgentClock;
  private readonly budget: BudgetTracker;
  private readonly decisionLog: DecisionLogStore;

  constructor(
    private readonly config: AgentConfig,
    private readonly deps: AgentDeps = {},
  ) {
    this.guardrailConfig = { ...defaultGuardrailConfig, ...config.guardrails };
    this.store = deps.store ?? new StateStore(config.stateDir, config.ownerId);
    this.clock = deps.clock ?? DEFAULT_CLOCK;
    this.budget = deps.budget ?? new BudgetTracker({ dailyBudgetIdr: config.dailyBudgetIdr });
    this.decisionLog = deps.decisionLog ?? new DecisionLogStore(config.stateDir);
  }

  async run(input: { dataset: Dataset; decisions: RecordedDecision[] }): Promise<AgentResult> {
    const state = await this.store.load();
    const candles = await loadCandles(input.dataset);
    const { atrByTimestamp, atrBaseline } = await computeAtr(input.dataset);
    const exchange = createPaperExchange({
      balances: { [this.config.quote]: this.config.initialQuote, [this.config.base]: 0 },
      feeRate: this.config.feeRate,
    });

    const runner = new CycleRunner(this.config, this.guardrailConfig, {
      state,
      atrByTimestamp,
      atrBaseline,
      exchange,
      clock: this.clock,
      budget: this.budget,
      decisionLog: this.decisionLog,
      readCommand: depsRelative(this.deps.readCommand, readDefaultCommandFn),
      clearCommand: depsRelative(this.deps.clearCommand, clearDefaultCommandFn),
      readEvaluatorPause: depsRelative(this.deps.readEvaluatorPauseFn, readDefaultEvaluatorPauseFn),
      writeStatusFn: this.deps.writeStatusFn ?? writeDefaultStatusFn,
    });

    const result = await runner.run(candles, input.decisions);
    await this.store.append({ ts: this.clock.now(), type: 'stop' });
    await this.store.snapshot(runner.state);
    return result;
  }
}

function depsRelative<F>(custom: F | undefined, fallback: F): F {
  return custom ?? fallback;
}

interface CycleCtx {
  state: AgentState;
  atrByTimestamp: Map<number, number>;
  atrBaseline: number;
  exchange: PaperExchange;
  clock: AgentClock;
  budget: BudgetTracker;
  decisionLog: DecisionLogStore;
  readCommand: (dir: string) => Promise<AgentCommand | null>;
  clearCommand: (dir: string) => Promise<void>;
  readEvaluatorPause: (dir: string, now: number) => Promise<EvaluatorPauseFile | null>;
  writeStatusFn: (
    runDir: string,
    status: {
      state: 'paused' | 'running' | 'stopped';
      candleCount: number;
      evaluatorPause?: StatusFile['evaluatorPause'];
    },
  ) => Promise<void>;
}

class CycleRunner {
  private trades: TradeRecord[] = [];
  private outcomes: OutcomeRecord[] = [];
  private totalFees = 0;
  private tradesThisHour = 0;
  private currentHour = -1;
  private dailyLoss = 0;
  private currentDay = -1;
  private cooldownUntil = 0;
  private manualPaused = false;
  private evaluatorPaused = false;
  private evaluatorPauseInfo: StatusFile['evaluatorPause'] | null = null;
  private reconcileCounter = 0;
  private commandCounter = 0;
  private position = 0;
  private avgEntry = 0;
  private realizedPnl = 0;

  constructor(
    private readonly config: AgentConfig,
    private readonly guardrailConfig: GuardrailConfig,
    private readonly ctx: CycleCtx,
  ) {}

  get state(): AgentState {
    this.ctx.state.position = this.position;
    this.ctx.state.avgEntry = this.avgEntry;
    this.ctx.state.realizedPnl = this.realizedPnl;
    this.ctx.state.spentIdr = this.ctx.budget.spent();
    this.ctx.state.openOrders = this.trades.map((t) => ({
      clientOrderId: t.clientOrderId,
      symbol: this.config.pair,
    }));
    return this.ctx.state;
  }

  async run(candles: Candle[], decisions: RecordedDecision[]): Promise<AgentResult> {
    if (candles.length === 0) return this.buildResult(candles, 0);
    let currentDecision = 0;

    for (const candle of candles) {
      const command = await this.readControls();
      if (command === 'shutdown') {
        await this.ctx.clearCommand(this.config.runDir);
        break;
      }
      if (command === 'pause') {
        this.manualPaused = true;
        await this.ctx.clearCommand(this.config.runDir);
      } else if (command === 'resume') {
        this.manualPaused = false;
        await this.ctx.clearCommand(this.config.runDir);
      } else if (command === 'status') {
        await this.ctx.writeStatusFn(this.config.runDir, {
          state: this.manualPaused || this.evaluatorPaused ? 'paused' : 'running',
          candleCount: this.outcomes.length,
          evaluatorPause: this.evaluatorPauseInfo ?? undefined,
        });
        await this.ctx.clearCommand(this.config.runDir);
      }

      this.ctx.exchange.updatePrice(this.config.pair, candle.close, candle.timestamp);
      this.advanceHourAndDay(candle.timestamp);

      let decision: RecordedDecision | null = null;
      while (
        currentDecision < decisions.length &&
        decisions[currentDecision].timestamp < candle.timestamp
      ) {
        currentDecision += 1;
      }
      if (
        currentDecision < decisions.length &&
        decisions[currentDecision].timestamp === candle.timestamp
      ) {
        decision = decisions[currentDecision];
        currentDecision += 1;
      }

      await this.processCandle(candle, decision);

      this.reconcileCounter += 1;
      if (this.reconcileCounter % this.config.reconcileEveryCandles === 0) {
        await this.reconcile(candle.timestamp);
      }
    }

    const last = candles[candles.length - 1];
    return this.buildResult(candles, last.close);
  }

  private async readControls(): Promise<AgentCommand | null> {
    this.commandCounter += 1;
    if (this.commandCounter % this.config.commandCheckEveryCandles !== 0) return null;
    const command = await this.ctx.readCommand(this.config.runDir);
    const pause = await this.ctx.readEvaluatorPause(this.config.runDir, this.ctx.clock.now());
    this.evaluatorPaused = pause !== null;
    this.evaluatorPauseInfo = pause
      ? {
          active: true,
          reason: pause.reason,
          expiresAt: pause.expiresAt,
          metrics: pause.metrics,
        }
      : null;
    return command;
  }

  private async reconcile(_timestamp: number): Promise<void> {
    const balances = await this.ctx.exchange.fetchBalance();
    this.position = balances.find((b) => b.asset === this.config.base)?.total ?? this.position;
    this.ctx.state.position = this.position;
    this.ctx.state.openOrders = this.trades.map((t) => ({
      clientOrderId: t.clientOrderId,
      symbol: this.config.pair,
    }));
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

    if (!decision) return;

    const validated = parseDecision({ action: decision.action, confidence: decision.confidence });
    if (!validated.success || !validated.data) {
      await this.recordOutcome(candle, decision, {
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
      await this.recordOutcome(candle, decision, {
        action: 'hold',
        allowed: true,
        violated: [],
        invalidDecision: false,
      });
      return;
    }

    if (this.manualPaused || this.evaluatorPaused) {
      await this.recordOutcome(
        candle,
        decision,
        {
          action: 'hold',
          allowed: true,
          violated: this.manualPaused ? ['paused'] : [],
          invalidDecision: false,
        },
        this.manualPaused ? 'manual' : 'evaluator',
      );
      return;
    }

    const balances = await this.ctx.exchange.fetchBalance();
    const quoteFree = balances.find((b) => b.asset === this.config.quote)?.free ?? 0;
    const baseTotal = balances.find((b) => b.asset === this.config.base)?.total ?? 0;

    const portfolioValue = quoteFree + baseTotal * candle.close;
    const positionPercent = portfolioValue > 0 ? (baseTotal * candle.close) / portfolioValue : 0;
    const proposedPositionSize = positionSize(portfolioValue, quoteFree, this.config.sizing);
    const atr = this.ctx.atrByTimestamp.get(timestamp) ?? 0;

    if (proposedPositionSize > 0 && proposedPositionSize < this.config.minNotionalIdr) {
      await this.recordOutcome(candle, decision, {
        action,
        allowed: false,
        violated: ['below_min_notional'],
        invalidDecision: false,
      });
      return;
    }

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
        atrBaseline: this.ctx.atrBaseline,
        candleTimestamp: timestamp,
        clockSkewMs: this.ctx.clock.skewMs(),
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
      await this.recordOutcome(candle, decision, {
        action: result.action,
        allowed: false,
        violated: result.violated,
        invalidDecision: false,
      });
      return;
    }

    const notional = proposedPositionSize;
    const feeEstimate = notional * this.config.feeRate;
    if (!this.ctx.budget.spend(notional + feeEstimate)) {
      await this.recordOutcome(candle, decision, {
        action,
        allowed: false,
        violated: ['budget_cap'],
        invalidDecision: false,
      });
      return;
    }

    const before = {
      trades: this.trades.length,
      pnl: this.realizedPnl,
      fees: this.totalFees,
    };
    await this.executeTrade(timestamp, action, candle.close, proposedPositionSize);
    await this.recordOutcome(
      candle,
      decision,
      {
        action: result.action,
        allowed: true,
        violated: [],
        invalidDecision: false,
      },
      null,
      before,
    );
  }

  private async recordOutcome(
    candle: Candle,
    decision: RecordedDecision,
    partial: Pick<OutcomeRecord, 'action' | 'allowed' | 'violated' | 'invalidDecision'>,
    pausedBy: PauseSource = null,
    before?: { trades: number; pnl: number; fees: number },
  ): Promise<void> {
    const tradesBefore = before?.trades ?? this.trades.length;
    const pnlBefore = before?.pnl ?? this.realizedPnl;
    const feeBefore = before?.fees ?? this.totalFees;

    const outcome: OutcomeRecord = { timestamp: candle.timestamp, ...partial };
    this.outcomes.push(outcome);

    const cycleTrades = this.trades.slice(tradesBefore);
    const entry: DecisionLogEntry = {
      ts: this.ctx.clock.now(),
      candleTimestamp: candle.timestamp,
      pair: this.config.pair,
      model: decision.model ?? null,
      action: decision.action,
      confidence: Number.isFinite(decision.confidence) ? decision.confidence : 0,
      invalidDecision: outcome.invalidDecision,
      allowed: outcome.allowed,
      violated: outcome.violated,
      pausedBy,
      price: candle.close,
      position: this.position,
      realizedPnl: this.realizedPnl - pnlBefore,
      fee: this.totalFees - feeBefore,
      tradeIds: cycleTrades.map((t) => t.clientOrderId),
      trades: cycleTrades.map((t): DecisionTrade => ({
        clientOrderId: t.clientOrderId,
        side: t.side,
        action: t.action,
        quantity: t.quantity,
        price: t.price,
        fee: t.fee,
        status: t.status,
        realizedPnl: t.realizedPnl,
      })),
      llmLatencyMs: decision.llmLatencyMs ?? null,
      usage: decision.usage ?? null,
    };

    await this.ctx.decisionLog.append(entry);
  }

  private async executeTrade(
    timestamp: number,
    action: Action,
    price: number,
    proposedPositionSize: number,
  ): Promise<void> {
    const orders: { side: 'buy' | 'sell'; quantity: number }[] = [];

    if (this.position > 0 && action === 'short') {
      orders.push({ side: 'sell', quantity: this.position });
    } else if (this.position < 0 && action === 'long') {
      orders.push({ side: 'buy', quantity: -this.position });
    }

    const openQty = proposedPositionSize / price;
    orders.push({ side: action === 'long' ? 'buy' : 'sell', quantity: openQty });

    for (const order of orders) {
      const clientOrderId = `${this.config.ownerId}-${++this.ctx.state.seq}`;
      const filled = await this.ctx.exchange.createOrder({
        symbol: this.config.pair,
        side: order.side,
        type: 'market',
        quantity: order.quantity,
        clientOrderId,
      });

      const fillPrice = filled.averagePrice ?? filled.price ?? price;
      const fee = fillPrice * order.quantity * this.config.feeRate;
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
      if (this.position < 0) {
        const closeQty = Math.min(quantity, -this.position);
        realized = (this.avgEntry - price) * closeQty;
        this.position += closeQty;
        if (this.position === 0) this.avgEntry = 0;
        const remaining = quantity - closeQty;
        if (remaining > 0) {
          this.position += remaining;
          this.avgEntry = price;
        }
      } else {
        const newPos = this.position + quantity;
        this.avgEntry =
          newPos > 0 ? (this.avgEntry * this.position + price * quantity) / newPos : price;
        this.position = newPos;
      }
    } else {
      if (this.position > 0) {
        const closeQty = Math.min(quantity, this.position);
        realized = (price - this.avgEntry) * closeQty;
        this.position -= closeQty;
        if (this.position === 0) this.avgEntry = 0;
        const remaining = quantity - closeQty;
        if (remaining > 0) {
          this.position -= remaining;
          this.avgEntry = price;
        }
      } else {
        const newPos = this.position - quantity;
        this.avgEntry =
          newPos < 0 ? (this.avgEntry * this.position - price * quantity) / newPos : price;
        this.position = newPos;
      }
    }
    if (realized !== 0) {
      this.realizedPnl += realized;
      if (realized < 0) this.dailyLoss += -realized;
    }
    return realized;
  }

  private async buildResult(candles: Candle[], lastPrice: number): Promise<AgentResult> {
    const first = candles[0];
    const last = candles[candles.length - 1];
    const price = last ? last.close : lastPrice;

    const balances = await this.ctx.exchange.fetchBalance();
    const finalQuoteFree = balances.find((b) => b.asset === this.config.quote)?.free ?? 0;
    const baseTotal = balances.find((b) => b.asset === this.config.base)?.total ?? 0;
    const finalPortfolioValue = finalQuoteFree + baseTotal * price;

    const guardrailViolations: Record<string, number> = {};
    for (const o of this.outcomes) {
      for (const v of o.violated) {
        guardrailViolations[v] = (guardrailViolations[v] ?? 0) + 1;
      }
    }

    const result: Omit<AgentResult, 'checksum'> = {
      ownerId: this.config.ownerId,
      start: first?.timestamp ?? 0,
      end: last?.timestamp ?? 0,
      candleCount: candles.length,
      initialQuote: this.config.initialQuote,
      finalQuoteFree,
      finalPosition: baseTotal,
      finalPortfolioValue,
      realizedPnl: this.realizedPnl,
      totalFees: this.totalFees,
      tradeCount: this.trades.length,
      guardrailViolations,
      trades: this.trades,
      outcomes: this.outcomes,
    };

    const checksum = createHash('sha256')
      .update(JSON.stringify({ ...result, checksum: undefined }))
      .digest('hex')
      .slice(0, 16);

    return { ...result, checksum };
  }
}
