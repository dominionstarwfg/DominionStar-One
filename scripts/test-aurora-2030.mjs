#!/usr/bin/env node
/* Aurora Intelligence 2030 review-only contract checks.
 * Static checks validate a build contract; manual browser testing is still required.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFileSync(root+name,'utf8');
const js=read('assets/js/dominionstar-public-v5.js');
const css=read('assets/css/dominionstar-public-v5.css');
const backend=read('netlify/functions/aurora-chat.mjs');

new Script(js,{filename:'dominionstar-public-v5.js'});
const include=(content,phrase)=>assert.ok(content.includes(phrase),'Missing Aurora contract: '+phrase);
for(const phrase of [
 'aurora-2030-panel',
 'aurora-2030-quick-grid',
 'aurora-2030-quick-card',
 'aurora-2030-welcome',
 'aurora-2030-thinking',
 'aurora-2030-listening',
 'aurora-2030-speaking',
 'aurora-2030-compose-head',
 "data.auroraMode",
 "AURORA · VERIFIED GUIDE",
 "Enable AI answers",
 'window.DominionStarAurora',
 "version:'2030-review'",
 'data-aurora-clear','data-aurora-wide','data-aurora-close'
])include(js,phrase);
for(const phrase of [
 '.aurora-2030-panel',
 '.aurora-2030-quick-card',
 '.aurora-2030-launch',
 '@media(max-width:640px)',
 '@media(prefers-reduced-motion:reduce)'
])include(css,phrase);

assert.ok(!js.includes('Aurora <em>7.0</em>'),'Old hardcoded version badge still rendered');
assert.ok(!js.includes('GENERATIVE AI ONLINE'),'Do not claim AI is enabled before server reports it');
assert.match(js,/state\.available\?'AI|state\.available\?'GUIDED/,'Mode must depend on server');
assert.match(js,/sensitive\.test\(q\)/,'User input privacy guard must remain');
assert.match(backend,/AURORA_AI_ENABLED/,'Optional AI must be server gated');
assert.match(backend,/OPENAI_API_KEY/,'AI key must remain server side');
assert.match(backend,/origin_not_allowed/,'Backend must retain origin guard');
for(const path of ['index.html','schedule/index.html','financial-services/index.html','opportunity/index.html']){
 const html=read(path);
 include(html,'dominionstar-public-v5.js');
 include(html,'dominionstar-public-v5.css');
}
console.log('DOMINIONSTAR_AURORA_2030_REVIEW_CONTRACT_OK');