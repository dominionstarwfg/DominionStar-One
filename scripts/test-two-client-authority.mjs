import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const room={room_id:'two-client-room',owner_id:'host-user',active:true,waiting_room_enabled:true,passcode:''};

class Broker {
  constructor(){this.channels=[];this.presence=new Map();}
  makeChannel(label){
    const handlers=new Map();
    const channel={
      label,handlers,
      on(type,filter,callback){if(type==='broadcast')handlers.set(filter.event,callback);if(type==='presence')handlers.set(`presence:${filter.event}`,callback);return channel;},
      async subscribe(callback){this.channels ||= []; await callback?.('SUBSCRIBED');return channel;},
      async send(packet){for(const peer of this.channels.filter(item=>item!==channel)){await peer.handlers.get(packet.event)?.({payload:structuredClone(packet.payload)});}return 'ok';},
      async track(payload){this.presence.set(label,structuredClone(payload));await this.syncPresence();return 'ok';},
      presenceState(){const result={};for(const [key,value] of this.presence)result[key]=[structuredClone(value)];return result;},
      async untrack(){this.presence.delete(label);await this.syncPresence();}
    };
    channel.channels=this.channels;channel.presence=this.presence;channel.syncPresence=async()=>{for(const peer of this.channels)await peer.handlers.get('presence:sync')?.({});};
    this.channels.push(channel);return channel;
  }
}

const broker=new Broker();
class FakeTrack {constructor(kind,id){this.kind=kind;this.id=id;this.readyState='live';this.enabled=true;this.contentHint='';this.listeners=new Map();}addEventListener(type,handler){this.listeners.set(type,handler);}stop(){this.readyState='ended';this.listeners.get('ended')?.();}getSettings(){return {displaySurface:this.kind==='video'&&this.id.includes('screen')?'monitor':undefined};}}
class FakeMediaStream {constructor(tracks=[]){this.tracks=[...tracks];this.id=`stream-${Math.random()}`;}getTracks(){return [...this.tracks];}getAudioTracks(){return this.tracks.filter(track=>track.kind==='audio');}getVideoTracks(){return this.tracks.filter(track=>track.kind==='video');}addTrack(track){if(!this.tracks.includes(track))this.tracks.push(track);}removeTrack(track){this.tracks=this.tracks.filter(item=>item!==track);}}
class FakePeer {
  constructor(){this.connectionState='connected';this.signalingState='stable';this.senders=[];this.localDescription=null;this.remoteDescription=null;}
  getSenders(){return this.senders;}addTrack(track){const sender={track,async replaceTrack(next){this.track=next;}};this.senders.push(sender);return sender;}
  async createOffer(){return {type:'offer',sdp:'fake'};}async createAnswer(){return {type:'answer',sdp:'fake'};}async setLocalDescription(value){this.localDescription=value;}async setRemoteDescription(value){this.remoteDescription=value;}async addIceCandidate(){}restartIce(){}close(){this.connectionState='closed';}getTransceivers(){return [];}createDataChannel(){return {readyState:'open',addEventListener(){},send(){},close(){}};}
}
function database(){
  const query={
    select(){return this;},eq(column,value){this.filters={...(this.filters||{}),[column]:value};return this;},
    update(values){this.pendingUpdate=values;return this;},
    async maybeSingle(){if(this.filters?.room_id&&this.filters.room_id!==room.room_id)return {data:null};if(this.filters?.owner_id&&this.filters.owner_id!==room.owner_id)return {data:null};if(this.pendingUpdate)Object.assign(room,this.pendingUpdate);return {data:{...room}};}
  };
  return query;
}

function createEngine({label,userId}){
  const channel=broker.makeChannel(label);
  const peers=[];
  class LabeledPeer extends FakePeer {constructor(){super();peers.push(this);}}
  const cameraStream=new FakeMediaStream([new FakeTrack('audio',`${label}-mic`),new FakeTrack('video',`${label}-camera`)]);
  const screenStream=new FakeMediaStream([new FakeTrack('video',`${label}-screen`)]);
  const session={user:{id:userId,email:`${label}@example.test`,user_metadata:{full_name:label}}};
  const client={auth:{async getSession(){return {data:{session}};}},channel(){return channel;},removeChannel(){},from(){return database();}};
  const context={console,setTimeout,clearTimeout,setInterval,clearInterval,performance,Promise,Date,Math,Map,Set,WeakSet,MediaStream:FakeMediaStream,RTCPeerConnection:LabeledPeer,navigator:{mediaDevices:{getUserMedia:async()=>cameraStream,getDisplayMedia:async()=>screenStream}},sessionStorage:{setItem(){}},crypto:{randomUUID:()=>`${label}-${Math.random().toString(36).slice(2)}`},window:{DSAuth:{init:async()=>client},addEventListener(){},DominionRuntime:{events:{publish(){}}}}};
  context.window.window=context.window;vm.createContext(context);vm.runInContext(source,context);return {engine:context.window.DominionStarMeetingEngine,channel,peers,cameraStream,screenStream};
}

const host=createEngine({label:'host',userId:'host-user'});
const guest=createEngine({label:'guest',userId:'guest-user'});
await host.engine.init({roomId:room.room_id,displayName:'Host',isHost:true,hostUserId:room.owner_id,waitingRoomEnabled:true});
let waitingRequest=null;
host.engine.on('join-request',payload=>{waitingRequest=payload;});
await guest.engine.init({roomId:room.room_id,displayName:'Guest',isHost:false,hostUserId:room.owner_id,waitingRoomEnabled:true});
await new Promise(resolve=>setTimeout(resolve,0));
if(guest.engine.snapshot().admitted)throw new Error('Guest bypassed the waiting room before host admission.');
if(!waitingRequest?.from)throw new Error('Host did not receive the waiting-room join request.');
await host.engine.admit(waitingRequest.from);
await new Promise(resolve=>setTimeout(resolve,25));
if(!guest.engine.snapshot().admitted)throw new Error('Guest was not admitted before meeting authority tests.');

