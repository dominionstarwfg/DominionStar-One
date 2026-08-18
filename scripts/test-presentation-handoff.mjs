import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('assets/js/meet/presentation-handoff.js','utf8');
const handlers = new Map();
const events = [];
let annotationClose = 0;
let annotationClear = 0;
let remoteReset = 0;

const engine = {
  snapshot:()=>({roomId:'room-handoff',participantId:'host-1',displayName:'Host',isHost:true,role:'host',admitted:true}),
  on:(name,fn)=>handlers.set(name,fn)
};

class FakeCustomEvent {
  constructor(type,{detail}={}) { this.type=type; this.detail=detail; }
}

const windowObject = {
  DominionStarMeetingEngine:engine,
  DominionShareAnnotation:{
    close:()=>{annotationClose+=1;},
    clear:async()=>{annotationClear+=1;return true;}
  },
  DominionRemoteControl:{
    resetForPresenterChange:async()=>{remoteReset+=1;return true;}
  },
  DominionRuntime:{events:{publish:event=>events.push({type:'runtime',event})}},
  dispatchEvent:event=>{events.push({type:event.type,detail:event.detail});return true;}
};
const documentObject={body:{dataset:{}}};
const context=vm.createContext({window:windowObject,document:documentObject,CustomEvent:FakeCustomEvent,Date,Promise,Object,String,Boolean});
new vm.Script(source,{filename:'presentation-handoff.js'}).runInContext(context);

const settle=async()=>{await Promise.resolve();await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,0));};
const screenState=handlers.get('screen-state');
if(typeof screenState!=='function')throw new Error('presentation handoff did not subscribe to screen-state');

screenState({active:true,participantId:'presenter-a'});
await settle();
let snap=windowObject.DominionPresentationHandoff.snapshot();
if(snap.presenterId!=='presenter-a'||snap.epoch!==1)throw new Error(`first presenter epoch incorrect: ${JSON.stringify(snap)}`);
if(annotationClear||remoteReset)throw new Error('first presenter incorrectly triggered stale-state cleanup');

screenState({active:true,participantId:'presenter-b'});
await settle();
snap=windowObject.DominionPresentationHandoff.snapshot();
if(snap.presenterId!=='presenter-b'||snap.epoch!==2)throw new Error(`A-to-B presenter handoff incorrect: ${JSON.stringify(snap)}`);
if(annotationClose!==1||annotationClear!==1||remoteReset!==1)throw new Error(`A-to-B cleanup incomplete close=${annotationClose} clear=${annotationClear} remote=${remoteReset}`);
const handoff=events.find(item=>item.type==='dominion:presentation-handoff'&&item.detail?.previousPresenterId==='presenter-a'&&item.detail?.nextPresenterId==='presenter-b');
if(!handoff)throw new Error('A-to-B handoff event was not emitted');

screenState({active:false,participantId:'presenter-b'});
await settle();
snap=windowObject.DominionPresentationHandoff.snapshot();
if(snap.presenterId!==''||snap.epoch!==3)throw new Error(`share-end epoch incorrect: ${JSON.stringify(snap)}`);
if(annotationClose!==2||annotationClear!==2||remoteReset!==2)throw new Error(`share-end cleanup incomplete close=${annotationClose} clear=${annotationClear} remote=${remoteReset}`);
if(documentObject.body.dataset.presentationEpoch!=='3'||documentObject.body.dataset.presentationParticipantId!=='')throw new Error('presentation epoch diagnostic state is stale after share end');

console.log('PASS presentation handoff: A→B ownership transition and share end clear annotation, remote-control state, and stale presentation state.');
await import('./test-share-arbitration-contract.mjs');