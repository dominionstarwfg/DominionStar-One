import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/meeting-engine.js', import.meta.url), 'utf8');
const room = {room_id:'five-client-room', owner_id:'host-user', active:true, waiting_room_enabled:true, passcode:''};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    await wait(10);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

class Broker {
  constructor(){ this.channels=[]; this.presence=new Map(); }
  makeChannel(label){
    const handlers=new Map();
    const channel={
      label, handlers,
      on(type,filter,callback){
        if(type==='broadcast')handlers.set(filter.event,callback);
        if(type==='presence')handlers.set(`presence:${filter.event}`,callback);
        return channel;
      },
      async subscribe(callback){ await callback?.('SUBSCRIBED'); return channel; },
      async send(packet){
        for(const peer of this.channels.filter(item=>item!==channel)){
          await peer.handlers.get(packet.event)?.({payload:structuredClone(packet.payload)});
        }
        return 'ok';
      },
      async track(payload){
        this.presence.set(label,structuredClone(payload));
        await this.syncPresence();
        return 'ok';
      },
      presenceState(){
        const result={};
        for(const [key,value] of this.presence) result[key]=[structuredClone(value)];
        return result;
      },
      async untrack(){ this.presence.delete(label); await this.syncPresence(); }
    };
    channel.channels=this.channels;
    channel.presence=this.presence;
    channel.syncPresence=async()=>{ for(const peer of this.channels) await peer.handlers.get('presence:sync')?.({}); };
    this.channels.push(channel);
    return channel;
  }
}

const broker = new Broker();

class FakeTrack {
  constructor(kind,id){ this.kind=kind; this.id=id; this.readyState='live'; this.enabled=true; this.contentHint=''; this.listeners=new Map(); }
  addEventListener(type,handler){ this.listeners.set(type,handler); }
  stop(){ this.readyState='ended'; this.listeners.get('ended')?.(); }
  getSettings(){ return {displaySurface:this.kind==='video'&&this.id.includes('screen')?'monitor':undefined}; }
}

class FakeMediaStream {
  constructor(tracks=[]){ this.tracks=[...tracks]; this.id=`stream-${Math.random()}`; }
  getTracks(){ return [...this.tracks]; }
  getAudioTracks(){ return this.tracks.filter(track=>track.kind==='audio'); }
  getVideoTracks(){ return this.tracks.filter(track=>track.kind==='video'); }
  addTrack(track){ if(!this.tracks.includes(track)) this.tracks.push(track); }
  removeTrack(track){ this.tracks=this.tracks.filter(item=>item!==track); }
}

class FakePeer {
  constructor(){ this.connectionState='connected'; this.signalingState='stable'; this.senders=[]; this.localDescription=null; this.remoteDescription=null; }
  getSenders(){ return this.senders; }
  addTrack(track){
    const sender={track, async replaceTrack(next){ this.track=next; }};
    this.senders.push(sender);
    return sender;
  }
  async createOffer(){ return {type:'offer',sdp:'fake'}; }
  async createAnswer(){ return {type:'answer',sdp:'fake'}; }
  async setLocalDescription(value){ this.localDescription=value; }
  async setRemoteDescription(value){ this.remoteDescription=value; }
  async addIceCandidate(){}
  restartIce(){}
  close(){ this.connectionState='closed'; }
  getTransceivers(){ return []; }
  createDataChannel(){ return {readyState:'open',addEventListener(){},send(){},close(){}}; }
}

function database(){
  const query={
    select(){ return this; },
    eq(column,value){ this.filters={...(this.filters||{}),[column]:value}; return this; },
    update(values){ this.pendingUpdate=values; return this; },
    async maybeSingle(){
      if(this.filters?.room_id&&this.filters.room_id!==room.room_id)return {data:null};
      if(this.filters?.owner_id&&this.filters.owner_id!==room.owner_id)return {data:null};
      if(this.pendingUpdate)Object.assign(room,this.pendingUpdate);
      return {data:{...room}};
    }
  };
  return query;
}

