import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const rooms=new Map();
const subscriptions=new Map();

function makeClient(userId=''){
  return {
    auth:{async getSession(){return {data:{session:userId?{user:{id:userId}}:null}};}},
    channel(name){
      const listeners=[];
      const channel={
        on(type,filter,callback){listeners.push({type,filter,callback});return channel;},
        async subscribe(callback){if(!subscriptions.has(name))subscriptions.set(name,new Set());subscriptions.get(name).add(channel);await callback?.('SUBSCRIBED');return channel;},
        async send(packet){
          for(const target of subscriptions.get(name)||[]){
            if(target===channel)continue;
            for(const listener of target.__listeners){
              if(listener.type==='broadcast'&&listener.filter?.event===packet.event)queueMicrotask(()=>listener.callback({payload:packet.payload}));
            }
          }
          return 'ok';
        },
        async track(payload){
          channel.__presence=structuredClone(payload);
          for(const target of subscriptions.get(name)||[]){
            for(const listener of target.__listeners){
              if(listener.type==='presence'&&listener.filter?.event==='sync')await listener.callback({});
            }
          }
          return 'ok';
        },
        presenceState(){
          const result={};let index=0;
          for(const target of subscriptions.get(name)||[]){if(target.__presence)result[`p${index++}`]=[structuredClone(target.__presence)];}
          return result;
        },
        untrack(){channel.__presence=null;},__listeners:listeners
      };
      return channel;
    },
    removeChannel(channel){for(const set of subscriptions.values())set.delete(channel);},
    from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null}),update(){return this;}};}
  };
}

function makeEngine(userId=''){
  const client=makeClient(userId);
  class MockPeerConnection{
    constructor(){this.connectionState='new';this.signalingState='stable';this.localDescription=null;this.remoteDescription=null;this.senders=[];this.transceivers=[];}
    addEventListener(){}
    addTransceiver(kind){const sender={track:null,replaceTrack:async track=>{sender.track=track;}};const transceiver={sender,receiver:{track:{kind}},direction:'sendrecv'};this.senders.push(sender);this.transceivers.push(transceiver);return transceiver;}
    addTrack(track){const sender={track,replaceTrack:async next=>{sender.track=next;}};this.senders.push(sender);return sender;}
    getSenders(){return this.senders;}getTransceivers(){return this.transceivers;}
    async createOffer(){return {type:'offer',sdp:'mock'};}async createAnswer(){return {type:'answer',sdp:'mock'};}
    async setLocalDescription(description){this.localDescription=description||{type:'offer',sdp:'mock'};}
    async setRemoteDescription(description){this.remoteDescription=description;}
    async addIceCandidate(){}close(){this.connectionState='closed';}
  }
  class MockMediaStream{constructor(tracks=[]){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(track=>track.kind==='audio');}getVideoTracks(){return this.tracks.filter(track=>track.kind==='video');}addTrack(track){this.tracks.push(track);}}
  const context={console,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},performance,Promise,Date,Math,Map,Set,WeakSet,MediaStream:MockMediaStream,RTCPeerConnection:MockPeerConnection,RTCSessionDescription:class{constructor(value){Object.assign(this,value);}},RTCIceCandidate:class{constructor(value){Object.assign(this,value);}},navigator:{mediaDevices:{}},sessionStorage:{setItem(){}},crypto:{randomUUID:()=>Math.random().toString(36).slice(2)},window:{DSAuth:{init:async()=>client},addEventListener(){},DominionRuntime:{events:{publish(){}}}}};
  context.window.window=context.window;
  vm.createContext(context);
  vm.runInContext(source,context);
  return context.window.DominionStarMeetingEngine;
}

