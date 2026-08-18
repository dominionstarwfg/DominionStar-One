import fs from 'node:fs';

const args = process.argv.slice(2);
const rawPercentage = process.env.DOMINIONSTAR_STAGING_PERCENTAGE ?? args.shift() ?? '10';
const percentage = Number(rawPercentage);
const files = args;

const fail = (message, code = 61) => {
  console.error(`DOMINIONSTAR_STAGED_ROLLOUT_REJECTED ${message}`);
  process.exit(code);
};

if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
  fail(`invalid staging percentage: ${rawPercentage}`);
}
if (files.length === 0) fail('no updater metadata files supplied');

for (const file of files) {
  if (!fs.existsSync(file)) fail(`missing updater metadata: ${file}`);
  const original = fs.readFileSync(file, 'utf8');
  if (!/^version:\s*[^\s]+\s*$/m.test(original)) fail(`missing version field: ${file}`);
  if (!/(^files:\s*$|^path:\s*.+$)/m.test(original)) fail(`missing update artifact reference: ${file}`);

  let updated;
  if (/^stagingPercentage:\s*.*$/m.test(original)) {
    updated = original.replace(/^stagingPercentage:\s*.*$/m, `stagingPercentage: ${percentage}`);
  } else {
    updated = original.replace(/^(version:\s*[^\n]+\n)/m, `$1stagingPercentage: ${percentage}\n`);
  }

  fs.writeFileSync(file, updated);
  console.log(`DOMINIONSTAR_STAGED_ROLLOUT_APPLIED file=${file} percentage=${percentage}`);
}
