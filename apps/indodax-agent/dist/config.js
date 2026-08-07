import { z } from 'zod';
export const AgentConfigSchema = z
    .object({
    mode: z.literal('paper'),
    pair: z.string(),
    base: z.string(),
    quote: z.string(),
    interval: z.string(),
    initialQuote: z.number().positive(),
    feeRate: z.number().min(0).max(0.1),
    sizing: z.object({
        fraction: z.number().min(0).max(1),
        maxPositionFraction: z.number().min(0).max(1),
    }),
    atrStopMultiplier: z.number().positive(),
    guardrails: z
        .object({
        maxPositionPercent: z.number().min(0).max(1).optional(),
        dailyLossCap: z.number().nonnegative().optional(),
        maxTradesPerHour: z.number().int().positive().optional(),
        minConfidence: z.number().min(0).max(1).optional(),
        maxSpread: z.number().nonnegative().optional(),
        minVolume: z.number().nonnegative().optional(),
        atrSpikeThreshold: z.number().positive().optional(),
        maxCandleStalenessMs: z.number().nonnegative().optional(),
        maxClockSkewMs: z.number().nonnegative().optional(),
        maxLlmLatencyMs: z.number().nonnegative().optional(),
        minBatteryPercent: z.number().min(0).max(100).optional(),
        maxHeartbeatGapMs: z.number().nonnegative().optional(),
    })
        .strict()
        .optional(),
    minNotionalIdr: z.number().nonnegative(),
    dailyBudgetIdr: z.number().nonnegative(),
    ownerId: z.string().min(1),
    runDir: z.string(),
    stateDir: z.string(),
    reconcileEveryCandles: z.number().int().positive().default(250),
    commandCheckEveryCandles: z.number().int().positive().default(25),
})
    .strict();
export function parseAgentConfig(raw) {
    return AgentConfigSchema.parse(raw);
}
//# sourceMappingURL=config.js.map