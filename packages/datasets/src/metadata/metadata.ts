import { z } from 'zod';

export const DatasetMetadataSchema = z
  .object({
    exchange: z.string(),
    pair: z.string(),
    interval: z.string(),
    timezone: z.string(),
    source: z.string(),
    start: z.number(),
    end: z.number(),
    candleCount: z.number().int().nonnegative(),
    checksum: z.string(),
    includes: z
      .object({
        candles: z.boolean(),
        ticker: z.boolean(),
        orderbook: z.boolean(),
        trades: z.boolean(),
      })
      .strict(),
  })
  .strict();
