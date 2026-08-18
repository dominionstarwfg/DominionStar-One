import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dominionstar-health-'));
const manifest = path.join(tmp, 'release-recovery.json');
const health = path.join(tmp, 'release-health.json');
const script = fileURLToPath(new URL('./release-health.mjs', import.meta.url));

const good = {
  schema: 1,
  version: '1.2.2',
  commit: '40de1feacea3db37c0f87b848b4cbc406ec187aa',
  appId: 'com.dominionstar.desktop',
  hostedReleaseId: 'test-contract',
  artifacts: [{ name: 'DominionStar-Meet-test.dmg', bytes: 1024, sha256: 'a'.repeat(64) }]
};
fs.writeFileSync(manifest, JSON.stringify(good));
let run = spawnSync(process.execPath, [script, manifest, health], { encoding: 'utf8' });
if (run.status !== 0) throw new Error(run.stderr || run.stdout);
const result = JSON.parse(fs.readFileSync(health, 'utf8'));
if (result.state !== 'certified-candidate' || result.quarantine !== false) throw new Error('healthy candidate was not certified');

const bad = { ...good, artifacts: [{ ...good.artifacts[0], sha256: 'bad' }] };
fs.writeFileSync(manifest, JSON.stringify(bad));
run = spawnSync(process.execPath, [script, manifest, health], { encoding: 'utf8' });
if (run.status !== 51) throw new Error(`expected quarantine exit 51, got ${run.status}`);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('DOMINIONSTAR_RELEASE_HEALTH_TEST_OK');
