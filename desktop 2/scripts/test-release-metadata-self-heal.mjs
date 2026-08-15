import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));

assert.equal(lock.version,packageJson.version,'Top-level package-lock version must match package.json after self-heal');
assert.equal(lock.packages?.['']?.version,packageJson.version,'Root package-lock record must match package.json after self-heal');
assert.equal(packageJson.main,'src/bootstrap.mjs','Native bootstrap must remain the packaged entry point');

console.log('DominionStar release metadata self-heal test passed.');
