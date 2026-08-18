import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source=await readFile('assets/js/meet/share-arbitration.js','utf8');
const buses=new Map();
const busFor=name=>{if(!buses.has(name))buses.set(name,{channels:new Set(),presence:new Map()});return buses.get(name);};

const createClient=identity=>({
  channel(name){
    const bus=busFor(name);const handlers=[];
    const channel={
      on(type,filter,handler){handlers.push({type,event:filter?.event||'',handler});return channel;},
      subscribe(callback){bus.channels.add(channel);queueMicrotask(()=>callback('SUBSCRIBED'));return channel;},
      async track(payload){bus.presence.set(identity.participantId,{...payload});for(const peer of bus.channels)peer.__sync();return'ok';},
      presenceState(){return Object.fromEntries([...bus.presence].map(([key,value])=>[key,[value]]));},
      async send(message){for(const peer of bus.channels){if(peer===channel)continue;peer.__broadcast(message.event,message.payload);}return'ok';},
      __sync(){handlers.filter(item=>item.type==='presence'&&item.event==='sync').forEach(item=>item.handler({}));},
      __broadcast(event,payload){handlers.filter(item=>item.type==='broadcast'&&item.event===event).forEach(item=>item.handler({payload}));}
    };return channel;
  },
  async removeChannel(channel){for(const bus of buses.values())bus.channels.delete(channel);}
});

const createRuntime=({participantId,role='attendee',isHost=false,roomId='room-arbitration'})=>{
  const engineHandlers=new Map();
  const body={dataset:{}};
  const listeners=new Map();
  const engine={
    snapshot:()=>({roomId,participantId,displayName:participantId,role,isHost,admitted:true}),
    on:(name,handler)=>{const list=engineHandlers.get(name)||[];list.push(handler);engineHandlers.set(name,list);}
  };
  const context={
    window:null,document:{body},console,setTimeout,clearTimeout,queueMicrotask,
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
    DOMINIONSTAR_SUPABASE:{url:'https://example.test',anonKey:'anon'},
    supabase:{createClient:()=>createClient({participantId})}
  };
  context.window=context;
  context.window.DominionStarMeetingEngine=engine;
  context.window.DOMINIONSTAR_SUPABASE=context.DOMINIONSTAR_SUPABASE;
  context.window.supabase=context.supabase;
  context.window.DominionPresentationHandoff={snapshot:()=>({presenterId:'',epoch:0})};
  context.window.dispatchEvent=event=>{for(const fn of listeners.get(event.type)||[])fn(event);return true;};
  context.window.addEventListener=(type,fn)=>{const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);};
  vm.createContext(context);vm.runInContext(source,context,{filename:'share-arbitration.js'});
  return {context,emit:(name,payload)=>{for(const fn of engineHandlers.get(name)||[])fn(payload);}};
};

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Two attendees contend in the same claim window. Exactly one winner is allowed.
const a=createRuntime({participantId:'attendee-a'});
const b=createRuntime({participantId:'attendee-b'});
await wait(20);
const [aResult,bResult]=await Promise.all([
  a.context.window.DominionShareArbitration.requestStart(),
  b.context.window.DominionShareArbitration.requestStart()
]);
if(Number(Boolean(aResult.ok))+Number(Boolean(bResult.ok))!==1)throw new Error(`attendee contention produced ${Number(Boolean(aResult.ok))+Number(Boolean(bResult.ok))} winners instead of exactly one`);
const attendeeWinner=aResult.ok?'attendee-a':'attendee-b';
const attendeeLoser=aResult.ok?'attendee-b':'attendee-a';
if(a.context.window.DominionShareArbitration.snapshot().lease?.participantId!==attendeeWinner)throw new Error('attendee A did not converge on deterministic winner');
if(b.context.window.DominionShareArbitration.snapshot().lease?.participantId!==attendeeWinner)throw new Error('attendee B did not converge on deterministic winner');
if((aResult.ok?b:a).context.window.DominionShareArbitration.acceptIncoming(attendeeLoser)!==false)throw new Error('losing remote share was accepted over active presenter lease');

// Separate room: host rank must defeat an attendee claim in the same window.
const host=createRuntime({participantId:'host',role:'host',isHost:true,roomId:'room-host-priority'});
const guest=createRuntime({participantId:'guest',roomId:'room-host-priority'});
await wait(20);
const [guestClaim,hostClaim]=await Promise.all([
  guest.context.window.DominionShareArbitration.requestStart(),
  new Promise(resolve=>setTimeout(()=>host.context.window.DominionShareArbitration.requestStart().then(resolve),8))
]);
if(!hostClaim.ok)throw new Error('host did not win simultaneous share arbitration');
if(guestClaim.ok)throw new Error('attendee incorrectly defeated host share arbitration');
if(guest.context.window.DominionShareArbitration.snapshot().lease?.participantId!=='host')throw new Error('attendee did not converge on host presenter lease');

// New Share keeps the incumbent lease so nobody can steal it during picker restart.
if(!host.context.window.DominionShareArbitration.holdForRestart())throw new Error('active presenter could not hold lease for New Share');
host.emit('screen-ended',{});
await wait(5);
if(!host.context.window.DominionShareArbitration.snapshot().restartHeld)throw new Error('screen-ended released presenter lease during New Share hold');
const steal=await guest.context.window.DominionShareArbitration.requestStart();
if(steal.ok||steal.reason!=='presenter-active')throw new Error('another attendee stole the presenter lease during New Share hold');
await host.context.window.DominionShareArbitration.cancelRestart();
await wait(5);
if(host.context.window.DominionShareArbitration.snapshot().lease)throw new Error('cancelled New Share did not release presenter lease');

console.log(`PASS single-presenter arbitration: attendee winner=${attendeeWinner}, host priority, losing-share rejection, and New Share lease hold.`);