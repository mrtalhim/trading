import type { Dataset } from '@trading/datasets';
import { BudgetTracker } from '@trading/exchanges';
import type { OutcomeRecord, RecordedDecision, TradeRecord } from '@trading/backtest';
import { type AgentCommand } from './signal.js';
import { StateStore } from './state.js';
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
    writeStatusFn?: (runDir: string, status: {
        state: 'paused' | 'running' | 'stopped';
        candleCount: number;
    }) => Promise<void>;
}
export declare class AgentEngine {
    private readonly config;
    private readonly deps;
    private readonly guardrailConfig;
    private readonly store;
    private readonly clock;
    private readonly budget;
    constructor(config: AgentConfig, deps?: AgentDeps);
    run(input: {
        dataset: Dataset;
        decisions: RecordedDecision[];
    }): Promise<AgentResult>;
}
//# sourceMappingURL=engine.d.ts.map