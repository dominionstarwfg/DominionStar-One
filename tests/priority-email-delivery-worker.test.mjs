import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmailOutboxHandler, providerEmailIdempotencyKey,
  needsIdempotencyManualReview
} from '../netlify/functions/process-email-outbox.mjs';

const recipient='00000000-0000-4000-8000-000000000001';
const eventId='70000000-0000-4000-8000-000000000001';
const itemId='90000000-0000-4000-8000-000000000001';
const verified='synthetic-verified@example.invalid';
const build=(overrides={})=>{
  const log={queries:[],claims:[],updates:[],sends:[],sendOptions:[],authChecks:[],serviceCreated:0};
  const model={
    item:{id:itemId,recipient_id:recipient,recipient_email:verified,
      event_type:'appointment.confirmed',dedupe_key:'event:'+eventId,
      subject:'Synthetic appointment',body:'No real member data',
      action_url:'/member-dashboard/',attempts:1,created_at:new Date().toISOString()},
    user:{id:recipient,email:verified,email_confirmed_at:'2026-11-01T10:00:00Z'},
    event:{id:eventId,member_id:recipient,event_type:'appointment.confirmed',
      priority:'normal'},
    prefs:{email_enabled:true,appointments_email_enabled:true,
      announcements_email_enabled:true,meeting_room_email_enabled:true,
      messages_email_enabled:false,community_email_enabled:false},
    setting:{is_enabled:true,from_name:'DominionStar',from_email:'reply@example.invalid'},
    ...overrides
  };
  const client={
    auth:{
      admin:{getUserById:async id=>{
        log.authChecks.push(id);
        return model.authError?{data:null,error:new Error('Auth source unavailable')}
          :{data:{user:model.user},error:null};
      }},
      getUser:async token=>({
        data:{user:token==='founder-token'?{id:'founder-id'}:null},
        error:token==='founder-token'?null:new Error('Invalid token')
      })
    },
    from(table){
      let operation='read',filter={},changes;
      return {
        select(){return this;},
        update(value){operation='update';changes=value;return this;},
        eq(name,value){
          filter[name]=value;
          if(operation==='update'){
            const result={error:model.updateError||
              (model.sentUpdateError&&changes.status==='sent')
                ?new Error('Queue update unavailable'):null};
            log.updates.push({table,filter:{...filter},changes:{...changes}});
            return Promise.resolve(result);
          }
          return this;
        },
        async single(){
          log.queries.push({table,filter:{...filter},method:'single'});
          if(table==='email_delivery_settings'){
            return {data:model.setting,error:null};
          }
          if(table==='member_profiles'){
            return {data:{role:model.founder===false?'member':'founder',
              is_founder:model.founder!==false},error:null};
          }
          throw Error('Unexpected single query '+table);
        },
        async maybeSingle(){
          log.queries.push({table,filter:{...filter},method:'maybeSingle'});
          if(table==='executive_events'){
            return {data:model.event,error:model.eventQueryError?
              new Error('Event lookup failed'):null};
          }
          if(table==='notification_preferences'){
            return {data:model.prefs,error:model.preferenceQueryError?
              new Error('Preference lookup failed'):null};
          }
          throw Error('Unexpected maybeSingle query '+table);
        }
      };
    },
    async rpc(name,args){
      log.claims.push({name,args});
      assert.equal(name,'claim_email_notification_batch');
      return {data:model.item?[model.item]:[],error:model.claimError?
        new Error('Queue claim failed'):null};
    }
  };
  const env={
    DOMINIONSTAR_PRIORITY_EMAIL_ROUTING_ENABLED:'enabled',
    SUPABASE_URL:'https://synthetic-only.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_NOT_A_SECRET',
    RESEND_API_KEY:'SYNTHETIC_NOT_A_RESEND_KEY',
    DOMINIONSTAR_EMAIL_FROM:'notifications@example.invalid',
    EMAIL_PROCESSOR_SECRET:'synthetic-test-secret',
    ...model.env
  };
  const handler=createEmailOutboxHandler({
    env,
    clientFactory:()=>{
      log.serviceCreated++;
      return client;
    },
    resendFactory:()=>({emails:{
      send:async (payload,options)=>{
        log.sends.push(payload);
        log.sendOptions.push(options);
        return model.sendError||model.providerError?
          {data:null,error:model.providerError||{
            message:'Synthetic mail provider rejection'
          }}:
          {data:model.sendMissingId?{}:{id:'synthetic-provider-id'},error:null};
      }
    }})
  });
  const authorized=()=>handler({method:'POST',headers:
    new Headers({'x-dominionstar-secret':'synthetic-test-secret'})});
  return {model,log,handler,authorized};
};
async function result(response){return {status:response.status,body:await response.json()};}

