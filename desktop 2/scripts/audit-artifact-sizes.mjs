import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.argv[2] || 'dist');
const maxMiB = Number(process.env.DOMINIONSTAR_MAX_ARTIFACT_MIB || 800);
const maxBytes = Math.floor(maxMiB * 1024 * 1024);
const releaseExtensions = new Set(['.exe', '.dmg', '.zip', '.pkg']);

if (!fs.existsSync(distDir)) {
  console.error(`ARTIFACT_SIZE_ERROR missing dist directory: ${distDir}`);
  process.exit(1);
}

const files = fs.readdirSync(distDir, { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => path.join(distDir, entry.name))
  .filter(file => releaseExtensions.has(path.extname(file).toLowerCase()))
  .sort();

if (!files.length) {
  console.error(`ARTIFACT_SIZE_ERROR no release artifacts found in ${distDir}`);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const bytes = fs.statSync(file).size;
  const mib = bytes / 1024 / 1024;
  const name = path.basename(file);
  console.log(`ARTIFACT_SIZE ${name} ${bytes} bytes ${mib.toFixed(2)} MiB`);
  if (bytes > maxBytes) {
    failed = true;
    console.error(`ARTIFACT_SIZE_LIMIT_EXCEEDED ${name} ${mib.toFixed(2)} MiB > ${maxMiB} MiB`);
  }
}

if (failed) process.exit(42);
console.log(`DOMINIONSTAR_ARTIFACT_SIZE_GATE_OK count=${files.length} maxMiB=${maxMiB}`);
