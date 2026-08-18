import fs from 'node:fs';
import path from 'node:path';

const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
const build = packageJson.build || {};
const publish = Array.isArray(build.publish) ? build.publish : [];
const github = publish.find(entry => entry?.provider === 'github');
const failures = [];

if (packageJson.private !== true) failures.push('desktop package must remain private');
if (!/^\d+\.\d+\.\d+$/.test(String(packageJson.version || ''))) failures.push('desktop version must be stable semver');
if (build.asar !== true) failures.push('ASAR packaging must remain enabled');
if (!github || github.owner !== 'dominionstarwfg' || github.repo !== 'DominionStar-One') failures.push('GitHub update provider must remain pinned to DominionStar-One');
if (build.appId !== 'com.dominionstar.desktop') failures.push('desktop appId changed unexpectedly');
if (build.productName !== 'DominionStar Meet') failures.push('desktop productName changed unexpectedly');

const files = Array.isArray(build.files) ? build.files : [];
if (!files.includes('src/**/*') || !files.includes('package.json')) failures.push('desktop package file allowlist is incomplete');
if (files.some(pattern => /^(\*\*\/\*|\.\/?\*\*)$/.test(String(pattern)))) failures.push('desktop package must not bundle the repository broadly');

if (failures.length) {
  for (const failure of failures) console.error(`RELEASE_TRUST_FAIL ${failure}`);
  process.exit(31);
}

console.log(`DOMINIONSTAR_RELEASE_TRUST_POLICY_OK version=${packageJson.version} provider=github asar=true`);