function createEngine({label,userId}){
  const channel=broker.makeChannel(label);
  const peers=[];
  class LabeledPeer extends FakePeer { constructor(){ super(); peers.push(this); } }
  const cameraStream=new FakeMediaStream([
    new FakeTrack('audio',`${label}-mic`),
    new FakeTrack('video',`${label}-camera`)
  ]);
  const screenStream=new FakeMediaStream([new FakeTrack('video',`${label}-screen`)]);
  const session={user:{id:userId,email:`${label}@example.test`,user_metadata:{full_name:label}}};
  const client={
    auth:{async getSession(){return {data:{session}};}},
    channel(){return channel;},
    removeChannel(){},
    from(){return database();}
  };
  const context={
    console,setTimeout,clearTimeout,setInterval,clearInterval,performance,Promise,Date,Math,Map,Set,WeakSet,
    MediaStream:FakeMediaStream,RTCPeerConnection:LabeledPeer,
    navigator:{mediaDevices:{getUserMedia:async()=>cameraStream,getDisplayMedia:async()=>screenStream}},
    sessionStorage:{setItem(){}},
    crypto:{randomUUID:()=>`${label}-${Math.random().toString(36).slice(2)}`},
    window:{DSAuth:{init:async()=>client},addEventListener(){},DominionRuntime:{events:{publish(){}}}}
  };
  context.window.window=context.window;
  vm.createContext(context);
  vm.runInContext(source,context);
  return {
    label,userId,engine:context.window.DominionStarMeetingEngine,channel,peers,cameraStream,screenStream,
    presence:[], joins:[], media:[], speaking:[], chats:[], roles:[]
  };
}

const clients=[
  createEngine({label:'host',userId:'host-user'}),
  createEngine({label:'guest-a',userId:'guest-a-user'}),
  createEngine({label:'guest-b',userId:'guest-b-user'}),
  createEngine({label:'guest-c',userId:'guest-c-user'}),
  createEngine({label:'guest-d',userId:'guest-d-user'})
];
const [host,...guests]=clients;

for(const client of clients){
  client.engine.on('presence',payload=>client.presence.push(payload));
  client.engine.on('participant-joined',payload=>client.joins.push(payload));
  client.engine.on('media-state',payload=>client.media.push(payload));
  client.engine.on('speaking-state',payload=>client.speaking.push(payload));
  client.engine.on('chat',payload=>client.chats.push(payload));
  client.engine.on('role-change',payload=>client.roles.push(payload));
}

await host.engine.init({roomId:room.room_id,displayName:'Host',isHost:true,hostUserId:room.owner_id,waitingRoomEnabled:true});
const waiting=[];
host.engine.on('join-request',payload=>waiting.push(payload));

for(const guest of guests){
  await guest.engine.init({roomId:room.room_id,displayName:guest.label,isHost:false,hostUserId:room.owner_id,waitingRoomEnabled:true});
  await waitFor(()=>waiting.some(item=>item.from===guest.engine.snapshot().participantId), `${guest.label} waiting-room request`);
  if(guest.engine.snapshot().admitted) throw new Error(`${guest.label} bypassed waiting-room admission`);
  await host.engine.admit(guest.engine.snapshot().participantId);
  await waitFor(()=>guest.engine.snapshot().admitted, `${guest.label} admission`);
  await guest.engine.startMedia({existingStream:guest.cameraStream,audio:true,video:true});
  await wait(20);
}
await host.engine.startMedia({existingStream:host.cameraStream,audio:true,video:true});

await waitFor(
  ()=>clients.every(client=>client.presence.some(event=>(event.members||[]).length>=4)),
  'five-client presence convergence',
  7000
);

const ids=clients.map(client=>client.engine.snapshot().participantId);
if(new Set(ids).size!==5) throw new Error('Five clients did not receive unique participant identities.');

for(const client of clients){
  const latest=client.presence.at(-1)?.members||[];
  const remoteIds=new Set(latest.map(member=>member.participantId));
  for(const other of clients.filter(item=>item!==client)){
    if(!remoteIds.has(other.engine.snapshot().participantId)){
      throw new Error(`${client.label} roster did not converge on ${other.label}`);
    }
  }
}