let unauthorizedSecurityEvents=0;
host.engine.on('security-state',()=>unauthorizedSecurityEvents++);
await guest.channel.send({type:'broadcast',event:'meet-security-state',payload:{roomId:room.room_id,from:guest.engine.snapshot().participantId,userId:'guest-user',role:'host',isHost:true,admitted:true,settings:{waitingRoom:false}}});
if(unauthorizedSecurityEvents)throw new Error('A self-declared host changed room security.');

let guestSawCohost=false,hostSawCohost=false;
guest.engine.on('role-change',event=>{if(event.participantId===guest.engine.snapshot().participantId&&event.role==='cohost')guestSawCohost=true;});
host.engine.on('role-change',event=>{if(event.participantId===guest.engine.snapshot().participantId&&event.role==='cohost')hostSawCohost=true;});
await host.engine.setRole(guest.engine.snapshot().participantId,'cohost');
await new Promise(resolve=>setTimeout(resolve,0));
if(!guestSawCohost||!hostSawCohost||guest.engine.snapshot().role!=='cohost')throw new Error('Co-host authority was not confirmed on both admitted clients.');
let cohostSecurityEvents=0;
host.engine.on('security-state',()=>cohostSecurityEvents++);
await guest.engine.updateSecurity({waitingRoom:true});
if(!cohostSecurityEvents)throw new Error('The confirmed admitted co-host did not receive meeting authority.');
await host.engine.setRole(guest.engine.snapshot().participantId,'attendee');
await new Promise(resolve=>setTimeout(resolve,0));
if(guest.engine.snapshot().role!=='attendee')throw new Error('Removing co-host authority did not apply to the participant.');

let promoted=false;
guest.engine.on('role-change',event=>{if(event.participantId===guest.engine.snapshot().participantId&&event.role==='host')promoted=true;});
await host.engine.setRole(guest.engine.snapshot().participantId,'host');
await new Promise(resolve=>setTimeout(resolve,0));
if(!promoted||!guest.engine.snapshot().isHost)throw new Error('The new host did not receive authority.');
if(host.engine.snapshot().isHost)throw new Error('The former host retained host authority.');
if(room.owner_id!=='guest-user')throw new Error('Trusted room ownership was not transferred.');

let remoteSpeaker=null;
host.engine.on('speaking-state',event=>{remoteSpeaker=event;});
await guest.engine.setSpeaking(true,37);
await new Promise(resolve=>setTimeout(resolve,0));
if(!remoteSpeaker?.active||remoteSpeaker.participantId!==guest.engine.snapshot().participantId||remoteSpeaker.level!==37)throw new Error('The verified new host speaking level did not reach the other client.');

let authorizedSecurityEvents=0;
host.engine.on('security-state',()=>authorizedSecurityEvents++);
await guest.engine.updateSecurity({waitingRoom:true});
if(!authorizedSecurityEvents)throw new Error('The verified new host could not synchronize room security.');

let falseDepartures=0;
host.engine.on('participant-left',()=>falseDepartures++);
const firstRecovery=await host.engine.recoverPeer(guest.engine.snapshot().participantId,{reason:'remote-video-missing'});
const secondRecovery=await host.engine.recoverPeer(guest.engine.snapshot().participantId,{reason:'remote-video-missing'});
if(!firstRecovery.ok||!secondRecovery.ok)throw new Error(`A missing remote video transport could not be rebuilt: ${JSON.stringify({firstRecovery,secondRecovery})}`);
if(falseDepartures)throw new Error('Transport recovery falsely announced that the participant left.');

await guest.engine.startMedia({existingStream:guest.cameraStream,audio:true,video:true});
const receivingPeer=host.peers.at(-1);
if(!receivingPeer?.ontrack)throw new Error('Receiving peer was not available for presentation delivery.');
// Deliver the camera first, then the separately announced presentation track.
receivingPeer.ontrack({track:new FakeTrack('video','receiver-camera'),streams:[new FakeMediaStream([new FakeTrack('video','receiver-camera')])]});
let deliveredPresentation=null;
host.engine.on('remote-screen-stream',payload=>{deliveredPresentation=payload;});
await guest.engine.shareScreen();
const receivedScreenTrack=new FakeTrack('video','guest-screen');
receivingPeer.ontrack({track:receivedScreenTrack,streams:[new FakeMediaStream([receivedScreenTrack])]});
if(!deliveredPresentation?.stream?.getVideoTracks().some(track=>track.id==='guest-screen'))throw new Error('The receiving computer did not classify and publish the remote screen track.');
const presentationPeer=guest.peers.at(-1);
const cameraSender=presentationPeer?.getSenders().find(sender=>sender.__dsKind==='camera');
const screenSender=presentationPeer?.getSenders().find(sender=>sender.__dsKind==='screen');
if(cameraSender?.track?.id!=='guest-camera'||screenSender?.track?.id!=='guest-screen')throw new Error('Camera and presentation were not published as separate live tracks.');
await guest.engine.stopScreenShare();
if(cameraSender.track?.id!=='guest-camera'||screenSender.track!==null)throw new Error('Stopping share did not preserve the camera and remove only the presentation track.');

await Promise.all([host.engine.leave(),guest.engine.leave()]);
console.log('PASS admitted two clients agree on authority/speaker state, deliver remote screen share, recover video transport, and preserve camera through sharing.');
