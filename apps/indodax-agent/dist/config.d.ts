import { z } from 'zod';
export declare const AgentConfigSchema: z.ZodObject<{
    mode: z.ZodLiteral<"paper">;
    pair: z.ZodString;
    base: z.ZodString;
    quote: z.ZodString;
    interval: z.ZodString;
    initialQuote: z.ZodNumber;
    feeRate: z.ZodNumber;
    sizing: z.ZodObject<{
        fraction: z.ZodNumber;
        maxPositionFraction: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        fraction: number;
        maxPositionFraction: number;
    }, {
        fraction: number;
        maxPositionFraction: number;
    }>;
    atrStopMultiplier: z.ZodNumber;
    guardrails: z.ZodOptional<z.ZodObject<{
        maxPositionPercent: z.ZodOptional<z.ZodNumber>;
        dailyLossCap: z.ZodOptional<z.ZodNumber>;
        maxTradesPerHour: z.ZodOptional<z.ZodNumber>;
        minConfidence: z.ZodOptional<z.ZodNumber>;
        maxSpread: z.ZodOptional<z.ZodNumber>;
        minVolume: z.ZodOptional<z.ZodNumber>;
        atrSpikeThreshold: z.ZodOptional<z.ZodNumber>;
        maxCandleStalenessMs: z.ZodOptional<z.ZodNumber>;
        maxClockSkewMs: z.ZodOptional<z.ZodNumber>;
        maxLlmLatencyMs: z.ZodOptional<z.ZodNumber>;
        minBatteryPercent: z.ZodOptional<z.ZodNumber>;
        maxHeartbeatGapMs: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        maxPositionPercent?: number | undefined;
        dailyLossCap?: number | undefined;
        maxTradesPerHour?: number | undefined;
        minConfidence?: number | undefined;
        maxSpread?: number | undefined;
        minVolume?: number | undefined;
        atrSpikeThreshold?: number | undefined;
        maxCandleStalenessMs?: number | undefined;
        maxClockSkewMs?: number | undefined;
        maxLlmLatencyMs?: number | undefined;
        minBatteryPercent?: number | undefined;
        maxHeartbeatGapMs?: number | undefined;
    }, {
        maxPositionPercent?: number | undefined;
        dailyLossCap?: number | undefined;
        maxTradesPerHour?: number | undefined;
        minConfidence?: number | undefined;
        maxSpread?: number | undefined;
        minVolume?: number | undefined;
        atrSpikeThreshold?: number | undefined;
        maxCandleStalenessMs?: number | undefined;
        maxClockSkewMs?: number | undefined;
        maxLlmLatencyMs?: number | undefined;
        minBatteryPercent?: number | undefined;
        maxHeartbeatGapMs?: number | undefined;
    }>>;
    minNotionalIdr: z.ZodNumber;
    dailyBudgetIdr: z.ZodNumber;
    ownerId: z.ZodString;
    runDir: z.ZodString;
    stateDir: z.ZodString;
    reconcileEveryCandles: z.ZodDefault<z.ZodNumber>;
    commandCheckEveryCandles: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    mode: "paper";
    pair: string;
    base: string;
    quote: string;
    interval: string;
    initialQuote: number;
    feeRate: number;
    sizing: {
        fraction: number;
        maxPositionFraction: number;
    };
    atrStopMultiplier: number;
    minNotionalIdr: number;
    dailyBudgetIdr: number;
    ownerId: string;
    runDir: string;
    stateDir: string;
    reconcileEveryCandles: number;
    commandCheckEveryCandles: number;
    guardrails?: {
        maxPositionPercent?: number | undefined;
        dailyLossCap?: number | undefined;
        maxTradesPerHour?: number | undefined;
        minConfidence?: number | undefined;
        maxSpread?: number | undefined;
        minVolume?: number | undefined;
        atrSpikeThreshold?: number | undefined;
        maxCandleStalenessMs?: number | undefined;
        maxClockSkewMs?: number | undefined;
        maxLlmLatencyMs?: number | undefined;
        minBatteryPercent?: number | undefined;
        maxHeartbeatGapMs?: number | undefined;
    } | undefined;
}, {
    mode: "paper";
    pair: string;
    base: string;
    quote: string;
    interval: string;
    initialQuote: number;
    feeRate: number;
    sizing: {
        fraction: number;
        maxPositionFraction: number;
    };
    atrStopMultiplier: number;
    minNotionalIdr: number;
    dailyBudgetIdr: number;
    ownerId: string;
    runDir: string;
    stateDir: string;
    guardrails?: {
        maxPositionPercent?: number | undefined;
        dailyLossCap?: number | undefined;
        maxTradesPerHour?: number | undefined;
        minConfidence?: number | undefined;
        maxSpread?: number | undefined;
        minVolume?: number | undefined;
        atrSpikeThreshold?: number | undefined;
        maxCandleStalenessMs?: number | undefined;
        maxClockSkewMs?: number | undefined;
        maxLlmLatencyMs?: number | undefined;
        minBatteryPercent?: number | undefined;
        maxHeartbeatGapMs?: number | undefined;
    } | undefined;
    reconcileEveryCandles?: number | undefined;
    commandCheckEveryCandles?: number | undefined;
}>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export declare function parseAgentConfig(raw: unknown): AgentConfig;
//# sourceMappingURL=config.d.ts.map