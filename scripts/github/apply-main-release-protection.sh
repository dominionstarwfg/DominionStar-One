#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-dominionstarwfg/DominionStar-One}"
BRANCH="${BRANCH:-main}"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: GH_TOKEN is required and must have repository administration permission." >&2
  exit 2
fi

api="https://api.github.com/repos/${REPO}/branches/${BRANCH}/protection"

payload="$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Verify authenticated Agent and Founder OS",
      "Verify Agent OS notification and readability review",
      "Build & validate review package — never deploy",
      "Verify main release controls"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
)"

curl --fail-with-body --silent --show-error \
  -X PUT \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "${api}" \
  -d "${payload}" >/tmp/dominionstar-main-protection.json

branch_json="$(curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO}/branches/${BRANCH}")"

printf '%s' "${branch_json}" >/tmp/dominionstar-main-branch.json

node <<'NODE'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync('/tmp/dominionstar-main-branch.json','utf8'));
if(data.protected!==true){
  console.error('VERIFY_FAILED: main is still not protected.');
  process.exit(1);
}
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
const missing=required.filter(x=>!checks.has(x));
if(missing.length){
  console.error('VERIFY_FAILED: missing required checks: '+missing.join(', '));
  process.exit(1);
}
if(data.protection?.required_status_checks?.enforcement_level==='off'){
  console.error('VERIFY_FAILED: status checks are not enforced.');
  process.exit(1);
}
console.log('DOMINIONSTAR_MAIN_PROTECTION_OK');
NODE
