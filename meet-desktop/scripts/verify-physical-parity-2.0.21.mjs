import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const shareService=read('src/share-service.mjs');
const shareIntegration=read('ui/share-integration.js');
const physicalRepair=read('ui/physical-mac-repair.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const adaptiveCss=read('ui/zoom-adaptive-parity.css');
const auth=read('ui/auth-password.js');
const rejection=read('PHYSICAL_2_0_20_REJECTION.md');

const requireText=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};
const rejectText=(source,needle,message)=>{if(source.includes(needle))throw new Error(message);};

if(pkg.version!=='2.0.21')throw new Error(`Expected candidate version 2.0.21, found ${pkg.version}`);

// Screen share: macOS 15+ must receive the original getDisplayMedia gesture.
requireText(shareService,"const nativeSystemPicker=platform==='darwin'&&macMajor>=15",'Native system picker is not gated to supported macOS.');
requireText(shareService,'{useSystemPicker:nativeSystemPicker}', 'Electron display-media handler does not enable the native macOS picker.');
requireText(shareService,"if(nativeSystemPicker)return {opened:false,nativeSystemPicker:true,status:'system-picker'}",'Share entry does not route supported macOS directly to the native picker.');
requireText(shareIntegration,'const result=await bridge.openPicker();','Renderer does not resolve picker authority before capture.');
requireText(shareIntegration,"if(result?.nativeSystemPicker)return {mode:'native'}",'Renderer does not recognize native system-picker mode.');
requireText(shareIntegration,"await share.start({name:'Shared content',options})",'Native share path does not call getDisplayMedia through the share controller.');
requireText(physicalRepair,'return await integration.open();','Physical Mac layer still owns capture instead of delegating to native share integration.');
rejectText(physicalRepair,'sharePicker?.listSources','Physical Mac Share click still enumerates desktop sources before native capture.');
rejectText(physicalRepair,'sourceProbe(','Physical Mac Share click still contains a source-probe permission gate.');
const openIndex=shareIntegration.indexOf('const result=await bridge.openPicker();');
const statusIndex=shareIntegration.indexOf('media?.requestScreen?.()');
if(openIndex<0||statusIndex<0||statusIndex<openIndex)throw new Error('Screen permission status is queried before the native picker attempt.');

// Participants: small-roster density, adaptive search, and documented Zoom ordering.
requireText(adaptive,"search.hidden=count<=1",'One-person participant panel still exposes unnecessary search.');
requireText(adaptive,"waiting.hidden=!hasWaitingPeople()",'Empty Waiting Room is not suppressed.');
requireText(adaptive,"if(self)bucket=0",'Participant ordering does not keep the local user first.');
requireText(adaptive,"else if(role==='host')bucket=1",'Participant ordering does not prioritize host.');
requireText(adaptive,"else if(role==='cohost')bucket=2",'Participant ordering does not prioritize co-hosts.');
requireText(adaptive,"else if(raised)bucket=3",'Participant ordering does not prioritize raised hands.');
requireText(adaptive,"else if(micOn)bucket=4",'Participant ordering does not prioritize unmuted participants above muted participants.');
requireText(adaptive,"if(count<=6)centerParticipantPanel(side,count)",'Small participant rosters do not default to the compact floating physical-reference layout.');
requireText(adaptiveCss,'max-width:340px !important','One-person participant panel is not bounded to compact Zoom-scale geometry.');

// Chat: right dock on wide windows, floating overlay on constrained windows.
requireText(adaptive,'const wide=body.clientWidth>=1120','Chat does not have a deterministic adaptive-width breakpoint.');
requireText(adaptive,"panel.dataset.dsAdaptiveMode=wide?'docked':'floating'",'Chat does not switch between docked and floating modes.');
requireText(adaptive,"stage.style.setProperty('margin-right','356px','important')",'Wide docked chat does not reserve stage space.');
requireText(adaptive,'ds-chat-privacy','Chat privacy affordance is missing.');

// Prejoin: compact preview-dominant geometry and no clipped third device column.
requireText(adaptiveCss,'max-width:560px !important','Prejoin is not bounded to compact desktop width.');
requireText(adaptiveCss,'grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important','Prejoin device row is not constrained to two non-clipping columns.');
requireText(adaptive,"label.hidden=title==='speaker'",'Prejoin still exposes the third speaker selector that clipped in the physical screenshot.');
requireText(adaptive,'Always show this preview when joining','Zoom-style persistent preview preference is missing.');

// Final authority must load after the physical-repair layer.
requireText(auth,"script.onload=loadAdaptiveParity",'Adaptive 2.0.21 controller is not sequenced after physical Mac repair.');
requireText(auth,"adaptiveStyle.href='./zoom-adaptive-parity.css'",'Adaptive 2.0.21 stylesheet is not loaded.');
requireText(rejection,'Status: **REJECTED**','2.0.20 physical rejection is not recorded.');

console.log('DOMINIONSTAR_PHYSICAL_PARITY_2_0_21_OK native-system-picker no-preflight compact-prejoin adaptive-participants zoom-sort adaptive-chat physical-rejection-recorded');
