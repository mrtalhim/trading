import { z } from 'zod';

export const Action = z.enum(['long', 'short', 'hold']);
export type Action = z.infer<typeof Action>;

export const DecisionSchema = z
  .object({
    action: Action,
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type Decision = z.infer<typeof DecisionSchema>;
