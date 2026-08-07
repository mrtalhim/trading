import { createHash } from 'node:crypto';
import { parseDecision } from '@trading/core';
import { ReplayLoader } from '@trading/datasets';
import { FeaturePipeline } from '@trading/features';
import { BudgetTracker, createPaperExchange, } from '@trading/exchanges';
import { evaluateGuardrails, defaultGuardrailConfig } from '@trading/guardrails';
import { positionSize } from '@trading/risk';
import { clearCommand as clearDefaultCommandFn, readCommand as readDefaultCommandFn, writeStatus as writeDefaultStatusFn, } from './signal.js';
import { StateStore } from './state.js';
const DEFAULT_CLOCK = { skewMs: () => 0, now: () => Date.now() };
async function loadCandles(dataset) {
    const replay = new ReplayLoader(dataset);
    return [...(await replay.all())].sort((a, b) => a.timestamp - b.timestamp);
}
async function computeAtr(dataset) {
    const pipeline = new FeaturePipeline(dataset, [
        { name: 'atr', indicator: 'atr', params: { period: 14 } },
    ]);
    const atrByTimestamp = new Map();
    for await (const row of pipeline.rows()) {
        const atr = row.features.atr;
        if (typeof atr === 'number' && !Number.isNaN(atr)) {
            atrByTimestamp.set(row.candle.timestamp, atr);
        }
    }
    const values = [...atrByTimestamp.values()].sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const atrBaseline = values.length === 0
        ? 0
        : values.length % 2 === 0
            ? (values[mid - 1] + values[mid]) / 2
            : values[mid];
    return { atrByTimestamp, atrBaseline };
}
export class AgentEngine {
    config;
    deps;
    guardrailConfig;
    store;
    clock;
    budget;
    constructor(config, deps = {}) {
        this.config = config;
        this.deps = deps;
        this.guardrailConfig = { ...defaultGuardrailConfig, ...config.guardrails };
        this.store = deps.store ?? new StateStore(config.stateDir, config.ownerId);
        this.clock = deps.clock ?? DEFAULT_CLOCK;
        this.budget = deps.budget ?? new BudgetTracker({ dailyBudgetIdr: config.dailyBudgetIdr });
    }
    async run(input) {
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
            readCommand: depsRelative(this.deps.readCommand, readDefaultCommandFn),
            clearCommand: depsRelative(this.deps.clearCommand, clearDefaultCommandFn),
            writeStatusFn: this.deps.writeStatusFn ?? writeDefaultStatusFn,
        });
        const result = await runner.run(candles, input.decisions);
        await this.store.append({ ts: this.clock.now(), type: 'stop' });
        await this.store.snapshot(runner.state);
        return result;
    }
}
function depsRelative(custom, fallback) {
    return custom ?? fallback;
}
class CycleRunner {
    config;
    guardrailConfig;
    ctx;
    trades = [];
    outcomes = [];
    totalFees = 0;
    tradesThisHour = 0;
    currentHour = -1;
    dailyLoss = 0;
    currentDay = -1;
    cooldownUntil = 0;
    paused = false;
    reconcileCounter = 0;
    commandCounter = 0;
    position = 0;
    avgEntry = 0;
    realizedPnl = 0;
    constructor(config, guardrailConfig, ctx) {
        this.config = config;
        this.guardrailConfig = guardrailConfig;
        this.ctx = ctx;
    }
    get state() {
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
    async run(candles, decisions) {
        if (candles.length === 0)
            return this.buildResult(candles, 0);
        let currentDecision = 0;
        for (const candle of candles) {
            const command = await this.readCommandOnce();
            if (command === 'shutdown') {
                await this.ctx.clearCommand(this.config.runDir);
                break;
            }
            if (command === 'pause') {
                this.paused = true;
                await this.ctx.clearCommand(this.config.runDir);
            }
            else if (command === 'resume') {
                this.paused = false;
                await this.ctx.clearCommand(this.config.runDir);
            }
            else if (command === 'status') {
                await this.ctx.writeStatusFn(this.config.runDir, {
                    state: this.paused ? 'paused' : 'running',
                    candleCount: this.outcomes.length,
                });
                await this.ctx.clearCommand(this.config.runDir);
            }
            this.ctx.exchange.updatePrice(this.config.pair, candle.close, candle.timestamp);
            this.advanceHourAndDay(candle.timestamp);
            let decision = null;
            while (currentDecision < decisions.length &&
                decisions[currentDecision].timestamp < candle.timestamp) {
                currentDecision += 1;
            }
            if (currentDecision < decisions.length &&
                decisions[currentDecision].timestamp === candle.timestamp) {
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
    async readCommandOnce() {
        this.commandCounter += 1;
        if (this.commandCounter % this.config.commandCheckEveryCandles !== 0)
            return null;
        return this.ctx.readCommand(this.config.runDir);
    }
    async reconcile(_timestamp) {
        const balances = await this.ctx.exchange.fetchBalance();
        this.position = balances.find((b) => b.asset === this.config.base)?.total ?? this.position;
        this.ctx.state.position = this.position;
        this.ctx.state.openOrders = this.trades.map((t) => ({
            clientOrderId: t.clientOrderId,
            symbol: this.config.pair,
        }));
    }
    advanceHourAndDay(ts) {
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
    async processCandle(candle, decision) {
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
        if (this.paused) {
            this.outcomes.push({
                timestamp,
                action: 'hold',
                allowed: true,
                violated: ['paused'],
                invalidDecision: false,
            });
            return;
        }
        const balances = await this.ctx.exchange.fetchBalance();
        const quoteFree = balances.find((b) => b.asset === this.config.quote)?.free ?? 0;
        const baseTotal = balances.find((b) => b.asset === this.config.base)?.total ?? 0;
        const portfolioValue = quoteFree + baseTotal * price;
        const positionPercent = portfolioValue > 0 ? (baseTotal * price) / portfolioValue : 0;
        const proposedPositionSize = positionSize(portfolioValue, quoteFree, this.config.sizing);
        const atr = this.ctx.atrByTimestamp.get(timestamp) ?? 0;
        if (proposedPositionSize > 0 && proposedPositionSize < this.config.minNotionalIdr) {
            this.outcomes.push({
                timestamp,
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
            this.outcomes.push({
                timestamp,
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
            this.outcomes.push({
                timestamp,
                action,
                allowed: false,
                violated: ['budget_cap'],
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
    async executeTrade(timestamp, action, price, proposedPositionSize) {
        const orders = [];
        if (this.position > 0 && action === 'short') {
            orders.push({ side: 'sell', quantity: this.position });
        }
        else if (this.position < 0 && action === 'long') {
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
    applyFill(side, quantity, price) {
        let realized = 0;
        if (side === 'buy') {
            if (this.position < 0) {
                const closeQty = Math.min(quantity, -this.position);
                realized = (this.avgEntry - price) * closeQty;
                this.position += closeQty;
                if (this.position === 0)
                    this.avgEntry = 0;
                const remaining = quantity - closeQty;
                if (remaining > 0) {
                    this.position += remaining;
                    this.avgEntry = price;
                }
            }
            else {
                const newPos = this.position + quantity;
                this.avgEntry = newPos > 0 ? (this.avgEntry * this.position + price * quantity) / newPos : price;
                this.position = newPos;
            }
        }
        else {
            if (this.position > 0) {
                const closeQty = Math.min(quantity, this.position);
                realized = (price - this.avgEntry) * closeQty;
                this.position -= closeQty;
                if (this.position === 0)
                    this.avgEntry = 0;
                const remaining = quantity - closeQty;
                if (remaining > 0) {
                    this.position -= remaining;
                    this.avgEntry = price;
                }
            }
            else {
                const newPos = this.position - quantity;
                this.avgEntry = newPos < 0 ? (this.avgEntry * this.position - price * quantity) / newPos : price;
                this.position = newPos;
            }
        }
        if (realized !== 0) {
            this.realizedPnl += realized;
            if (realized < 0)
                this.dailyLoss += -realized;
        }
        return realized;
    }
    async buildResult(candles, lastPrice) {
        const first = candles[0];
        const last = candles[candles.length - 1];
        const price = last ? last.close : lastPrice;
        const balances = await this.ctx.exchange.fetchBalance();
        const finalQuoteFree = balances.find((b) => b.asset === this.config.quote)?.free ?? 0;
        const baseTotal = balances.find((b) => b.asset === this.config.base)?.total ?? 0;
        const finalPortfolioValue = finalQuoteFree + baseTotal * price;
        const guardrailViolations = {};
        for (const o of this.outcomes) {
            for (const v of o.violated) {
                guardrailViolations[v] = (guardrailViolations[v] ?? 0) + 1;
            }
        }
        const result = {
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
//# sourceMappingURL=engine.js.map