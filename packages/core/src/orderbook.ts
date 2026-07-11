import { z } from 'zod';

const PriceLevelSchema = z.tuple([z.number(), z.number()]);

export const OrderBookSchema = z
  .object({
    bids: z.array(PriceLevelSchema),
    asks: z.array(PriceLevelSchema),
    timestamp: z.number(),
  })
  .strict();

export type OrderBook = z.infer<typeof OrderBookSchema>;
