import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read('package.json'));
const app=read('ui/app.js');
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const reference=read('ui/zoom-participants-reference-2.0.41.js');
const controls=read('ui/participant-controls.js');

assert(['2.0.49','2.0.50','2.0.51','2.0.52'].includes(pkg.version),'package version is outside the certified 2.0.49+ participant reference line');
assert(app.includes('data-ds-runtime-participant-chrome="1"'),'participant traffic chrome is not structural in the base meeting DOM');
assert(app.includes('class="ds-traffic-close"')&&app.includes('class="ds-traffic-minimize"')&&app.includes('class="ds-traffic-restore"'),'base meeting DOM is missing the complete red/yellow/green traffic set');
assert(app.includes("const inlineRole=role==='host'?(self?'(Host, me)':'(Host)')"),'host/me identity is not inline');
assert(app.includes("role==='cohost'?(self?'(Co-host, me)':'(Co-host)'):(self?'(me)':'')"),'co-host/me identity is not inline');
assert(runtime.includes("const baseWidth=panel===chat?330:318;"),'participant default width does not match the compact reference');
assert(runtime.includes("const participantBaseHeight=Math.min(430,Math.max(390,112+(Math.max(1,participantCount)*44)+(participantCount>=7?40:0)));"),'participant default height does not match the reference');
assert(runtime.includes("const minPanelHeight=panel===chat?300:390;"),'participant minimum height is not reference-safe');
assert(runtime.includes("traffic.dataset.dsRuntimeBound='1'"),'traffic behavior is not bound independently of markup creation');
assert(runtime.includes("className='ds-participant-header-action'")||runtime.includes("className = 'ds-participant-header-action'")||runtime.includes("className='ds-participant-header-action'"),'header utility action is missing');
assert(reference.includes('width:318px!important;min-width:min(318px,calc(100% - 24px))!important'),'reference width is not 318px');
assert(reference.includes('height:390px!important;min-height:min(390px,calc(100% - 24px))!important'),'reference height is not 390px');
assert(reference.includes('min-height:42px!important;height:42px!important'),'participant rows are not compact 42px rows');
assert(reference.includes('width:30px!important;height:30px!important'),'participant avatars are not compact 30px avatars');
assert(reference.includes('grid-template-columns:1fr 1fr 1fr!important'),'footer buttons are not balanced equally');
assert(runtimeCss.includes('.ds-traffic-close{background:#ff5f57!important}')&&runtimeCss.includes('.ds-traffic-minimize{background:#febc2e!important}')&&runtimeCss.includes('.ds-traffic-restore{background:#28c840!important}'),'traffic colors are not explicitly locked');
assert(runtimeCss.includes('.ds-participant-header-action'),'top-right participant utility action is not styled');
assert(!controls.includes("className='ds-panel-traffic'"),'participant-controls still creates competing chrome');
assert(!reference.includes("side.classList.toggle('ds-panel-wide')"),'reference layer can still enter the rejected oversized mode');

console.log('PASS participant reference 2.0.49');
