import fs from 'node:fs';
import vm from 'node:vm';

class FakeTrack {
  constructor(kind){this.kind=kind;this.id=`${kind}-track`;this.readyState='live';this.enabled=true;this.muted=false;this.listeners=new Map();}
  addEventListener(type,handler){this.listeners.set(type,handler);}
  stop(){this.readyState='ended';this.listeners.get('ended')?.();}
}
class FakeStream {
  constructor(tracks=[]){this.id='local-stream';this.tracks=[...tracks];}
  getTracks(){return [...this.tracks];}
  getAudioTracks(){return this.tracks.filter(track=>track.kind==='audio');}
  getVideoTracks(){return this.tracks.filter(track=>track.kind==='video');}
  addTrack(track){if(!this.tracks.includes(track))this.tracks.push(track);}
  removeTrack(track){this.tracks=this.tracks.filter(item=>item!==track);}
}

let sends=0;
let tracks=0;
const channels=[];
const makeChannel=()=>{
  const channel={
    on(){return channel;},
    async subscribe(callback){callback?.('SUBSCRIBED');return channel;},
    async send(){sends+=1;return 'ok';},
    async track(){tracks+=1;return 'ok';},
    untrack(){}
  };
  channels.push(channel);return channel;
};
const client={
  auth:{async getSession(){return {data:{session:null}};}},
  channel:makeChannel,
  removeChannel(){},
  from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null}),update(){return this;}};}
};
const localStream=new FakeStream([new FakeTrack('audio'),new FakeTrack('video')]);
const context={
  console,setTimeout,clearTimeout,setInterval,clearInterval,performance,Promise,Date,Math,Map,Set,WeakSet,
  MediaStream:FakeStream,
  navigator:{mediaDevices:{getUserMedia:async()=>localStream}},
  sessionStorage:{setItem(){}},
  crypto:{randomUUID:()=>Math.random().toString(36).slice(2)},
  window:{DSAuth:{init:async()=>client},addEventListener(){},DominionRuntime:{events:{publish(){}}}}
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8'),context);
const engine=context.window.DominionStarMeetingEngine;
await engine.init({roomId:'stress-room',displayName:'Stress Tester',isHost:true});
await engine.startMedia({existingStream:localStream,audio:true,video:true});
const beforeSends=sends,beforeTracks=tracks;
const started=performance.now();
const operations=[];
for(let index=0;index<100;index+=1)operations.push(engine.toggleAudio(index%2===0?false:true));
await Promise.all(operations);
const elapsed=performance.now()-started;
await new Promise(resolve=>setTimeout(resolve,220));
const snapshot=engine.snapshot();
if(snapshot.mediaState.audio!==true)throw new Error('Final microphone intent was not preserved.');
if(elapsed>250)throw new Error(`Rapid local toggles blocked for ${Math.round(elapsed)}ms.`);
if(sends-beforeSends>6)throw new Error(`Audio synchronization was not coalesced (${sends-beforeSends} sends).`);
if(tracks-beforeTracks>3)throw new Error(`Presence synchronization was not coalesced (${tracks-beforeTracks} updates).`);
await engine.leave();
console.log(`PASS 100 microphone toggles in ${Math.round(elapsed)}ms; final state on; ${sends-beforeSends} network sends; ${tracks-beforeTracks} presence updates.`);
