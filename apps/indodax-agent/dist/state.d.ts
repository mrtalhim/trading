export interface AgentState {
    ownerId: string;
    seq: number;
    position: number;
    avgEntry: number;
    realizedPnl: number;
    spentIdr: number;
    tradesThisHour: number;
    dailyLoss: number;
    openOrders: {
        clientOrderId: string;
        symbol: string;
    }[];
}
export type StateEvent = {
    ts: number;
    type: 'start' | 'stop';
} | {
    ts: number;
    type: 'trade';
    trade: {
        clientOrderId: string;
        side: 'buy' | 'sell';
        quantity: number;
        price: number;
        fee: number;
        realizedPnl: number;
    };
} | {
    ts: number;
    type: 'reconcile';
    position: number;
    consistent: boolean;
};
export declare function freshState(ownerId: string): AgentState;
export declare class StateStore {
    private readonly dir;
    private readonly ownerId;
    constructor(dir: string, ownerId: string);
    private eventsPath;
    private snapshotPath;
    load(): Promise<AgentState>;
    append(event: StateEvent): Promise<void>;
    snapshot(state: AgentState): Promise<void>;
    events(): AsyncIterable<StateEvent>;
}
//# sourceMappingURL=state.d.ts.map