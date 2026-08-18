import fs from 'node:fs';
import path from 'node:path';

const [manifestPath = 'dist/release-recovery.json', outputPath = 'dist/release-health.json'] = process.argv.slice(2);
const fail = (message, code = 51) => { console.error(`DOMINIONSTAR_RELEASE_QUARANTINED ${message}`); process.exit(code); };

if (!fs.existsSync(manifestPath)) fail(`missing recovery manifest: ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = String(manifest.version || '').trim();
const commit = String(manifest.commit || '').trim();
const appId = String(manifest.appId || '').trim();
const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];

if (!/^\d+\.\d+\.\d+$/.test(version)) fail('invalid stable desktop version');
if (!/^[0-9a-f]{7,40}$/i.test(commit)) fail('missing or invalid source commit');
if (appId !== 'com.dominionstar.desktop') fail(`unexpected app identity: ${appId}`);
if (artifacts.length === 0) fail('no certified artifacts');

for (const artifact of artifacts) {
  if (!artifact?.name || !/^[0-9a-f]{64}$/i.test(String(artifact.sha256 || ''))) fail('artifact hash missing');
  if (!Number.isFinite(Number(artifact.bytes)) || Number(artifact.bytes) <= 0) fail(`artifact size invalid: ${artifact?.name || 'unknown'}`);
}

const health = {
  schema: 1,
  state: 'certified-candidate',
  quarantine: false,
  promotionPolicy: 'explicit-after-health-certification',
  version,
  commit,
  appId,
  artifactCount: artifacts.length,
  hostedReleaseId: manifest.hostedReleaseId || '',
  certifiedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(health, null, 2)}\n`);
console.log(`DOMINIONSTAR_RELEASE_HEALTH_OK version=${version} commit=${commit} artifacts=${artifacts.length}`);
