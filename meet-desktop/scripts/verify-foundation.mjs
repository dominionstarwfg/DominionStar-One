import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const html=read('ui/index.html');
const css=read('ui/styles.css');
const js=read('ui/app.js');

assert(main.includes("const uiDir=path.join(__dirname,'..','ui')"),'Desktop must define one local UI directory authority.');
assert(main.includes("mainWindow.loadFile(path.join(uiDir,'index.html'))"),'Desktop must load Home from the local UI directory.');
assert(!main.includes('dominionstarld.com'),'Desktop shell must not depend on the public website.');
assert(main.includes("if(url.startsWith('file://'))return"),'Navigation must remain local by default.');
assert(preload.includes('contextIsolation')===false,'Preload should expose only the explicit bridge, not runtime configuration.');
for(const label of ['New Meeting','Join','Schedule','Share Screen'])assert(html.includes(`>${label}<`),`Missing Home action: ${label}`);
for(const section of ['homeSection','meetingsSection','contactsSection'])assert(html.includes(`id="${section}"`),`Missing desktop section ${section}`);
assert(html.includes('No Personal Room or backend setting is shown until its database migration exists'),'Settings must not expose undeployed Personal Room state.');
assert(css.includes('.action-card:active{transform:translateY(0) scale(.99)}'),'Action controls must visibly release after click.');
assert(js.includes("if(b.dataset.action==='share-screen')notice('Share remains isolated'"),'Home Share must not bypass the in-meeting share foundation.');
assert(!js.includes('getDisplayMedia'),'Home/room controller must not own screen capture.');
assert(!html.includes('meet_personal_rooms'),'Undeployed backend table name must never leak into the Home UI.');
console.log('DOMINIONSTAR_DESKTOP_FOUNDATION_OK local-home four-primary-actions clean-settings responsive-controls isolated-share-module');
