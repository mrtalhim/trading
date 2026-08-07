import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const COMMANDS = ['pause', 'resume', 'shutdown', 'status'];
function commandPath(dir) {
    return join(dir, 'command.json');
}
export function statusPath(dir) {
    return join(dir, 'status.json');
}
export async function readCommand(dir) {
    try {
        const raw = JSON.parse(await readFile(commandPath(dir), 'utf8'));
        if (raw && typeof raw.command === 'string' && COMMANDS.includes(raw.command)) {
            return raw.command;
        }
    }
    catch {
        // missing or malformed — treat as no command
    }
    return null;
}
export async function clearCommand(dir) {
    try {
        await rm(commandPath(dir), { force: true });
    }
    catch {
        // nothing to clear
    }
}
export async function writeCommand(dir, command) {
    await mkdir(dir, { recursive: true });
    const file = { command, issuedAt: Date.now() };
    await writeFile(commandPath(dir), JSON.stringify(file));
}
export async function writeStatus(dir, status) {
    await mkdir(dir, { recursive: true });
    await writeFile(statusPath(dir), JSON.stringify(status, null, 2));
}
//# sourceMappingURL=signal.js.map