import { createHash } from 'crypto';

export function pipelineVersion(indicator: string, params: Record<string, unknown>): string {
  const serialized = `${indicator}:${JSON.stringify(params, Object.keys(params).sort())}`;
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}
