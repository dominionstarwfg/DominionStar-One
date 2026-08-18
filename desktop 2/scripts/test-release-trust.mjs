import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-release-trust-'));
const script = path.resolve('scripts/verify-release-trust.mjs');
const base = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function run(pkg) {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
  return spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
}

const good = run(base);
if (good.status !== 0 || !good.stdout.includes('DOMINIONSTAR_RELEASE_TRUST_POLICY_OK')) {
  console.error(good.stdout, good.stderr);
  process.exit(1);
}

const broad = structuredClone(base);
broad.build.files = ['**/*'];
const bad = run(broad);
if (bad.status !== 31 || !bad.stderr.includes('desktop package must not bundle the repository broadly')) {
  console.error(bad.stdout, bad.stderr);
  process.exit(1);
}

fs.rmSync(root, { recursive: true, force: true });
console.log('DOMINIONSTAR_RELEASE_TRUST_POLICY_TEST_OK');
