import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('assets/js/meet/share-arbitration.js','utf8');

const buses = new Map();
const busFor = name => {
  if (!buses.has(name)) buses.set(name,{channels:new Set(),presence:new Map()});
  return buses.get(name);
};

const createRealtimeClient = identity => ({
  channel(name){
    const bus=busFor(name);
    const handlers=[];
    const channel={
      on(type,filter,handler){ handlers.push({type,event:filter?.event||'',handler}); return channel; },
      subscribe(callback){ bus.channels.add(channel); queueMicrotask(()=>callback('SUBSCRIBED')); return channel; },
      async track(payload){ bus.presence.set(identity.participantId,{...payload}); return 'ok'; },
      async send(message){
        for (const peer of bus.channels) {
          peer.__broadcast(message.event,message.payload);
        }
        return 'ok';
      },
      __broadcast(event,payload){ handlers.filter(item=>item.type==='broadcast'&&item.event===event).forEach(item=>item.handler({payload})); }
    };
    return channel;
  },
  async removeChannel(channel){ for (const bus of buses.values()) bus.channels.delete(channel); }
});

const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));

const createRuntime = ({roomId,participantId,role='attendee',isHost=false,activePresenterId=''}) => {
  const handlers=new Map();
  let shareCalls=0;
  let stopCalls=0;
  let moderationCalls=[];
  let currentActive=activePresenterId;
  const engine={
    snapshot:()=>({roomId,participantId,displayName:participantId,role,isHost,admitted:true}),
    on:(name,handler)=>{const list=handlers.get(name)||[];list.push(handler);handlers.set(name,list);},
    async shareScreen(){shareCalls++;return {id:`screen-${participantId}`};},
    async stopScreenShare(){stopCalls++;return true;},
    async moderate(target,action){moderationCalls.push({target,action});return `mod-${moderationCalls.length}`;}
  };
  const events={};
  const context={
    window:null,
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    Date,
    DOMINIONSTAR_SUPABASE:{url:'https://example.test',anonKey:'anon'},
    supabase:{createClient:()=>createRealtimeClient({participantId})},
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
  };
  context.window=context;
  context.window.DominionStarMeetingEngine=engine;
  context.window.DOMINIONSTAR_SUPABASE=context.DOMINIONSTAR_SUPABASE;
  context.window.supabase=context.supabase;
  context.window.DominionPresentationHandoff={snapshot:()=>({presenterId:currentActive})};
  context.window.DominionRuntime={events:{publish:()=>{}}};
  context.window.addEventListener=(name,handler)=>{(events[name]||(events[name]=[])).push(handler);};
  context.window.dispatchEvent=event=>{(events[event.type]||[]).forEach(handler=>handler(event));};
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'share-arbitration.js'});
  return {
    context,
    engine,
    emit:(name,payload)=>{(handlers.get(name)||[]).forEach(handler=>handler(payload));},
    setActive:id=>{currentActive=id;context.window.dispatchEvent(new context.CustomEvent('dominion:presentation-handoff',{detail:{nextPresenterId:id}}));},
    getShareCalls:()=>shareCalls,
    getStopCalls:()=>stopCalls,
    getModerationCalls:()=>moderationCalls
  };
};

// Two attendees collide: exactly one is allowed to reach the capture layer.
{
  const room='room-collision';
  const a=createRuntime({roomId:room,participantId:'attendee-a'});
  const b=createRuntime({roomId:room,participantId:'attendee-b'});
  await wait(20);
  const results=await Promise.allSettled([a.engine.shareScreen(),b.engine.shareScreen()]);
  const fulfilled=results.filter(item=>item.status==='fulfilled');
  const rejected=results.filter(item=>item.status==='rejected');
  if(fulfilled.length!==1||rejected.length!==1) throw new Error(`simultaneous attendee claims did not serialize to one winner: ${JSON.stringify(results)}`);
  if(a.getShareCalls()+b.getShareCalls()!==1) throw new Error('more than one attendee reached getDisplayMedia/shareScreen after arbitration');
}

// Host/co-host priority wins a collision even when an attendee also claims.
{
  const room='room-priority';
  const attendee=createRuntime({roomId:room,participantId:'attendee'});
  const host=createRuntime({roomId:room,participantId:'host',role:'host',isHost:true});
  await wait(20);
  const [attendeeResult,hostResult]=await Promise.allSettled([attendee.engine.shareScreen(),host.engine.shareScreen()]);
  if(hostResult.status!=='fulfilled') throw new Error('host did not win privileged screen-share claim');
  if(attendeeResult.status!=='rejected') throw new Error('attendee was not rejected when host claimed the presenter slot');
  if(host.getShareCalls()!==1||attendee.getShareCalls()!==0) throw new Error('privileged claim did not prevent attendee capture');
}

// An attendee cannot interrupt an already-active presenter.
{
  const attendee=createRuntime({roomId:'room-active',participantId:'attendee-b',activePresenterId:'attendee-a'});
  await wait(20);
  const result=await Promise.allSettled([attendee.engine.shareScreen()]);
  if(result[0].status!=='rejected') throw new Error('attendee interrupted an active presenter');
  if(attendee.getShareCalls()!==0) throw new Error('blocked attendee still reached capture');
}

// Host can interrupt an active participant, but moderation is sent before capture.
{
  const host=createRuntime({roomId:'room-host-interrupt',participantId:'host',role:'host',isHost:true,activePresenterId:'attendee-a'});
  await wait(20);
  const result=await Promise.allSettled([host.engine.shareScreen()]);
  if(result[0].status!=='fulfilled') throw new Error('host could not interrupt active participant share');
  const moderation=host.getModerationCalls();
  if(moderation.length!==1||moderation[0].target!=='attendee-a'||moderation[0].action!=='stop-share') throw new Error('host interruption did not send stop-share moderation first');
  if(host.getShareCalls()!==1) throw new Error('host did not reach capture after arbitration');
}

console.log('PASS single-presenter share arbitration: attendee collision serialization, host priority, attendee interrupt rejection, and host/co-host interruption authority.');
