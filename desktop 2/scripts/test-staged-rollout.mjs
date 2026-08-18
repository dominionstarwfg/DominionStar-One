import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dominionstar-rollout-'));
const script = fileURLToPath(new URL('./apply-staged-rollout.mjs', import.meta.url));
const win = path.join(tmp, 'latest.yml');
const mac = path.join(tmp, 'latest-mac.yml');
const base = `version: 1.2.2\nfiles:\n  - url: DominionStar-Meet-1.2.2.dmg\n    sha512: abc123\npath: DominionStar-Meet-1.2.2.dmg\nsha512: abc123\nreleaseDate: 2026-08-18T00:00:00.000Z\n`;
fs.writeFileSync(win, base);
fs.writeFileSync(mac, base);

let run = spawnSync(process.execPath, [script, '10', win, mac], { encoding: 'utf8' });
if (run.status !== 0) throw new Error(run.stderr || run.stdout);
for (const file of [win, mac]) {
  const text = fs.readFileSync(file, 'utf8');
  if (!/^stagingPercentage: 10$/m.test(text)) throw new Error('10% staging marker missing');
  if (!text.includes('sha512: abc123')) throw new Error('artifact integrity field changed');
}

run = spawnSync(process.execPath, [script, '50', win], { encoding: 'utf8' });
if (run.status !== 0) throw new Error(run.stderr || run.stdout);
const promoted = fs.readFileSync(win, 'utf8');
if ((promoted.match(/^stagingPercentage:/gm) || []).length !== 1) throw new Error('duplicate staging markers');
if (!/^stagingPercentage: 50$/m.test(promoted)) throw new Error('promotion to 50% failed');

for (const invalid of ['-1', '101', 'not-a-number']) {
  run = spawnSync(process.execPath, [script, invalid, win], { encoding: 'utf8' });
  if (run.status !== 61) throw new Error(`expected rollout rejection 61 for ${invalid}, got ${run.status}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('DOMINIONSTAR_STAGED_ROLLOUT_TEST_OK');
