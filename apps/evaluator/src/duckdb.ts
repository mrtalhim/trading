import type { DecisionLogEntry } from '@trading/storage';

export interface MetricsWindow {
  since: number;
  until: number;
}

function toNumber(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function normalizeValue(v: unknown): unknown {
  if (typeof v === 'bigint') return toNumber(v);
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(v)) out[key] = normalizeValue(value);
    return out;
  }
  return v;
}

/**
 * Reads the decision log window through DuckDB (`read_json_auto` + SQL window
 * filter). Rows come back with a mix of number/string/bigint cell types
 * depending on the inferred JSON schema, so every value is normalized first.
 */
export async function readWindowViaDuckDB(
  path: string,
  window: MetricsWindow,
): Promise<DecisionLogEntry[]> {
  const { access, readFile } = await import('node:fs/promises');
  try {
    await access(path);
  } catch {
    return [];
  }

  const content = await readFile(path, 'utf8');
  if (!content.trim()) return [];

  const duckdb = await import('@duckdb/node-api');
  const instance = await duckdb.DuckDBInstance.create(':memory:');
  try {
    const connection = await instance.connect();
    const sql = `SELECT * FROM read_json_auto(${JSON.stringify(path)}) WHERE candleTimestamp >= ? AND candleTimestamp < ? ORDER BY candleTimestamp`;
    const reader = await connection.runAndReadAll(sql, [window.since, window.until]);
    const rows = reader.getRowObjectsJS() as Record<string, unknown>[];
    return rows.map((row) => normalizeValue(row) as unknown as DecisionLogEntry);
  } finally {
    instance.closeSync();
  }
}
