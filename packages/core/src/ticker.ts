import { z } from 'zod';

export const TickerSchema = z
  .object({
    symbol: z.string(),
    bid: z.number(),
    ask: z.number(),
    last: z.number(),
    volume24h: z.number(),
    timestamp: z.number(),
  })
  .strict();

export type Ticker = z.infer<typeof TickerSchema>;
