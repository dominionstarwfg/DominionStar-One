// Audit guard for installation-safe QA identity and the approved meeting layout.
// Does not claim physical media success or production readiness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const pkg=JSON.parse(read('../package.json'));
const bootstrap=read('../src/bootstrap.mjs');
const main=read('../src/main.mjs');
const participant=read('../ui/zoom-participants-reference-2.0.41.js');
const runtime=read('../ui/runtime-stability.js');
const layout=read('../ui/meeting-parity.css');
const browser=read('../ui/browser-bridge.js');
const desktop=read('../src/meeting-service.mjs');
assert.equal(pkg.version,'2.0.54');
assert.equal(pkg.build.productName,'DominionStar Meet QA');
assert.equal(pkg.build.appId,'com.dominionstar.desktop.qa');
assert.deepEqual(pkg.build.protocols[0].schemes,['dominionstar-meet-qa']);
assert.match(bootstrap,/ISOLATED_QA_BUILD=app\.getName\(\)==='DominionStar Meet QA'/);
assert.match(bootstrap,/ISOLATED_QA_BUILD\?'\/Applications\/DominionStar Meet QA\.app':'\/Applications\/DominionStar Meet\.app'/);
assert.match(bootstrap,/if\(ISOLATED_QA_BUILD\)return \{moved:false,skipped:true,canonical:false,conflictType:'qaManualInstall'/);
assert.match(main,/releaseChannel:QA_BUILD\?'qa':'production'/);
assert.match(main,/APP_JOIN_SCHEME=QA_BUILD\?'dominionstar-meet-qa':'dominionstar-meet'/);
assert.match(main,/allowDirectQa:QA_BUILD&&process\.env\.DOMINIONSTAR_QA_ALLOW_DIRECT_ICE==='1'/);
assert.match(participant,/left:50%!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translate\(-50%,-50%\)!important/);
assert.match(runtime,/const baseWidth=panel===chat\?330:318;/);
assert.match(runtime,/const baseHeight=panel===chat\?440:390;/);
assert.match(runtime,/panel\.style\.setProperty\('left',\`\$\{Math\.max\(10,\(bodyWidth-pw\)\/2\)\}px\`,'important'\)/);
assert.match(layout,/\.participant-video-dock\{[^}]*right:14px;top:14px/);
for(const [label,source] of [['browser',browser],['desktop',desktop]]){
  for(const name of ['meet_v2_room_snapshot','meet_v2_send_signal','meet_v2_pull_signals']){
    assert.ok(source.includes(name),label+' missing '+name);
  }
  for(const field of ['p_from_participant_id','p_to_participant_id','p_signal_type','p_payload','p_after_id','p_limit']){
    assert.ok(source.includes(field),label+' signaling contract missing '+field);
  }
}
console.log('PASS QA separate app identity, install guard, centered participants, right dock, browser/desktop RPC contract (static)');
