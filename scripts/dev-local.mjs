// One-command local dev: starts the SQLite API server + the vite dev server.
//   npm run local   →   app on http://localhost:5173, API on :8787

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Run vite's JS entry with the same node binary we're running under —
// avoids any dependency on node/npx being on the system PATH.
const viteJs = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const env = { ...process.env, PATH: dirname(process.execPath) + ';' + process.env.PATH };

const procs = [
  spawn(process.execPath, ['--experimental-sqlite', join(root, 'server', 'index.mjs')],
    { cwd: root, stdio: 'inherit', env }),
  spawn(process.execPath, [viteJs],
    { cwd: root, stdio: 'inherit', env }),
];

const stop = () => { for (const p of procs) try { p.kill(); } catch { /* already dead */ } };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { stop(); process.exit(code ?? 0); });
