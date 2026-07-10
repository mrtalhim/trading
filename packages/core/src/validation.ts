import { DecisionSchema, type Decision } from './decision.js';

export interface ValidationResult {
  success: boolean;
  data: Decision | null;
  errors: string[];
}

export function parseDecision(raw: unknown): ValidationResult {
  const result = DecisionSchema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data, errors: [] };
  }

  return {
    success: false,
    data: null,
    errors: result.error.issues.map((issue) => issue.message),
  };
}
