import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('assets/js/notifications-center.js');
const html=read('notifications/index.html');
const sql=read('scripts/security/member-connection-notifications.DO-NOT-RUN.review.sql');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};

const element=()=>({
  innerHTML:'',textContent:'',disabled:false,
  dataset:{},href:'',handlers:{},classList:{add(){},remove(){},toggle(){}},
  addEventListener(kind,callback){this.handlers[kind]=callback;},
  closest(){return null;}
});

async function run({approved='approved',authFails=false,readFails=false,markFails=false,
  mediaFails=false,mediaHangs=false,engineMissing=false,readAfterMarkFails=false,
  markHangs=false,readHangs=false,realtimeFails=false,countFails=false,
  olderPageFails=false,events=null}={}){
  const ids=['notificationGate','notificationApp','notificationList',
    'notificationUnread','notificationMissed','notificationToday',
    'markAllNotifications','enableNotifications','notificationActionStatus',
    'notificationLoadMore','notificationPageInfo'];
  const nodes=Object.fromEntries(ids.map(id=>[id,element()]));
  const scheduled=[];
  const timer=(fn,ms)=>{
    const job={fn,ms,active:true};
    scheduled.push(job);
    return job;
  };
  const clearTimer=job=>{job.active=false;};
  const expire=async()=>{
    for(const job of scheduled.filter(x=>x.active)){
      job.active=false;
      job.fn();
    }
    await flush();
  };
  const recorded={tables:[],rpcCalls:[],badge:[],location:{href:''},readCount:0,
    events:events??[{
      id:'notification-1',event_type:'connection.request',title:'New connection request',
      description:'An approved member wants to connect.',read_at:null,
      priority:'normal',created_at:'2026-11-09T19:00:00Z',
      payload:{action_url:'/member-directory/'}
    }]};
  const client={
    auth:{getSession:async()=>authFails?{error:{message:'Session unavailable'}}:
      {data:{session:{user:{id:'viewer-1'}}},error:null}},
    from(table){
      recorded.tables.push(table);
      let countMode=false;
      const countResult=(predicate)=>countFails
        ?{count:null,error:{message:'Count unavailable'}}
        :{count:recorded.events.filter(predicate).length,error:null};
      const q={
        select(_cols,options){countMode=options?.head===true;return q;},
        eq(column,value){
          if(countMode&&column==='event_type')
            return Promise.resolve(countResult(e=>e.event_type===value));
          return q;
        },
        is(column,value){
          if(countMode&&column==='read_at'&&value===null)
            return Promise.resolve(countResult(e=>!e.read_at));
          return q;
        },
        gte(column,value){
          if(countMode&&column==='created_at')
            return Promise.resolve(countResult(e=>e.created_at>=value));
          return q;
        },
        order(){return q;},
        maybeSingle:async()=>({data:{verification_status:approved},error:null}),
        limit:async limit=>{
          recorded.readCount++;
          if(readHangs)return new Promise(()=>{});
          return readFails||(readAfterMarkFails&&recorded.rpcCalls.length>0)
            ?{data:null,error:{message:'Cannot load inbox'}}
            :{data:recorded.events.slice(0,limit),error:null};
        },
        range:async(start,end)=>{
          recorded.readCount++;
          if(olderPageFails)return {data:null,error:{message:'Earlier page unavailable'}};
          return {data:recorded.events.slice(start,end+1),error:null};
        }
      };
      return q;
    },
    rpc:async(name,payload)=>{
      recorded.rpcCalls.push({name,payload});
      if(markFails)return {data:null,error:{message:'Mark read denied'}};
      if(markHangs)return new Promise(()=>{});
      recorded.events=recorded.events.map(event=>({
        ...event,read_at:new Date('2026-11-09T20:00:00Z').toISOString()
      }));
      return {data:1,error:null};
    },
    channel:()=>{
      if(realtimeFails)throw new Error('Realtime unavailable');
      return {on(){return this},subscribe(){return this}};
    }
  };
  const communication={
    init:async()=>{
      if(mediaFails)throw new Error('Audio unavailable');
      if(mediaHangs)return new Promise(()=>{});
    },
    setBadge:value=>recorded.badge.push(value),
    safeActionUrl:value=>String(value||'/notifications/')
  };
  const window={DSAuth:{ready:true,init:async()=>client},
    location:{origin:'https://dominionstar.example'}};
  if(!engineMissing)window.CommunicationEngine=communication;
  const document={
    getElementById:id=>nodes[id]||null,
    querySelectorAll:()=>[]
  };
  const ctx={window,document,location:recorded.location,
    console:{warn(){}},Promise,Date,Error,URL,
    setTimeout:timer,clearTimeout:clearTimer};
  vm.runInNewContext(source,ctx,{filename:'notifications-center.js'});
  await flush();
  return {nodes,recorded,expire};
}

