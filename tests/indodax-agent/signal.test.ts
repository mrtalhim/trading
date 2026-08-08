import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearCommand,
  evaluatorPausePath,
  readCommand,
  readEvaluatorPause,
  writeCommand,
  writeStatus,
} from '../../apps/indodax-agent/src/signal.js';

let dir = '';

async function setup(): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), 'agent-'));
  return dir;
}

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('signal files', () => {
  it('reads a written pause command', async () => {
    const d = await setup();
    expect(await readCommand(d)).toBeNull();
    await writeCommand(d, 'pause');
    expect(await readCommand(d)).toBe('pause');
  });

  it('returns null for a malformed or empty command file', async () => {
    const d = await setup();
    await writeFile(join(d, 'command.json'), 'not json');
    expect(await readCommand(d)).toBeNull();
    await writeFile(join(d, 'command.json'), '{"command":"nonsense"}');
    expect(await readCommand(d)).toBeNull();
  });

  it('clearCommand removes a pending command', async () => {
    const d = await setup();
    await writeCommand(d, 'shutdown');
    expect(await readCommand(d)).toBe('shutdown');
    await clearCommand(d);
    expect(await readCommand(d)).toBeNull();
  });

  it('round-trips a status file', async () => {
    const d = await setup();
    await writeStatus(d, { state: 'running', candleCount: 10 });
    const raw = JSON.parse(await readFile(join(d, 'status.json'), 'utf8'));
    expect(raw.state).toBe('running');
    expect(raw.candleCount).toBe(10);
  });
});

describe('readEvaluatorPause', () => {
  const now = 1_800_000_000_000;

  it('returns null when the pause file is missing', async () => {
    const d = await setup();
    expect(await readEvaluatorPause(d, now)).toBeNull();
  });

  it('returns the pause while it is active (within expiresAt)', async () => {
    const d = await setup();
    await writeFile(
      join(d, 'evaluator-pause.json'),
      JSON.stringify({
        trippedAt: now - 1000,
        expiresAt: now + 60_000,
        reason: 'drift',
        metrics: {},
        report: 'r',
      }),
    );
    const pause = await readEvaluatorPause(d, now);
    expect(pause).not.toBeNull();
    expect(pause!.reason).toBe('drift');
  });

  it('treats an expired pause as inactive', async () => {
    const d = await setup();
    await writeFile(
      join(d, 'evaluator-pause.json'),
      JSON.stringify({
        trippedAt: now - 10_000,
        expiresAt: now - 1,
        reason: 'drift',
        metrics: {},
        report: 'r',
      }),
    );
    expect(await readEvaluatorPause(d, now)).toBeNull();
  });

  it('treats a pause with no expiry as permanently active until removed', async () => {
    const d = await setup();
    await writeFile(
      join(d, 'evaluator-pause.json'),
      JSON.stringify({
        trippedAt: now - 1000,
        expiresAt: null,
        reason: 'manual review',
        metrics: {},
        report: 'r',
      }),
    );
    const pause = await readEvaluatorPause(d, now + 1_000_000_000);
    expect(pause).not.toBeNull();
  });

  it('returns null for a malformed pause file', async () => {
    const d = await setup();
    await writeFile(evaluatorPausePath(d), 'not json');
    expect(await readEvaluatorPause(d, now)).toBeNull();
  });
});
