#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-dominionstarwfg/DominionStar-One}"
BRANCH="${BRANCH:-main}"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: GH_TOKEN is required for branch-protection verification." >&2
  exit 2
fi

json="$(curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO}/branches/${BRANCH}")"
printf '%s' "${json}" >/tmp/dominionstar-main-branch.json

node <<'NODE'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync('/tmp/dominionstar-main-branch.json','utf8'));
const checks=new Set([
  ...(data.protection?.required_status_checks?.contexts||[]),
  ...((data.protection?.required_status_checks?.checks||[]).map(x=>x.context).filter(Boolean))
]);
const required=[
  'Verify authenticated Agent and Founder OS',
  'Verify Agent OS notification and readability review',
  'Build & validate review package — never deploy',
  'Verify main release controls'
];
const result={
  protected:data.protected===true,
  enforcement:data.protection?.required_status_checks?.enforcement_level||'unknown',
  missing_required_checks:required.filter(x=>!checks.has(x)),
  configured_checks:[...checks]
};
console.log(JSON.stringify(result,null,2));
if(!result.protected || result.enforcement==='off' || result.missing_required_checks.length){
  process.exit(1);
}
NODE
