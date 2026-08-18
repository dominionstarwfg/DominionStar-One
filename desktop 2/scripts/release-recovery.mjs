import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] || 'dist');
const outPath = resolve(process.argv[3] || join(distDir, 'DOMINIONSTAR-RELEASE-MANIFEST.json'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const allowed = /\.(exe|dmg|zip|blockmap|yml)$/i;
const files = readdirSync(distDir)
  .filter((name) => allowed.test(name))
  .sort()
  .map((name) => {
    const path = join(distDir, name);
    const bytes = statSync(path).size;
    const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
    return { name: basename(name), bytes, sha256 };
  });

if (!files.length) {
  console.error('DOMINIONSTAR_RELEASE_RECOVERY_NO_ARTIFACTS');
  process.exit(41);
}

const manifest = {
  schema: 1,
  product: 'DominionStar Meet',
  appId: 'com.dominionstar.desktop',
  version: pkg.version,
  releaseId: process.env.DOMINIONSTAR_MEET_RELEASE_ID || '',
  commit: process.env.GITHUB_SHA || '',
  generatedAt: new Date().toISOString(),
  recovery: {
    strategy: 'supersede-not-mutate',
    updaterProvider: 'github',
    rollbackRequiresPreviouslyCertifiedArtifact: true,
    releaseMustRemainImmutable: true
  },
  files
};

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`DOMINIONSTAR_RELEASE_RECOVERY_MANIFEST_OK version=${pkg.version} files=${files.length}`);
