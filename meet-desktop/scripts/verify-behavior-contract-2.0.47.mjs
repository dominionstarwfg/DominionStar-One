import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read('package.json'));
const runtime=read('ui/runtime-stability.js');
const runtimeCss=read('ui/runtime-stability.css');
const participants=read('ui/participant-controls.js');
const videoCss=read('ui/mac-share-video.css');
const videoJs=read('ui/mac-share-video.js');
const annotationHtml=read('ui/mac-annotation-toolbar.html');
const annotationCanvas=read('ui/mac-annotation-canvas.js');
const overlay=read('src/mac-share-presenter-overlay.mjs');

assert(['2.0.47','2.0.48','2.0.49','2.0.50','2.0.51','2.0.52'].includes(pkg.version),'package version is outside the certified 2.0.47+ behavior line');

assert(runtime.includes("panel===chat?330:318"),'participant geometry is not the readable desktop contract');
assert(runtimeCss.includes('min-width:min(318px,calc(100% - 24px))'),'participant panel can collapse back to rejected narrow width');
assert(runtimeCss.includes('.ds-participants-popout{display:none!important}'),'legacy participant expand affordance remains visible');
assert(runtimeCss.includes('flex-direction:column!important;align-items:flex-start!important'),'participant identity/role are not separated vertically');
assert(runtime.includes("dataset.dsRuntimeParticipantChrome='1'")&&runtime.includes("setParticipants(false)"),'participant panel lacks single runtime close authority');
assert(participants.includes("ds-media-state.off::after")===false,'participant controller should not synthesize competing slash decoration');

assert(videoCss.includes('.video-tile:hover .video-tile-actions')&&videoCss.includes('opacity:0')&&videoCss.includes('pointer-events:none')&&videoCss.includes('pointer-events:auto'),'share video tile controls are not hover-intelligent');
assert(videoJs.includes("document.addEventListener('pointerdown'")&&videoJs.includes('closeMenu()'),'share video menu lacks outside-click dismissal');
assert(videoJs.includes('async function runPrimary(person)')&&videoJs.includes("person.self){await presenterCommand(person.micOn?'audio-off':'audio-on')")&&videoJs.includes("addMenuItem(person.cameraOn?'Stop Video':'Start Video'"),'share video tile must expose direct mute/unmute and a working camera action in the ellipsis menu');

assert(annotationHtml.includes('data-command="annotate-select" class="active"'),'annotation does not open with Select active');
assert(!annotationHtml.includes('data-command="annotate-pen" class="active"'),'annotation still opens visually in Pen mode');
assert(annotationCanvas.includes("const state={mode:'select'"),'annotation canvas still initializes in drawing mode');
assert(annotationCanvas.includes("resize();setMode('select')"),'annotation canvas does not finish initialization in Select mode');
assert(overlay.includes("companion:'annotate',companionOpen:true};setAnnotationPointerPassthrough(true)"),'opening annotation still captures the whole screen');
assert(overlay.includes("command:'annotate-select'"),'annotation open path does not explicitly synchronize Select mode');
assert(overlay.includes("if(normalized==='annotate-select')setAnnotationPointerPassthrough(true)"),'Select does not release pointer ownership');
assert(overlay.includes("/^annotate-(?:pen|highlight|laser|erase|shape-)/.test(normalized))setAnnotationPointerPassthrough(false)"),'drawing tools do not reacquire pointer ownership');
assert(annotationHtml.includes('annotate-laser')&&annotationHtml.includes('annotate-erase')&&annotationHtml.includes('annotate-undo')&&annotationHtml.includes('annotate-clear')&&annotationHtml.includes('annotate-close'),'annotation tool-switch/exit contract is incomplete');

assert(overlay.includes('toolbarRevealZoneContains(point)'),'share toolbar lacks localized reveal zone');
assert(overlay.includes('if(moved<3||!toolbarRevealZoneContains(point))return;'),'share toolbar wakes from unrelated mouse movement');
assert(overlay.includes('y=Math.round(area.y+12)'),'share toolbar has no top-edge clearance');

console.log('PASS behavior contract 2.0.50 approved-share-tile-hover');