test('A disabled priority-email flag fails closed BEFORE creating clients, claiming or sending',async()=>{
  const f=build({env:{DOMINIONSTAR_PRIORITY_EMAIL_ROUTING_ENABLED:''}});
  const r=await result(await f.authorized());
  assert.equal(r.status,409);
  assert.match(r.body.error,/disabled pending staging approval/);
  assert.equal(f.log.serviceCreated,0);
  assert.equal(f.log.claims.length,0);
  assert.equal(f.log.sends.length,0);
});

test('GET, missing credentials and non-Founder callers cannot claim email queue',async()=>{
  const f=build();
  const get=await result(await f.handler({method:'GET',headers:new Headers()}));
  assert.equal(get.status,405);
  const unauth=await result(await f.handler({method:'POST',headers:new Headers()}));
  assert.equal(unauth.status,401);
  const g=build({founder:false});
  const forbidden=await result(await g.handler({method:'POST',headers:
    new Headers({Authorization:'Bearer founder-token'})}));
  assert.equal(forbidden.status,403);
  assert.equal(f.log.claims.length,0);
  assert.equal(g.log.claims.length,0);
  assert.equal(f.log.sends.length,0);
});

test('A verified, allowed, source-matched event sends exactly once and saves delivery state',async()=>{
  const f=build();
  const r=await result(await f.authorized());
  assert.equal(r.status,200);
  assert.deepEqual({sent:r.body.sent,failed:r.body.failed,skipped:r.body.skipped},
    {sent:1,failed:0,skipped:0});
  assert.deepEqual(f.log.authChecks,[recipient]);
  assert.equal(f.log.claims.length,1);
  assert.equal(f.log.sends.length,1);
  assert.deepEqual(f.log.sends[0].to,[verified]);
  assert.deepEqual(f.log.sendOptions[0],
    {idempotencyKey:'dominionstar/outbox/'+itemId});
  assert.match(f.log.sends[0].html,/https:\/\/dominionstarld\.com\/member-dashboard\//);
  assert.ok(f.log.updates.some(u=>u.changes.status==='sent'&&
    u.changes.provider_message_id==='synthetic-provider-id'));
  const order=f.log.queries.map(q=>q.table);
  assert.ok(order.indexOf('executive_events')>=0);
  assert.ok(order.indexOf('notification_preferences')>order.indexOf('executive_events'));
});

test('An unverified or changed Auth email cancels pending delivery without sending',async()=>{
  for(const u of [
    {id:recipient,email:verified,email_confirmed_at:null},
    {id:recipient,email:'new-address@example.invalid',
      email_confirmed_at:'2026-11-02T10:00:00Z'}
  ]){
    const f=build({user:u});
    const r=await result(await f.authorized());
    assert.equal(r.status,200);
    assert.equal(r.body.skipped,1);
    assert.equal(f.log.sends.length,0);
    assert.equal(f.log.updates[0].changes.status,'cancelled');
    assert.match(f.log.updates[0].changes.last_error,
      /no_verified_email|recipient_email_changed/);
  }
});

test('Member global or category opt-out cancels queued events before provider call',async()=>{
  for(const prefs of [
    {email_enabled:false,appointments_email_enabled:true},
    {email_enabled:true,appointments_email_enabled:false}
  ]){
    const f=build({prefs});
    const r=await result(await f.authorized());
    assert.equal(r.body.skipped,1);
    assert.equal(f.log.sends.length,0);
    assert.equal(f.log.updates[0].changes.status,'cancelled');
  }
});

test('A missing, mismatched, or unsupported event cannot send even if already queued',async()=>{
  const variants=[
    {item:{...build().model.item,dedupe_key:'untrusted-item'}},
    {event:null},
    {event:{id:eventId,member_id:'00000000-0000-4000-8000-000000000002',
      event_type:'appointment.confirmed',priority:'normal'}},
    {event:{id:eventId,member_id:recipient,
      event_type:'community.like',priority:'critical'},
      item:{...build().model.item,event_type:'community.like'}}
  ];
  for(const v of variants){
    const f=build(v);
    const r=await result(await f.authorized());
    assert.equal(r.body.skipped,1,JSON.stringify(v));
    assert.equal(f.log.sends.length,0);
    assert.equal(f.log.updates[0].changes.status,'cancelled');
  }
});

test('A failed source or Auth lookup never proceeds to send and schedules a retry',async()=>{
  for(const failure of [{authError:true},{eventQueryError:true},{preferenceQueryError:true}]){
    const f=build(failure);
    const r=await result(await f.authorized());
    assert.equal(r.status,207);
    assert.equal(r.body.failed,1);
    assert.equal(f.log.sends.length,0);
    assert.equal(f.log.updates[0].changes.status,'pending');
  }
});

test('Provider errors schedule retry without recording a false sent state',async()=>{
  const f=build({sendError:true});
  const r=await result(await f.authorized());
  assert.equal(r.status,207);
  assert.equal(r.body.sent,0);
  assert.equal(r.body.failed,1);
  assert.equal(f.log.sends.length,1);
  assert.equal(f.log.updates[0].changes.status,'pending');
  assert.ok(f.log.updates[0].changes.next_attempt_at);
});

test('Disallowed external email action URLs are suppressed even when email itself is eligible',async()=>{
  const f=build({item:{...build().model.item,
    action_url:'https://malicious.example/track?secret=1'}});
  const r=await result(await f.authorized());
  assert.equal(r.body.sent,1);
  assert.equal(f.log.sends.length,1);
  assert.ok(!f.log.sends[0].html.includes('malicious.example'));
  assert.ok(!f.log.sends[0].html.includes('Open DominionStar</a>'));
});

test('Delivery disabled in settings prevents claiming any email',async()=>{
  const f=build({setting:{is_enabled:false}});
  const r=await result(await f.authorized());
  assert.equal(r.status,409);
  assert.equal(f.log.claims.length,0);
  assert.equal(f.log.sends.length,0);
});


test('Every provider request gets the same per-outbox key, never a new attempt key',async()=>{
  const first=build();
  const second=build({item:{...build().model.item,attempts:2}});
  await first.authorized();
  await second.authorized();
  assert.equal(first.log.sendOptions.length,1);
  assert.equal(second.log.sendOptions.length,1);
  assert.deepEqual(first.log.sendOptions[0],second.log.sendOptions[0]);
  assert.equal(providerEmailIdempotencyKey({id:itemId}),
    'dominionstar/outbox/'+itemId);
  assert.equal(providerEmailIdempotencyKey({id:'not-a-uuid'}),null);
});

test('A provider-accepted email with a DB acknowledgement failure is NEVER requeued',async()=>{
  const f=build({sentUpdateError:true});
  const r=await result(await f.authorized());
  assert.equal(r.status,207);
  assert.equal(r.body.sent,0);
  assert.equal(r.body.failed,1);
  assert.equal(f.log.sends.length,1);
  assert.deepEqual(f.log.updates.map(u=>u.changes.status),['sent']);
  assert.match(r.body.errors[0],/requires manual reconciliation/);
});

test('Retries outside provider idempotency retention are held for manual review',async()=>{
  const old=new Date(Date.now()-24*60*60*1000).toISOString();
  const f=build({item:{...build().model.item,attempts:2,created_at:old}});
  const r=await result(await f.authorized());
  assert.equal(r.status,200);
  assert.equal(r.body.skipped,1);
  assert.equal(f.log.sends.length,0);
  assert.equal(f.log.updates[0].changes.status,'failed');
  assert.match(f.log.updates[0].changes.last_error,/Manual reconciliation/);
  assert.equal(needsIdempotencyManualReview({
    attempts:2,created_at:old
  }),true);
  assert.equal(needsIdempotencyManualReview({
    attempts:1,created_at:old
  }),false);
  assert.equal(needsIdempotencyManualReview({
    attempts:2
  }),true);
});

test('Retry with unknown creation time is held, but a fresh retry can proceed',async()=>{
  const missing=build({item:{...build().model.item,attempts:2,created_at:null}});
  const r=await result(await missing.authorized());
  assert.equal(r.body.skipped,1);
  assert.equal(missing.log.sends.length,0);
  const fresh=build({item:{...build().model.item,attempts:2}});
  const next=await result(await fresh.authorized());
  assert.equal(next.body.sent,1);
  assert.equal(fresh.log.sends.length,1);
});

test('An invalid outbox identity or permanent idempotency conflict does not retry',async()=>{
  const wrong=build({item:{...build().model.item,id:'bad-id'}});
  const noSend=await result(await wrong.authorized());
  assert.equal(noSend.body.failed,1);
  assert.equal(wrong.log.sends.length,0);
  assert.equal(wrong.log.updates[0].changes.status,'failed');
  const conflict=build({providerError:{
    name:'invalid_idempotent_request',message:'Provider rejects payload drift'
  }});
  const blocked=await result(await conflict.authorized());
  assert.equal(blocked.body.failed,1);
  assert.equal(conflict.log.sends.length,1);
  assert.equal(conflict.log.updates[0].changes.status,'failed');
});

test('Provider success without a message ID is held for manual reconciliation',async()=>{
  const f=build({sendMissingId:true});
  const r=await result(await f.authorized());
  assert.equal(r.status,207);
  assert.equal(r.body.failed,1);
  assert.equal(r.body.sent,0);
  assert.equal(f.log.sends.length,1);
  assert.equal(f.log.updates.length,0);
  assert.match(r.body.errors[0],/requires manual reconciliation/);
});
