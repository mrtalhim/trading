import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type AgentCommand = 'pause' | 'resume' | 'shutdown' | 'status';

export interface CommandFile {
  command: AgentCommand;
  issuedAt: number;
}

export interface StatusFile {
  state: 'paused' | 'running' | 'stopped';
  candleCount: number;
  trades?: number;
  realizedPnl?: number;
  position?: number;
  budgetSpentIdr?: number;
  evaluatorPause?: {
    active: boolean;
    reason: string;
    expiresAt: number | null;
    metrics: Record<string, number | string | null> | null;
  };
}

export interface EvaluatorPauseFile {
  trippedAt: number;
  expiresAt: number | null;
  reason: string;
  metrics: Record<string, number | string | null>;
  report: string;
}

const COMMANDS: readonly AgentCommand[] = ['pause', 'resume', 'shutdown', 'status'];

function commandPath(dir: string): string {
  return join(dir, 'command.json');
}

export function statusPath(dir: string): string {
  return join(dir, 'status.json');
}

export function evaluatorPausePath(dir: string): string {
  return join(dir, 'evaluator-pause.json');
}

/**
 * Reads the evaluator's persistent pause file. Distinct from the one-shot
 * command.json: it stays active until the file is removed (human action) or
 * `expiresAt` passes (stale drift control). Missing/unparseable/expired files
 * are treated as "no evaluator pause" — the runner never crashes on them.
 */
export async function readEvaluatorPause(
  dir: string,
  now: number,
): Promise<EvaluatorPauseFile | null> {
  try {
    const raw = JSON.parse(
      await readFile(evaluatorPausePath(dir), 'utf8'),
    ) as Partial<EvaluatorPauseFile>;
    if (typeof raw.trippedAt !== 'number' || typeof raw.reason !== 'string') return null;
    if (raw.expiresAt != null && typeof raw.expiresAt === 'number' && now >= raw.expiresAt) {
      return null;
    }
    return raw as EvaluatorPauseFile;
  } catch {
    return null;
  }
}

export async function readCommand(dir: string): Promise<AgentCommand | null> {
  try {
    const raw = JSON.parse(await readFile(commandPath(dir), 'utf8')) as { command?: unknown };
    if (raw && typeof raw.command === 'string' && COMMANDS.includes(raw.command as AgentCommand)) {
      return raw.command as AgentCommand;
    }
  } catch {
    // missing or malformed — treat as no command
  }
  return null;
}

export async function clearCommand(dir: string): Promise<void> {
  try {
    await rm(commandPath(dir), { force: true });
  } catch {
    // nothing to clear
  }
}

export async function writeCommand(dir: string, command: AgentCommand): Promise<void> {
  await mkdir(dir, { recursive: true });
  const file: CommandFile = { command, issuedAt: Date.now() };
  await writeFile(commandPath(dir), JSON.stringify(file));
}

export async function writeStatus(dir: string, status: StatusFile): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(statusPath(dir), JSON.stringify(status, null, 2));
}
