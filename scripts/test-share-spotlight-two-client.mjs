import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('assets/js/meet/share-spotlight.js','utf8');

class FakeClassList {
  constructor(){ this.values=new Set(); }
  contains(value){ return this.values.has(value); }
  toggle(value,force){ const on=force===undefined?!this.values.has(value):Boolean(force); if(on)this.values.add(value);else this.values.delete(value); return on; }
}

class FakeNode {
  constructor(){ this.hidden=false;this.dataset={};this.style={};this.children=[];this.classList=new FakeClassList();this.textContent='';this.isConnected=true; }
  append(...nodes){ this.children.push(...nodes); }
  setAttribute(){}
  addEventListener(){}
  querySelector(){ return null; }
  getBoundingClientRect(){ return {height:48,width:800}; }
}

const buses = new Map();
const busFor = name => {
  if(!buses.has(name)) buses.set(name,{channels:new Set(),presence:new Map()});
  return buses.get(name);
};

const createClient = identity => ({
  channel(name){
    const bus=busFor(name);
    const handlers=[];
    const channel={
      on(type,filter,handler){ handlers.push({type,event:filter?.event||'',handler}); return channel; },
      subscribe(callback){ bus.channels.add(channel); queueMicrotask(()=>callback('SUBSCRIBED')); return channel; },
      async track(payload){ bus.presence.set(identity.participantId,{...payload}); for(const peer of bus.channels) peer.__sync(); return 'ok'; },
      presenceState(){ return Object.fromEntries([...bus.presence].map(([key,value])=>[key,[value]])); },
      async send(message){
        for(const peer of bus.channels){
          if(peer===channel) continue;
          peer.__broadcast(message.event,message.payload);
        }
        return 'ok';
      },
      __sync(){ handlers.filter(item=>item.type==='presence'&&item.event==='sync').forEach(item=>item.handler({})); },
      __broadcast(event,payload){ handlers.filter(item=>item.type==='broadcast'&&item.event===event).forEach(item=>item.handler({payload})); }
    };
    return channel;
  },
  async removeChannel(channel){ for(const bus of buses.values())bus.channels.delete(channel); }
});

const createRuntime = ({participantId,role,isHost,screenStream=null}) => {
  const body=new FakeNode();
  const menu=new FakeNode();
  const stage=new FakeNode();
  const status=new FakeNode();
  status.textContent=screenStream?'You are sharing':'Host is sharing';
  const engineHandlers=new Map();
  let videoSpotlightCalls=0;
  const engine={
    snapshot:()=>({roomId:'room-2030',participantId,displayName:participantId==='host'?'Host':'Guest',role,isHost,admitted:true,screenStream}),
    on:(name,handler)=>{const list=engineHandlers.get(name)||[];list.push(handler);engineHandlers.set(name,list);},
    spotlight:()=>{videoSpotlightCalls++;}
  };
  const document={
    body,
    head:new FakeNode(),
    getElementById:id=>id==='deviceMenu'?menu:id==='stage'?stage:id==='shareStatusText'?status:null,
    createElement:()=>new FakeNode()
  };
  const context={
    window:null,
    document,
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    MutationObserver:class{observe(){}},
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
    getComputedStyle:()=>({position:'relative'}),
    DOMINIONSTAR_SUPABASE:{url:'https://example.test',anonKey:'anon'},
    supabase:{createClient:()=>createClient({participantId})}
  };
  context.window=context;
  context.window.dispatchEvent=()=>{};
  context.window.DominionStarMeetingEngine=engine;
  context.window.DOMINIONSTAR_SUPABASE=context.DOMINIONSTAR_SUPABASE;
  context.window.supabase=context.supabase;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'share-spotlight.js'});
  return {context,body,engineHandlers,getVideoSpotlightCalls:()=>videoSpotlightCalls};
};

const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));

const host=createRuntime({participantId:'host',role:'host',isHost:true,screenStream:{id:'screen'}});
const guest=createRuntime({participantId:'guest',role:'attendee',isHost:false});
await wait(15);

const hostApi=host.context.window.DominionShareSpotlight;
const guestApi=guest.context.window.DominionShareSpotlight;
if(!hostApi||!guestApi) throw new Error('share spotlight API did not initialize in both clients');
if(!hostApi.canManage()) throw new Error('host lost shared-content spotlight authority');
if(guestApi.canManage()) throw new Error('attendee incorrectly received shared-content spotlight authority');

const applied=await hostApi.set('host','Host');
if(!applied) throw new Error('host could not broadcast shared-content spotlight');
await wait(5);
if(guest.body.dataset.shareSpotlightParticipantId!=='host') throw new Error('attendee did not synchronize host shared-content spotlight');
if(!guest.body.classList.contains('share-spotlight-active')) throw new Error('attendee did not enter synchronized share spotlight state');

const unauthorized=await guestApi.set('guest','Guest');
if(unauthorized) throw new Error('attendee was allowed to broadcast shared-content spotlight');
if(guest.body.dataset.shareSpotlightParticipantId!=='host') throw new Error('unauthorized attendee changed synchronized share spotlight state');

const cleared=await hostApi.clear();
if(!cleared) throw new Error('host could not clear shared-content spotlight');
await wait(5);
if(guest.body.dataset.shareSpotlightParticipantId) throw new Error('host share spotlight clear did not propagate to attendee');
if(guest.body.classList.contains('share-spotlight-active')) throw new Error('attendee remained in share spotlight state after host clear');
if(host.getVideoSpotlightCalls()||guest.getVideoSpotlightCalls()) throw new Error('shared-content spotlight reused participant-video spotlight');

console.log('PASS room-synchronized shared-content spotlight: host apply, attendee receive, attendee authority rejection, host clear, and video-spotlight separation.');
