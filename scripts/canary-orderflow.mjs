import { execFile, execFileSync } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_DIR = join(process.cwd(), 'datasets', 'experiments', 'orderflow-btc_idr-15m-2026');
const DIR = process.env.CANARY_DIR ?? DEFAULT_DIR;
const INTERVAL_S = Number(process.env.CANARY_INTERVAL_S ?? 300);
const STALE_AFTER_MS = Number(process.env.CANARY_STALE_MS ?? 45 * 60 * 1000);
const CONSECUTIVE_FAILS = Number(process.env.CANARY_FAILS ?? 2);
const STATE_FILE = join('/tmp/opencode', 'orderflow-canary-state.json');
const LOG_FILE = join('/tmp/opencode', 'orderflow-canary.log');

const once = process.argv.includes('--once');

let consecutiveFails = 0;
let healthy = true;
let snapshotCount = 0;
let candleCount = 0;
let lastSnapshotTs = null;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function execFileP(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout) => {
      if (err) {
        resolve({ ok: false, stdout: '' });
      } else {
        resolve({ ok: true, stdout: String(stdout).trim() });
      }
    });
  });
}

async function recorderPid() {
  const { ok, stdout } = await execFileP('pgrep', ['-f', 'record-depth.mjs']);
  if (!ok || stdout === '') return null;
  return Number(stdout.split('\n')[0]);
}

async function readTail(file, lines = 1) {
  const raw = await readFile(file, 'utf-8');
  const all = raw.split('\n').filter((l) => l.trim() !== '');
  return all.slice(-lines);
}

async function check() {
  const reasons = [];
  const now = Date.now();

  const pid = await recorderPid();
  if (pid === null) {
    reasons.push('process_dead');
  }

  let lastTs = null;
  let snap = 0;
  let candles = 0;
  try {
    const bookLines = await readTail(join(DIR, 'orderbook.jsonl'), 1);
    snap = await (async () => {
      const all = await readFile(join(DIR, 'orderbook.jsonl'), 'utf-8');
      return all.split('\n').filter((l) => l.trim() !== '').length;
    })();
    if (bookLines.length === 0) {
      reasons.push('book_empty');
    } else {
      const last = JSON.parse(bookLines[0]);
      lastTs = last.timestamp;
      if (now - lastTs > STALE_AFTER_MS) {
        reasons.push(`book_stale_${Math.round((now - lastTs) / 60000)}min`);
      }
    }
    candles = (await readFile(join(DIR, 'candles.jsonl'), 'utf-8')).split('\n').filter((l) => l.trim() !== '').length;
  } catch (err) {
    reasons.push(`read_error:${err.code ?? err.message}`);
  }

  snapshotCount = snap;
  candleCount = candles;
  lastSnapshotTs = lastTs;

  return { healthy: reasons.length === 0, reasons, pid };
}

async function notify(title, content) {
  const { ok } = await execFileP('termux-notification', [
    '--title',
    title,
    '--content',
    content,
    '--vibrate',
    '2000',
  ]);
  return ok;
}

async function writeState(checkedAt, pid, checkOk, reasons) {
  await writeFile(
    STATE_FILE,
    JSON.stringify(
      {
        checkedAt,
        healthy,
        checkOk,
        consecutiveFails,
        reasons,
        recorderPid: pid,
        snapshotCount,
        candleCount,
        lastSnapshotTs,
        canaryPid: process.pid,
      },
      null,
      2,
    ) + '\n',
  );
}

async function cycle() {
  const checkedAt = nowIso();
  const { healthy: ok, reasons, pid } = await check();

  const wasHealthy = healthy;
  if (ok) {
    consecutiveFails = 0;
    healthy = true;
  } else {
    consecutiveFails += 1;
    healthy = consecutiveFails < CONSECUTIVE_FAILS;
  }

  await writeState(checkedAt, pid, ok, reasons);

  const tag = ok ? 'ok' : `warn(${consecutiveFails}/${CONSECUTIVE_FAILS})`;
  const line = `${checkedAt} ${tag} pid=${pid ?? '-'} snap=${snapshotCount} candle=${candleCount} age=${lastSnapshotTs === null ? '-' : Math.max(0, Math.round((Date.now() - lastSnapshotTs) / 1000)) + 's'} reasons=${reasons.join(',') || '-'}`;
  await appendFile(LOG_FILE, line + '\n');

  if (!wasHealthy && healthy) {
    await appendFile(LOG_FILE, `${checkedAt} RECOVERED reasons=${reasons.join(',') || '-'}\n`);
  }
  if (wasHealthy && !healthy) {
    const content = `orderflow recorder problem: ${reasons.join(', ')} — snap=${snapshotCount} candle=${candleCount} last=${lastSnapshotTs ?? '-'}`;
    await appendFile(LOG_FILE, `${checkedAt} ALERT ${content}\n`);
    const notified = await notify('orderflow recorder', content);
    await appendFile(LOG_FILE, `${checkedAt} notify=${notified ? 'sent' : 'unavailable'}\n`);
  }

  return healthy;
}

async function main() {
  await appendFile(LOG_FILE, `${nowIso()} STARTED dir=${DIR} interval=${INTERVAL_S}s stale=${STALE_AFTER_MS}ms fails=${CONSECUTIVE_FAILS} canaryPid=${process.pid}\n`);
  await cycle();
  if (once) return;
  while (true) {
    await sleep(INTERVAL_S * 1000);
    await cycle();
  }
}

process.on('SIGTERM', () => {
  appendFile(LOG_FILE, `${nowIso()} STOPPED sigterm\n`).finally(() => process.exit(0));
});
process.on('SIGINT', () => {
  appendFile(LOG_FILE, `${nowIso()} STOPPED sigint\n`).finally(() => process.exit(0));
});

main().catch((err) => {
  appendFile(LOG_FILE, `${nowIso()} FATAL ${err.message}\n`).finally(() => process.exit(1));
});
