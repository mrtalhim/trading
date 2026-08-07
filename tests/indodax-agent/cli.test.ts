import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, runAgentCli } from '../../apps/indodax-agent/src/cli.js';
import { statusPath, writeCommand, writeStatus } from '../../apps/indodax-agent/src/signal.js';
import { JsonlLoader } from '../../packages/datasets/src/index.js';

const REALISTIC = 'datasets/realistic/btc_idr_15m_2026';
const PINNED_CHECKSUM = 'd6e6249e53138edb';

const tmpDirs: string[] = [];
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'agent-cli-'));
  tmpDirs.push(d);
  return d;
}

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop()!;
    await rm(d, { recursive: true, force: true });
  }
});

describe('indodax-agent CLI', () => {
  it('parses subcommand and options', () => {
    expect(parseArgs(['pull', '--symbol', 'BTCIDR', '--tf', '15'])).toEqual({
      command: 'pull',
      options: { symbol: 'BTCIDR', tf: '15' },
    });
    expect(parseArgs(['--dataset', 'x'])).toEqual({ command: 'run', options: { dataset: 'x' } });
  });

  it('pins the real-marker dataset checksum', async () => {
    const meta = await new JsonlLoader(REALISTIC).metadata();
    expect(meta.checksum).toBe(PINNED_CHECKSUM);
    expect(meta.candleCount).toBeGreaterThanOrEqual(10_000);
  });

  it('writes a command file with `command pause`', async () => {
    const dir = await tempDir();
    await runAgentCli(['pause', '--runDir', dir]);
    await writeStatus(dir, { state: 'paused', candleCount: 42 });
    const raw = JSON.parse(await readFile(statusPath(dir), 'utf8')) as { state: string };
    expect(raw.state).toBe('paused');
  });

  it('runs the full realistic dataset end-to-end via the CLI', async () => {
    const dir = await tempDir();
    const out = join(dir, 'result.json');
    await runAgentCli([
      'run',
      '--dataset',
      REALISTIC,
      '--out',
      out,
      '--runDir',
      join(dir, 'run'),
      '--stateDir',
      join(dir, 'state'),
      '--sampleEvery',
      '10',
      '--minVolume',
      '0.01',
    ]);

    const result = JSON.parse(await readFile(out, 'utf8')) as {
      candleCount: number;
      tradeCount: number;
      realizedPnl: number;
      totalFees: number;
      checksum: string;
      trades: {
        clientOrderId: string;
        price: number;
        quantity: number;
        fee: number;
        realizedPnl: number;
      }[];
    };

    expect(result.candleCount).toBeGreaterThanOrEqual(10_000);
    expect(result.tradeCount).toBeGreaterThan(0);
    expect(result.checksum).toMatch(/^[0-9a-f]{16}$/);
    expect(Number.isNaN(result.realizedPnl)).toBe(false);
    expect(Number.isNaN(result.totalFees)).toBe(false);

    const ids = result.trades.map((t) => t.clientOrderId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of result.trades) {
      expect([t.price, t.quantity, t.fee, t.realizedPnl].every(Number.isFinite)).toBe(true);
    }
  }, 120_000);

  it('is deterministic across two CLI runs', async () => {
    const dir = await tempDir();
    const out1 = join(dir, 'a.json');
    const out2 = join(dir, 'b.json');
    const base = ['--dataset', REALISTIC, '--sampleEvery', '20', '--minVolume', '0.01'];
    await runAgentCli([
      'run',
      '--out',
      out1,
      '--runDir',
      join(dir, 'run-a'),
      '--stateDir',
      join(dir, 'state-a'),
      ...base,
    ]);
    await runAgentCli([
      'run',
      '--out',
      out2,
      '--runDir',
      join(dir, 'run-b'),
      '--stateDir',
      join(dir, 'state-b'),
      ...base,
    ]);
    const a = JSON.parse(await readFile(out1, 'utf8')) as { checksum: string; trades: unknown[] };
    const b = JSON.parse(await readFile(out2, 'utf8')) as { checksum: string; trades: unknown[] };
    expect(a.checksum).toBe(b.checksum);
    expect(a.trades).toEqual(b.trades);
  }, 120_000);
});
