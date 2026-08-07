export type AgentCommand = 'pause' | 'resume' | 'shutdown' | 'status';
export interface CommandFile {
    command: AgentCommand;
    issuedAt: number;
}
export interface StatusFile {
    state: 'paused' | 'running' | 'stopped';
    candleCount: number;
    trades?: number;
    realizedPnl?: number;
    position?: number;
    budgetSpentIdr?: number;
}
export declare function statusPath(dir: string): string;
export declare function readCommand(dir: string): Promise<AgentCommand | null>;
export declare function clearCommand(dir: string): Promise<void>;
export declare function writeCommand(dir: string, command: AgentCommand): Promise<void>;
export declare function writeStatus(dir: string, status: StatusFile): Promise<void>;
//# sourceMappingURL=signal.d.ts.map