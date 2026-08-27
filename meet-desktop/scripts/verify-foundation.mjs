import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const html=read('ui/index.html');
const css=read('ui/styles.css');
const js=read('ui/app.js');

assert(main.includes("loadFile(path.join(__dirname,'..','ui','index.html'))"),'Desktop must load the local Home file.');
assert(!main.includes('dominionstarld.com'),'Desktop shell must not depend on the public website.');
assert(main.includes("if(url.startsWith('file://'))return"),'Navigation must remain local by default.');
assert(preload.includes('contextIsolation')===false,'Preload should expose only the explicit bridge, not runtime configuration.');
for(const label of ['New Meeting','Join','Schedule','Share Screen'])assert(html.includes(`>${label}<`),`Missing Home action: ${label}`);
for(const section of ['homeSection','meetingsSection','contactsSection'])assert(html.includes(`id="${section}"`),`Missing desktop section ${section}`);
assert(html.includes('No Personal Room or backend setting is shown until its database migration exists'),'Settings must not expose undeployed Personal Room state.');
assert(css.includes('.action-card:active{transform:translateY(0) scale(.99)}'),'Action controls must visibly release after click.');
assert(js.includes("if(b.dataset.action==='share-screen')notice('Share remains isolated'"),'Share must remain an explicit non-blocking isolated action until its own foundation is added.');
assert(!js.includes('getDisplayMedia'),'Home/prejoin foundation must not load screen capture.');
assert(!html.includes('meet_personal_rooms'),'Undeployed backend table name must never leak into the Home UI.');
console.log('DOMINIONSTAR_DESKTOP_FOUNDATION_OK local-home four-primary-actions clean-settings responsive-controls share-isolated');
