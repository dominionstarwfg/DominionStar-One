import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'ds-release-recovery-'));
try {
  writeFileSync(join(dir, 'DominionStar-Meet-test.exe'), 'desktop-artifact');
  writeFileSync(join(dir, 'latest.yml'), 'version: 1.2.2\n');
  const out = join(dir, 'manifest.json');
  const run = spawnSync(process.execPath, ['scripts/release-recovery.mjs', dir, out], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, GITHUB_SHA: '0123456789abcdef' },
    encoding: 'utf8'
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || `exit ${run.status}`);
  const manifest = JSON.parse(readFileSync(out, 'utf8'));
  if (manifest.schema !== 1) throw new Error('schema mismatch');
  if (manifest.product !== 'DominionStar Meet') throw new Error('product mismatch');
  if (manifest.appId !== 'com.dominionstar.desktop') throw new Error('appId mismatch');
  if (manifest.recovery?.strategy !== 'supersede-not-mutate') throw new Error('recovery strategy mismatch');
  if (manifest.files.length !== 2) throw new Error('artifact count mismatch');
  for (const file of manifest.files) {
    if (!/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`bad hash for ${file.name}`);
    if (!(file.bytes > 0)) throw new Error(`bad size for ${file.name}`);
  }
  console.log('DOMINIONSTAR_RELEASE_RECOVERY_TEST_OK');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
