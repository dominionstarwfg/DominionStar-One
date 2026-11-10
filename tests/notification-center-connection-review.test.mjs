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
  mediaFails=false,engineMissing=false,readAfterMarkFails=false,events=null}={}){
  const ids=['notificationGate','notificationApp','notificationList',
    'notificationUnread','notificationMissed','notificationToday',
    'markAllNotifications','enableNotifications','notificationActionStatus'];
  const nodes=Object.fromEntries(ids.map(id=>[id,element()]));
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
      const q={
        select(){return q;},eq(){return q;},order(){return q;},
        maybeSingle:async()=>({data:{verification_status:approved},error:null}),
        limit:async()=>{
          recorded.readCount++;
          return readFails||(readAfterMarkFails&&recorded.rpcCalls.length>0)
            ?{data:null,error:{message:'Cannot load inbox'}}
            :{data:recorded.events,error:null};
        }
      };
      return q;
    },
    rpc:async(name,payload)=>{
      recorded.rpcCalls.push({name,payload});
      if(markFails)return {data:null,error:{message:'Mark read denied'}};
      recorded.events=recorded.events.map(event=>({
        ...event,read_at:new Date('2026-11-09T20:00:00Z').toISOString()
      }));
      return {data:1,error:null};
    },
    channel:()=>({on(){return this},subscribe(){return this}})
  };
  const communication={
    init:async()=>{if(mediaFails)throw new Error('Audio unavailable')},
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
    console:{warn(){}},Promise,Date,Error,URL};
  vm.runInNewContext(source,ctx,{filename:'notifications-center.js'});
  await flush();
  return {nodes,recorded};
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

test('Mark-all failure is shown and does not fabricate a read count',async()=>{
  const h=await run({markFails:true});
  await h.nodes.markAllNotifications.onclick();
  assert.equal(h.recorded.rpcCalls.length,1);
  assert.equal(h.recorded.rpcCalls[0].name,'mark_my_executive_notifications_read');
  assert.equal(h.recorded.rpcCalls[0].payload.target_event_id,null);
  assert.match(h.nodes.notificationActionStatus.textContent,/Unable to mark notifications read/);
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
