export declare const DEFAULT_DATASET = "datasets/realistic/btc_idr_15m_2026";
export declare const DEFAULT_RUN_DIR = "apps/indodax-agent/run";
export declare const DEFAULT_STATE_DIR = "apps/indodax-agent/state";
interface CliArgs {
    command: string;
    options: Record<string, string>;
}
export declare function parseArgs(argv: string[]): CliArgs;
export declare function runAgentCli(argv?: string[]): Promise<void>;
export {};
//# sourceMappingURL=cli.d.ts.map