// Checks that the QA app cannot overwrite DominionStar Meet production identity,
// hijack its join link, or silently switch its participant reference geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pkg=JSON.parse(source('package.json'));
const boot=source('src/bootstrap.mjs');
const main=source('src/main.mjs');
const privacy=source('src/relaunch-service.mjs');
const panel=source('ui/zoom-participants-reference-2.0.41.js');
const runtime=source('ui/runtime-stability.js');
assert.equal(pkg.version,'2.0.54');
assert.equal(pkg.build.productName,'DominionStar Meet QA');
assert.equal(pkg.build.appId,'com.dominionstar.desktop.qa');
assert.ok(!pkg.build.protocols?.length,'QA must not register production join links');
assert.match(boot,/QA_MAC_BUILD=app\.getName\(\)==='DominionStar Meet QA'/);
assert.match(boot,/QA_MAC_BUILD\?'\/Applications\/DominionStar Meet QA\.app':'\/Applications\/DominionStar Meet\.app'/);
assert.match(main,/releaseChannel:app\.getName\(\)==='DominionStar Meet QA'/);
assert.match(privacy,/app\.getName\(\)==='DominionStar Meet QA'\?'com\.dominionstar\.desktop\.qa':'com\.dominionstar\.desktop'/);
assert.match(panel,/left:50%!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translate\(-50%,-50%\)!important;/);
assert.match(panel,/const width=Math\.min\(440,Math\.max\(294,body\.clientWidth-24\)\)/);
assert.match(runtime,/function layoutSideSurface\(\)/);
assert.match(runtime,/panel\.style\.setProperty\('left',\x60\$\{Math\.max\(10,\(bodyWidth-pw\)\/2\)\}px\x60,'important'\)/);
assert.match(runtime,/#participantVideoDock/,'Video dock must remain independent from center participant panel');
console.log('PASS 2.0.54 standalone QA identity, installed-path safety and center-panel/right-video-dock source guards');
