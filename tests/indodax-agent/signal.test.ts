import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearCommand,
  readCommand,
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
