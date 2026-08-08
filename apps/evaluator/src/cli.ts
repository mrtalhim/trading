import { readFile } from 'node:fs/promises';
import { parseEvaluatorConfig } from './config.js';
import { runEvaluator } from './run.js';

interface CliArgs {
  options: Record<string, string>;
}

function parseArgs(argv: string[]): CliArgs {
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        options[key] = val;
        i += 1;
      } else {
        options[key] = 'true';
      }
    }
  }
  return { options };
}

function num(opt: Record<string, string>, key: string): number | undefined {
  return opt[key] === undefined ? undefined : Number(opt[key]);
}

export async function runEvaluatorCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { options } = parseArgs(argv);
  const configPath = options.config;
  if (!configPath) {
    throw new Error('--config <path> is required');
  }
  const config = parseEvaluatorConfig(JSON.parse(await readFile(configPath, 'utf8')));

  const noReview = options['no-review'] === 'true';
  const report = await runEvaluator({
    config,
    since: num(options, 'since'),
    until: num(options, 'until'),
    model: options.model,
    reviewEngine: noReview ? null : undefined,
  });

  const out: Record<string, string | number | boolean | null> = {
    period: `${report.period.since}..${report.period.until}`,
    model: report.model,
    decisions: report.metrics.decisionCount,
    breached: report.drift.breached,
    breachedMetrics: report.drift.breachedMetrics.join(',') || null,
    paused: report.paused,
    pauseFile: report.pauseFile,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runEvaluatorCli().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
