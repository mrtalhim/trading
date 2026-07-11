import { z } from 'zod';

export const TradeSchema = z
  .object({
    id: z.string(),
    price: z.number(),
    quantity: z.number(),
    side: z.enum(['buy', 'sell']),
    timestamp: z.number(),
  })
  .strict();

export type Trade = z.infer<typeof TradeSchema>;
