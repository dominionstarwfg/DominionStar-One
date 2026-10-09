import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sent=[];
let pullQueue=[];
const peers=[];

class FakeTrack{
  constructor(kind,id){this.kind=kind;this.id=id;this.readyState='live';this.enabled=true;this.listeners=new Map();}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  stop(){this.readyState='ended';this.listeners.get('ended')?.();}
}
class FakeMediaStream{
  constructor(tracks=[]){this.tracks=[...tracks];this.id='stream-'+Math.random().toString(36).slice(2);}
  getTracks(){return [...this.tracks];}
  getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}
  getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}
  addTrack(track){if(!this.tracks.includes(track))this.tracks.push(track);}
  removeTrack(track){this.tracks=this.tracks.filter(t=>t!==track);}
}
class FakeDescription{
  constructor(type){this.type=type;this.sdp='v=0 '+type;}
  toJSON(){return {type:this.type,sdp:this.sdp};}
}
class FakeCandidate{
  constructor(){Object.defineProperty(this,'candidate',{value:'candidate:1 1 UDP 1 192.0.2.1 5000 typ host',enumerable:false});this.sdpMid='0';this.sdpMLineIndex=0;}
  toJSON(){return {candidate:this.candidate,sdpMid:this.sdpMid,sdpMLineIndex:this.sdpMLineIndex,usernameFragment:'test'};}
}
class FakePeer{
  constructor(){this.connectionState='new';this.signalingState='stable';this.localDescription=null;this.remoteDescription=null;this.transceivers=[];peers.push(this);}
  addTransceiver(kind,{direction}={}){const sender={track:null,__dsKind:'',async replaceTrack(track){this.track=track;}};const lane={kind,direction:direction||'sendrecv',sender,mid:String(this.transceivers.length)};this.transceivers.push(lane);return lane;}
  getTransceivers(){return this.transceivers;}
  getSenders(){return this.transceivers.map(t=>t.sender);}
  async createOffer(){return new FakeDescription('offer');}
  async createAnswer(){return new FakeDescription('answer');}
  async setLocalDescription(value){this.localDescription=value instanceof FakeDescription?value:new FakeDescription(value?.type||'offer');}
  async setRemoteDescription(value){this.remoteDescription=value;this.signalingState=value?.type==='offer'?'have-remote-offer':'stable';}
  async addIceCandidate(){}
  restartIce(){}
  close(){this.connectionState='closed';}
}
class FakeChannel{
  constructor(){this.handlers=[];}
  on(type,filter,callback){this.handlers.push({type,event:filter?.event||'',callback});return this;}
  subscribe(callback){queueMicrotask(()=>callback?.('SUBSCRIBED'));return this;}
  async send(){return 'ok';}
  async track(){return 'ok';}
  async untrack(){return 'ok';}
  presenceState(){return {};}
}
function query(){
  const q={select(){return q;},eq(){return q;},async maybeSingle(){return {data:{active:true,updated_at:new Date().toISOString()},error:null};}};
  return q;
}
const client={
  auth:{async getSession(){return {data:{session:null}};}},
  channel(){return new FakeChannel();},
  async removeChannel(){return 'ok';},
  from(){return query();}
};
const v2={
  async requestJoin(){return {roomId:'room-uuid',participantId:'a-browser',joinToken:'join-token',state:'joined'};},
  async joinStatus(){return {roomId:'room-uuid',participantId:'a-browser',joinToken:'join-token',state:'joined'};},
  async markJoined(){return {state:'joined'};},
  async touchPresence(){return {ok:true};},
  async snapshot(){return {participants:[{participantId:'z-desktop',displayName:'Desktop Host',role:'host',micOn:true,cameraOn:true}]};},
  async sendSignal(to,type,payload){sent.push({to,type,payload:structuredClone(payload)});return {ok:true};},
  async pullSignals(afterId){const batch=pullQueue.splice(0);return {signals:batch,lastId:batch.at(-1)?.id||afterId};},
  async iceConfig(){return {iceServers:[{urls:'stun:stun.example.test:3478'}],expiresAtMs:Date.now()+3600000};},
  async leave(){return {ok:true};}
};

const context={
  console,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,performance,Promise,Date,Math,Map,Set,WeakSet,
  MediaStream:FakeMediaStream,RTCPeerConnection:FakePeer,
  navigator:{mediaDevices:{}},sessionStorage:{setItem(){}},
  crypto:{randomUUID:()=>Math.random().toString(36).slice(2)},
  window:{DSAuth:{init:async()=>client},DominionBrowserV2Transport:v2,DominionRuntime:{events:{publish(){}}},addEventListener(){}}
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(source,context,{filename:'meeting-engine.js'});
const engine=context.window.DominionStarMeetingEngine;
let screenState=null,moderation=null;
engine.on('screen-state',payload=>{screenState=payload;});
engine.on('moderation',payload=>{moderation=payload;});

await engine.init({roomId:'7443001370',displayName:'Browser Guest',isHost:false,waitingRoomEnabled:true,passcode:''});
await wait(80);

const offer=sent.find(item=>item.type==='offer'&&item.to==='z-desktop');
if(!offer)throw new Error('Numeric browser room did not initiate a V2 offer to the desktop participant.');
if(!offer.payload?.sdp||offer.payload.sdp.type!=='offer'||!String(offer.payload.sdp.sdp||'').startsWith('v=0')){
  throw new Error('Browser V2 offer did not cross RPC as a serialized session description.');
}
const peer=peers[0];
if(!peer?.onicecandidate)throw new Error('Browser V2 peer did not install ICE publishing.');
peer.onicecandidate({candidate:new FakeCandidate()});
await wait(20);
const ice=sent.find(item=>item.type==='ice'&&item.to==='z-desktop');
if(!ice?.payload?.candidate?.candidate?.startsWith('candidate:')){
  throw new Error('Browser V2 ICE candidate lost candidate data during RPC serialization.');
}

pullQueue.push({id:1,type:'screen-state',fromParticipantId:'z-desktop',createdAt:new Date().toISOString(),payload:{active:true,paused:false,displayName:'Desktop Host'}});
await wait(450);
if(!screenState?.active||screenState.participantId!=='z-desktop'){
  throw new Error('Desktop V2 screen-share state did not reach the browser meeting engine.');
}

pullQueue.push({id:2,type:'host:mute',fromParticipantId:'z-desktop',createdAt:new Date().toISOString(),payload:{}});
await wait(450);
if(moderation?.action!=='mute')throw new Error('Desktop host mute control did not translate through V2 browser moderation.');

await engine.chat('physical-v2-chat','everyone');
await wait(20);
const chat=sent.find(item=>item.type==='chat'&&item.to==='z-desktop'&&item.payload?.message==='physical-v2-chat');
if(!chat)throw new Error('Browser public chat did not fan out to the desktop participant through V2.');

await engine.leave();
console.log('PASS numeric browser-to-desktop V2 peer: serialized offer/ICE, screen-share state, host control, and chat delivery.');
