import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { runEvaluator } from '../../apps/evaluator/src/index.js';
import { entry, makeConfig, trade, writeLog } from './fixtures.js';

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function listDir(dir: string): Promise<string[]> {
  return (await readdir(dir)).sort();
}

describe('evaluator read-only guarantee (TDD M9.5 #4)', () => {
  it('never writes to runner state, guardrail config, or risk parameters', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-readonly-'));
    try {
      const logsDir = join(dir, 'state');
      const runDir = join(dir, 'run');
      const configDir = join(dir, 'config');
      const reportDir = join(dir, 'reports');
      await mkdir(logsDir, { recursive: true });
      await mkdir(runDir, { recursive: true });
      await mkdir(configDir, { recursive: true });

      const degraded = [
        entry({ trades: [trade({ realizedPnl: 100 })] }),
        entry({ trades: [trade({ realizedPnl: -50 })] }),
        entry({ trades: [trade({ realizedPnl: -25 })] }),
        entry({ trades: [trade({ realizedPnl: -60 })] }),
        entry({ trades: [trade({ realizedPnl: -40 })] }),
        entry({ trades: [trade({ realizedPnl: 0 })] }),
      ];
      await writeLog(logsDir, degraded);

      const events = join(logsDir, 'events.jsonl');
      const snapshot = join(logsDir, 'state.json');
      const guardrails = join(configDir, 'guardrails.json');
      const risk = join(configDir, 'risk.json');
      const command = join(runDir, 'command.json');
      await writeFile(events, '{"ts":1,"type":"start"}\n{"ts":2,"type":"trade"}\n');
      await writeFile(snapshot, JSON.stringify({ seq: 3, position: 0 }, null, 2));
      await writeFile(guardrails, JSON.stringify({ maxPositionPercent: 0.3 }));
      await writeFile(risk, JSON.stringify({ fraction: 0.1 }));
      await writeFile(command, JSON.stringify({ command: 'status', issuedAt: 1 }));

      const before = {
        events: await sha256(events),
        snapshot: await sha256(snapshot),
        decisions: await sha256(join(logsDir, 'decisions.jsonl')),
        guardrails: await sha256(guardrails),
        risk: await sha256(risk),
        logsFiles: await listDir(logsDir),
        runFiles: await listDir(runDir),
        configFiles: await listDir(configDir),
      };

      const config = makeConfig({
        logsDir,
        reportDir,
        controlRunDir: runDir,
        minDecisions: 1,
        benchmarks: {
          'test-model': [
            { metric: 'winRate', expected: 0.6, maxDeviation: 0.1, direction: 'below' },
          ],
        },
      });
      const report = await runEvaluator({ config, now: 1_800_000_000_000 });
      expect(report.paused).toBe(true);

      expect(await sha256(events)).toBe(before.events);
      expect(await sha256(snapshot)).toBe(before.snapshot);
      expect(await sha256(join(logsDir, 'decisions.jsonl'))).toBe(before.decisions);
      expect(await sha256(guardrails)).toBe(before.guardrails);
      expect(await sha256(risk)).toBe(before.risk);

      expect(await listDir(logsDir)).toEqual(before.logsFiles);
      expect(await listDir(configDir)).toEqual(before.configFiles);
      expect(await listDir(runDir)).toEqual([...before.runFiles, 'evaluator-pause.json'].sort());
      expect((await listDir(reportDir)).length).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
