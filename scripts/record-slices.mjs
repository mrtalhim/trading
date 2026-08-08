import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JsonlLoader, ReplayLoader } from '../packages/datasets/dist/index.js';
import {
  createEngineFromPreset,
  buildDecisionContext,
  contextOptionsFor,
  classifyLlmError,
} from '../packages/llm/dist/index.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return {
    slices: (args.slices ?? '').split(',').filter(Boolean),
    models: (args.models ?? '').split(',').filter(Boolean),
    sampleEvery: Number(args['sample-every'] ?? 25),
    lookback: Number(args.lookback ?? 20),
    timeout: Number(args.timeout ?? 60_000),
    delay: Number(args.delay ?? 3500),
    symbol: args.symbol ?? 'BTC/IDR',
    outDir: args['out-dir'],
  };
}

async function recordSlice(a, dir, model) {
  const name = dir.split('/').pop();
  const outPath = join(a.outDir, `decisions-${name}-${model}.jsonl`);
  try {
    const existing = await readFile(outPath, 'utf-8');
    const n = existing.split('\n').filter((l) => l.trim()).length;
    if (n > 0) {
      console.log(`skip ${name}/${model}: ${n} decisions already recorded`);
      return;
    }
  } catch {
    /* no existing file yet */
  }

  const dataset = new JsonlLoader(dir);
  const replay = new ReplayLoader(dataset);
  const all = await replay.all();
  all.sort((x, y) => x.timestamp - y.timestamp);

  const key = model === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
  const engine = createEngineFromPreset(model, key, a.timeout);
  const startedAt = Date.now();
  const decisions = [];
  let done = 0;

  for (let i = 0; i < all.length; i++) {
    if (i % a.sampleEvery !== 0) continue;
    const lookbackStart = Math.max(0, i - a.lookback + 1);
    const recentCandles = all.slice(lookbackStart, i + 1);
    const ctx = buildDecisionContext(a.symbol, recentCandles, contextOptionsFor('baseline'));

    let action = 'hold';
    let confidence = 0;
    let usage = null;
    let latency = 0;
    try {
      const t0 = Date.now();
      const r = await engine.decideWithUsage(ctx);
      latency = Date.now() - t0;
      action = r.decision.action;
      confidence = r.decision.confidence;
      usage = r.usage;
    } catch (err) {
      process.stderr.write(`\n[${classifyLlmError(err)}] ${err.message.slice(0, 160)}`);
    }

    decisions.push({
      timestamp: all[i].timestamp,
      action,
      confidence,
      model,
      ...(usage ? { usage } : {}),
      llmLatencyMs: latency,
    });
    done++;
    if (done % 10 === 0) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      process.stdout.write(`\n${name}/${model}: ${done} decisions, ${elapsed}s, last=${action}/${confidence}`);
      await writeFile(outPath, decisions.map((d) => JSON.stringify(d)).join('\n') + '\n');
    }
    if (i + a.sampleEvery < all.length) {
      await new Promise((r) => setTimeout(r, a.delay));
    }
  }

  await writeFile(outPath, decisions.map((d) => JSON.stringify(d)).join('\n') + '\n');
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\nDONE ${name}/${model}: ${decisions.length} decisions in ${elapsed}s → ${outPath}`);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.slices.length) throw new Error('--slices dir1,dir2,... is required');
  if (!a.models.length) throw new Error('--models m1,m2,... is required');
  await mkdir(a.outDir, { recursive: true });
  for (const dir of a.slices) {
    for (const model of a.models) {
      await recordSlice(a, dir, model);
    }
  }
  console.log('all slice/model jobs complete');
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
