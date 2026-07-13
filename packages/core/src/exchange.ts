import { z } from 'zod';

export const OrderSideSchema = z.enum(['buy', 'sell']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(['market', 'limit']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const OrderStatusSchema = z.enum([
  'open',
  'partially_filled',
  'filled',
  'canceled',
  'rejected',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderParamsSchema = z
  .object({
    symbol: z.string(),
    side: OrderSideSchema,
    type: OrderTypeSchema,
    quantity: z.number().positive(),
    price: z.number().positive().optional(),
    clientOrderId: z.string().min(1),
  })
  .strict();
export type OrderParams = z.infer<typeof OrderParamsSchema>;

export const InternalOrderSchema = z
  .object({
    id: z.string(),
    clientOrderId: z.string(),
    symbol: z.string(),
    side: OrderSideSchema,
    type: OrderTypeSchema,
    price: z.number().positive().nullable(),
    quantity: z.number().positive(),
    filledQuantity: z.number().min(0),
    averagePrice: z.number().positive().nullable(),
    status: OrderStatusSchema,
    timestamp: z.number(),
  })
  .strict();
export type InternalOrder = z.infer<typeof InternalOrderSchema>;

export const InternalBalanceSchema = z
  .object({
    asset: z.string(),
    free: z.number().min(0),
    used: z.number().min(0),
    total: z.number().min(0),
  })
  .strict();
export type InternalBalance = z.infer<typeof InternalBalanceSchema>;