const ownerId='owner-user';
const roomId='waiting-room-two-client';
rooms.set(roomId,{owner_id:ownerId});
const host=makeEngine(ownerId);
const guest=makeEngine('');
await host.init({roomId,displayName:'Host',isHost:true,hostUserId:ownerId,waitingRoomEnabled:true});
let request=null;
host.on('join-request',payload=>{request=payload;});
let confirmed=false;
host.on('admission-confirmed',()=>{confirmed=true;});
let admitted=false;
guest.on('admitted',()=>{admitted=true;});
// Deliberately omit hostUserId. Anonymous guests cannot read room ownership
// under RLS, so this exercises the targeted one-time join-token path.
await guest.init({roomId,displayName:'Waiting Guest',isHost:false,hostUserId:'',waitingRoomEnabled:true});
if(guest.snapshot().admitted)throw new Error('Guest entered before admission.');
if(await guest.activateWithoutWaitingRoom()!==false)throw new Error('Waiting-room guest was automatically activated.');
await new Promise(resolve=>setTimeout(resolve,20));
if(!request?.from)throw new Error('Host did not receive the guest waiting-room request.');
// Reproduce the production race: a later presence snapshot arrives while the
// host is deciding. This previously erased joinToken and broke manual Admit.
const guestChannel=[...(subscriptions.get(`dominionstar-meet-${roomId}`)||[])][1];
await guestChannel.track({participantId:guest.snapshot().participantId,userId:'',displayName:'Waiting Guest',role:'attendee',isHost:false,admitted:false,audio:false,video:false,joinedAt:new Date().toISOString()});
await host.admit(request.from);
await new Promise(resolve=>setTimeout(resolve,30));
if(!admitted||!guest.snapshot().admitted)throw new Error('Guest did not receive and apply the host admission.');
if(!confirmed)throw new Error('Host did not receive the guest admission confirmation.');
let hostHeardGuest=null,guestHeardHost=null;
host.on('speaking-state',payload=>{hostHeardGuest=payload;});
guest.on('speaking-state',payload=>{guestHeardHost=payload;});
await guest.setSpeaking(true,31);
await host.setSpeaking(true,42);
await new Promise(resolve=>setTimeout(resolve,20));
if(hostHeardGuest?.participantId!==guest.snapshot().participantId||hostHeardGuest?.level!==31)throw new Error('Guest active-speaker state did not reach the host.');
if(guestHeardHost?.participantId!==host.snapshot().participantId||guestHeardHost?.level!==42)throw new Error('Host active-speaker state did not reach the guest.');
let endedForGuest=false;
guest.on('meeting-ended',()=>{endedForGuest=true;});
await host.leave({endForAll:true});
await new Promise(resolve=>setTimeout(resolve,20));
if(!endedForGuest)throw new Error('End for everyone was not accepted immediately by the anonymous participant.');
await guest.leave({silent:true});

// Waiting-room OFF is implemented by the host immediately admitting a join
// request. The guest must not remain trapped after that automatic admission.
const hostOpen=makeEngine(ownerId);
const guestOpen=makeEngine('');
let automaticRequest=false;
let automaticConfirmation=false;
await hostOpen.init({roomId:'waiting-room-disabled',displayName:'Host',isHost:true,hostUserId:ownerId,waitingRoomEnabled:false});
hostOpen.on('admission-confirmed',()=>{automaticConfirmation=true;});
hostOpen.on('join-request',payload=>{automaticRequest=true;hostOpen.admit(payload.from);});
await guestOpen.init({roomId:'waiting-room-disabled',displayName:'Open Guest',isHost:false,hostUserId:'',waitingRoomEnabled:false});
await new Promise(resolve=>setTimeout(resolve,60));
if(!guestOpen.snapshot().admitted)throw new Error('Guest was trapped although waiting room was disabled.');
if(!automaticRequest||!automaticConfirmation)throw new Error('Automatic admission was not confirmed by both clients.');
await Promise.all([hostOpen.leave(),guestOpen.leave()]);
console.log('PASS anonymous targeted admission and waiting-room OFF automatic admission with confirmation.');