test('Notifications is gated by Founder-approved agent membership',async()=>{
  const h=await run({approved:'pending'});
  assert.ok(h.recorded.tables.includes('member_profiles'));
  assert.ok(!h.recorded.tables.includes('executive_events'));
  assert.match(h.nodes.notificationGate.innerHTML,/Founder approval required/);
});

test('Session failures remain visible and do not read the notification database',async()=>{
  const h=await run({authFails:true});
  assert.deepEqual(h.recorded.tables,[]);
  assert.match(h.nodes.notificationGate.innerHTML,/Unable to load your notifications/);
});

test('Audio/Push initialization failure never conceals the in-app inbox',async()=>{
  const h=await run({mediaFails:true});
  assert.ok(h.recorded.tables.includes('executive_events'));
  assert.match(h.nodes.notificationList.innerHTML,/New connection request/);
  assert.equal(h.recorded.badge.at(-1),1);
});

test('A missing sound engine does not break safe internal notification links',async()=>{
  const h=await run({engineMissing:true});
  assert.match(h.nodes.notificationList.innerHTML,/href="\/member-directory\/"/);
  assert.match(h.nodes.notificationList.innerHTML,/New connection request/);
});

test('External notification URLs cannot become cross-origin links without audio engine',async()=>{
  const h=await run({engineMissing:true,events:[{
    id:'unsafe-1',event_type:'connection.request',title:'Connection event',
    description:'Unsafe synthetic URL must be rejected',read_at:null,
    created_at:'2026-11-09T19:00:00Z',
    payload:{action_url:'https://untrusted.example/redirect'}
  }]});
  assert.match(h.nodes.notificationList.innerHTML,/href="\/notifications\/"/);
  assert.doesNotMatch(h.nodes.notificationList.innerHTML,/href="https:\/\/untrusted/);
});

test('A stalled in-app inbox query yields a retryable error after a bounded wait',async()=>{
  const h=await run({readHangs:true});
  assert.match(h.nodes.notificationList.innerHTML,/Loading|^$/);
  await h.expire();
  assert.match(h.nodes.notificationList.innerHTML,/Inbox unavailable/);
  assert.match(h.nodes.notificationList.innerHTML,/notificationRetry/);
});

test('Realtime subscription failure cannot block the initial notification list',async()=>{
  const h=await run({realtimeFails:true});
  assert.match(h.nodes.notificationList.innerHTML,/New connection request/);
  assert.equal(h.nodes.notificationUnread.textContent,1);
});

test('Stalled mark-all RPC re-enables its button and reports failure',async()=>{
  const h=await run({markHangs:true});
  const pending=h.nodes.markAllNotifications.onclick();
  await flush();
  assert.equal(h.nodes.markAllNotifications.disabled,true);
  await h.expire();
  await pending;
  assert.equal(h.nodes.markAllNotifications.disabled,false);
  assert.equal(h.nodes.notificationUnread.textContent,1);
  assert.match(h.nodes.notificationActionStatus.textContent,
    /Could not confirm the read update/);
});

test('Opening a notification cannot hang behind a stalled mark-read RPC',async()=>{
  const h=await run({markHangs:true});
  const item={dataset:{eventId:'notification-1'},href:'/member-directory/'};
  const pending=h.nodes.notificationList.handlers.click({
    target:{closest:()=>item},preventDefault(){}
  });
  await flush();
  assert.equal(h.recorded.location.href,'');
  await h.expire();
  await pending;
  assert.equal(h.recorded.location.href,'/member-directory/');
});

test('Stalled audio setup does not leave the notification inbox on its loading gate',async()=>{
  const h=await run({mediaHangs:true});
  assert.ok(!h.recorded.tables.includes('executive_events'));
  await h.expire();
  assert.match(h.nodes.notificationList.innerHTML,/New connection request/);
});

test('Mark-all failure is shown and does not fabricate a read count',async()=>{
  const h=await run({markFails:true});
  await h.nodes.markAllNotifications.onclick();
  assert.equal(h.recorded.rpcCalls.length,1);
  assert.equal(h.recorded.rpcCalls[0].name,'mark_my_executive_notifications_read');
  assert.equal(h.recorded.rpcCalls[0].payload.target_event_id,null);
  assert.match(h.nodes.notificationActionStatus.textContent,/Could not confirm the read update/);
  assert.equal(h.nodes.notificationUnread.textContent,1);
  assert.equal(h.nodes.markAllNotifications.disabled,false);
});

test('Mark-all success re-reads the server state and updates badge',async()=>{
  const h=await run();
  await h.nodes.markAllNotifications.onclick();
  assert.equal(h.nodes.notificationUnread.textContent,0);
  assert.equal(h.recorded.badge.at(-1),0);
  assert.match(h.nodes.notificationActionStatus.textContent,/Notifications marked read/);
});

test('Mark-all cannot claim verified success if server readback fails',async()=>{
  const h=await run({readAfterMarkFails:true});
  assert.equal(h.nodes.notificationUnread.textContent,1);
  await h.nodes.markAllNotifications.onclick();
  assert.equal(h.recorded.rpcCalls.length,1);
  assert.match(h.nodes.notificationActionStatus.textContent,
    /Read update submitted, but the inbox could not refresh/);
  assert.doesNotMatch(h.nodes.notificationActionStatus.textContent,
    /^Notifications marked read\.$/);
  assert.match(h.nodes.notificationList.innerHTML,/Inbox unavailable/);
  assert.equal(h.nodes.markAllNotifications.disabled,false);
});

test('Clicking a notification opens its safe destination even if read-state RPC fails',async()=>{
  const h=await run({markFails:true});
  const item={dataset:{eventId:'notification-1'},href:'/member-directory/'};
  await h.nodes.notificationList.handlers.click({
    target:{closest:()=>item},preventDefault(){}
  });
  assert.equal(h.recorded.location.href,'/member-directory/');
  assert.equal(h.recorded.rpcCalls.length,1);
  assert.equal(h.recorded.rpcCalls[0].payload.target_event_id,'notification-1');
});

test('Today means the viewer-local calendar day, not the previous 24 hours',async()=>{
  const yesterday=new Date();
  yesterday.setHours(0,0,0,0);
  yesterday.setMilliseconds(-1);
  const events=[
    {id:'today',event_type:'connection.request',title:'Today',
      description:'',read_at:null,created_at:new Date().toISOString(),
      payload:{action_url:'/member-directory/'}},
    {id:'yesterday',event_type:'connection.request',title:'Yesterday',
      description:'',read_at:null,created_at:yesterday.toISOString(),
      payload:{action_url:'/member-directory/'}}
  ];
  const h=await run({events});
  assert.equal(h.nodes.notificationUnread.textContent,2);
  assert.equal(h.nodes.notificationToday.textContent,1);
});

test('Exactly 100 inbox events do not falsely advertise an older page',async()=>{
  const events=Array.from({length:100},(_,i)=>({
    id:'exact-'+i,event_type:'connection.request',title:'Exact '+i,
    description:'',read_at:null,
    created_at:new Date(Date.now()-i*1000).toISOString(),
    payload:{action_url:'/member-directory/'}
  }));
  const h=await run({events});
  assert.equal(h.nodes.notificationLoadMore.hidden,true);
  assert.equal(h.nodes.notificationUnread.textContent,100);
  assert.doesNotMatch(h.nodes.notificationPageInfo.textContent,/more available/);
  assert.equal(h.recorded.readCount,1);
});

test('Unread badge and health counts include alerts beyond the first 100',async()=>{
  const events=Array.from({length:205},(_,i)=>({
    id:'event-'+i,event_type:i<160?'connection.request':'call.missed',
    title:'Synthetic event '+i,description:'',read_at:null,
    priority:'normal',created_at:new Date(Date.now()-i*1000).toISOString(),
    payload:{action_url:'/member-directory/'}
  }));
  const h=await run({events});
  assert.equal(h.nodes.notificationUnread.textContent,205);
  assert.equal(h.recorded.badge.at(-1),205);
  assert.equal(h.nodes.notificationMissed.textContent,45);
  assert.equal(h.nodes.notificationLoadMore.hidden,false);
  assert.match(h.nodes.notificationPageInfo.textContent,/Showing 100 most recent/);
  assert.doesNotMatch(h.nodes.notificationList.innerHTML,/Synthetic event 175/);
  await h.nodes.notificationLoadMore.onclick();
  await flush();
  assert.match(h.nodes.notificationList.innerHTML,/Synthetic event 175/);
  assert.equal(h.nodes.notificationLoadMore.hidden,false);
  assert.match(h.nodes.notificationPageInfo.textContent,/Showing 200 most recent/);
  await h.nodes.notificationLoadMore.onclick();
  await flush();
  assert.match(h.nodes.notificationList.innerHTML,/Synthetic event 204/);
  assert.equal(h.nodes.notificationLoadMore.hidden,true);
  assert.match(h.nodes.notificationPageInfo.textContent,/Showing 205 most recent/);
});

test('Missing server counts are disclosed as minimums until earlier pages load',async()=>{
  const events=Array.from({length:125},(_,i)=>({
    id:'unknown-'+i,event_type:'connection.request',title:'Synthetic '+i,
    description:'',read_at:null,
    created_at:new Date(Date.now()-i*1000).toISOString(),
    payload:{action_url:'/member-directory/'}
  }));
  const h=await run({events,countFails:true});
  assert.equal(h.nodes.notificationUnread.textContent,'≥100');
  assert.match(h.nodes.notificationPageInfo.textContent,/more available/);
  await h.nodes.notificationLoadMore.onclick();
  await flush();
  assert.equal(h.nodes.notificationUnread.textContent,125);
  assert.equal(h.nodes.notificationLoadMore.hidden,true);
});

test('Older notification page failure retains the first page and allows retry',async()=>{
  const events=Array.from({length:120},(_,i)=>({
    id:'earlier-'+i,event_type:'connection.request',title:'Saved '+i,
    description:'',read_at:null,
    created_at:new Date(Date.now()-i*1000).toISOString(),
    payload:{action_url:'/member-directory/'}
  }));
  const h=await run({events,olderPageFails:true});
  const first=h.nodes.notificationList.innerHTML;
  await h.nodes.notificationLoadMore.onclick();
  await flush();
  assert.equal(h.nodes.notificationList.innerHTML,first);
  assert.equal(h.nodes.notificationLoadMore.hidden,false);
  assert.equal(h.nodes.notificationLoadMore.disabled,false);
  assert.match(h.nodes.notificationActionStatus.textContent,/Earlier notifications could not load/);
});

test('Connection events have their own icon/filter without a new OS layout',()=>{
  assert.match(source,/e\.event_type\?\.startsWith\('connection\.'\)\?'connections'/);
  assert.match(source,/connections:'<circle/);
  assert.match(html,/data-filter="connections"/);
  assert.match(html,/>Connections<\/span>/);
  assert.match(html,/id="notificationActionStatus"/);
  assert.doesNotThrow(()=>new vm.Script(source));
});

test('Only saved connection rows may create member connection alerts in the draft',()=>{
  assert.match(sql,/REVIEW ONLY — DO NOT RUN/);
  assert.match(sql,/AFTER INSERT OR UPDATE OF status ON public\.member_connections/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/IF OLD\.status<>'pending' OR NEW\.status<>'accepted'/);
  assert.match(sql,/NEW\.status<>'pending'/);
  assert.match(sql,/event_type IN \('connection\.request','connection\.accepted'\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION dominionstar_private\.emit_connection_notifications/);
  assert.match(sql,/WHERE p\.id=NEW\.recipient_id AND p\.verification_status='approved'/);
  assert.match(sql,/public\.member_public_profiles/);
  assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION dominionstar_private\.emit_connection_notifications/);
  assert.match(sql,/priority/);
});