await host.engine.setRole(guests[0].engine.snapshot().participantId,'cohost');
await waitFor(()=>guests[0].engine.snapshot().role==='cohost','co-host promotion');
if(!clients.every(client=>client.roles.some(event=>event.participantId===guests[0].engine.snapshot().participantId&&event.role==='cohost'))){
  throw new Error('Co-host promotion did not synchronize to all five clients.');
}

for(const guest of guests){
  const before=clients.filter(client=>client!==guest).map(client=>client.media.length);
  await guest.engine.toggleAudio(false);
  await waitFor(
    ()=>clients.filter(client=>client!==guest).every((client,index)=>client.media.length>before[index]&&client.media.at(-1)?.from===guest.engine.snapshot().participantId&&client.media.at(-1)?.audio===false),
    `${guest.label} mute synchronization`
  );
  await guest.engine.toggleAudio(true);
}

const speaker=guests[2];
const speakingBefore=clients.filter(client=>client!==speaker).map(client=>client.speaking.length);
await speaker.engine.setSpeaking(true,42);
await waitFor(
  ()=>clients.filter(client=>client!==speaker).every((client,index)=>client.speaking.length>speakingBefore[index]&&client.speaking.at(-1)?.participantId===speaker.engine.snapshot().participantId&&client.speaking.at(-1)?.active===true),
  'active-speaker synchronization'
);

const publicBefore=guests.map(client=>client.chats.length);
await host.engine.chat('five-client-public','everyone');
await waitFor(()=>guests.every((client,index)=>client.chats.length>publicBefore[index]&&client.chats.at(-1)?.message==='five-client-public'),'public chat fanout');

const privateTarget=guests[3];
const privateCounts=clients.map(client=>client.chats.length);
await host.engine.chat('five-client-private',privateTarget.engine.snapshot().participantId);
await waitFor(()=>privateTarget.chats.length>privateCounts[clients.indexOf(privateTarget)]&&privateTarget.chats.at(-1)?.message==='five-client-private','private chat target');
for(const client of guests.filter(item=>item!==privateTarget)){
  if(client.chats.slice(privateCounts[clients.indexOf(client)]).some(item=>item.message==='five-client-private')){
    throw new Error(`Private chat leaked to ${client.label}`);
  }
}

const presenter=guests[1];
await presenter.engine.shareScreen();
await waitFor(()=>presenter.peers.length>=4,'presenter peer fanout');
for(const peer of presenter.peers){
  const cameraSender=peer.getSenders().find(sender=>sender.__dsKind==='camera');
  const screenSender=peer.getSenders().find(sender=>sender.__dsKind==='screen');
  if(cameraSender?.track?.id!==`${presenter.label}-camera`) throw new Error('Camera sender was lost while presenting.');
  if(screenSender?.track?.id!==`${presenter.label}-screen`) throw new Error('Screen sender did not fan out to every peer.');
}
await presenter.engine.stopScreenShare();
for(const peer of presenter.peers){
  const cameraSender=peer.getSenders().find(sender=>sender.__dsKind==='camera');
  const screenSender=peer.getSenders().find(sender=>sender.__dsKind==='screen');
  if(cameraSender?.track?.id!==`${presenter.label}-camera`) throw new Error('Stopping share removed the camera sender.');
  if(screenSender?.track!==null) throw new Error('Stopping share did not remove the presentation sender.');
}

let falseDepartures=0;
host.engine.on('participant-left',()=>falseDepartures++);
for(const guest of guests){
  const recovery=await host.engine.recoverPeer(guest.engine.snapshot().participantId,{reason:'five-client-stability'});
  if(!recovery.ok) throw new Error(`Peer recovery failed for ${guest.label}`);
}
if(falseDepartures) throw new Error('Peer recovery falsely announced a participant departure.');

await Promise.all(clients.map(client=>client.engine.leave()));
console.log('PASS five-client meeting stability: admission, full roster convergence, co-host authority, AV/speaker sync, scoped chat, presentation fanout, and recovery.');
