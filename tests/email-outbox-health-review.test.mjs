import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmailOutboxHealthHandler,classifyEmailOutboxCase,
  sanitizeEmailOutboxCase
} from '../netlify/functions/email-outbox-health.mjs';

const at=Date.parse('2026-11-08T20:00:00Z');
const before=mins=>new Date(at-mins*60000).toISOString();
const cases={
  processing:{
    id:'90000000-0000-4000-8000-000000000001',
    status:'processing',attempts:2,
    created_at:before(170),updated_at:before(28),
    provider_message_id:null,last_error:'recipient=PRIVATE@example.invalid, BODY PRIVATE'
  },
  failed:{
    id:'90000000-0000-4000-8000-000000000002',
    status:'failed',attempts:5,
    created_at:before(400),updated_at:before(240),
    provider_message_id:null,
    last_error:'Manual reconciliation required: PRIVATE@example.invalid'
  },
  pending:{
    id:'90000000-0000-4000-8000-000000000003',
    status:'pending',attempts:1,
    created_at:before(180),updated_at:before(120),
    next_attempt_at:before(85),
    provider_message_id:'provider-private-id',
    last_error:'Body of a private notification'
  }
};
const make=(opts={})=>{
  const state={clientCalls:0,authCalls:0,queries:[],writes:0};
  const rows={processing:[cases.processing],failed:[cases.failed],pending:[cases.pending],
    ...opts.rows};
  const api={
    auth:{getUser:async token=>{
      state.authCalls++;
      return opts.authFailure?
        {error:new Error('Token verification unavailable'),data:null}:
        {error:null,data:{user:token==='synthetic-founder-token'
          ?{id:'00000000-0000-4000-8000-000000000010'}:null}};
    }},
    from(table){
      let selected,filters=[],sort,limit;
      const chain={
        select(columns,options){
          selected={columns,options};
          return this;
        },
        eq(key,value){filters.push({op:'eq',key,value});return this;},
        lt(key,value){filters.push({op:'lt',key,value});return this;},
        order(key,options){sort={key,options};return this;},
        limit(n){limit=n;return this;},
        async maybeSingle(){
          if(table!=='member_profiles')throw Error('Only founder profile may be inspected');
          state.queries.push({table,selected,filters});
          if(opts.profileError)return {error:new Error('SECRET database failure')};
          return {error:null,data:opts.profile===undefined
            ?{id:'00000000-0000-4000-8000-000000000010',
              is_founder:true,verification_status:'approved'}:opts.profile};
        },
        then(resolve,reject){
          if(table!=='email_notification_outbox')
            throw Error('Expected outbox read query');
          if(selected?.columns.includes('recipient_email')||
            selected?.columns.includes('subject')||
            selected?.columns.includes('body'))
            throw Error('Sensitive outbox projection');
          if(!Number.isInteger(limit)||limit>30)throw Error('Unbounded outbox read');
          const status=filters.find(f=>f.key==='status')?.value;
          state.queries.push({table,selected,filters,sort,limit,status});
          return Promise.resolve(opts.queueError?
            {data:null,error:new Error('SECRET raw database failure')}:
            {data:(rows[status]||[]).slice(0,limit),count:opts.counts?.[status]??
              (rows[status]||[]).length,error:null}).then(resolve,reject);
        }
      };
      return chain;
    },
    rpc(){state.writes++;throw Error('Health endpoint must never call RPC')}
  };
  const env={
    DOMINIONSTAR_EMAIL_HEALTH_ENABLED:'enabled',
    SUPABASE_URL:'https://synthetic-only.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY:'FAKE-NO-REAL-SECRET',
    ...opts.env
  };
  const handler=createEmailOutboxHealthHandler({
    env,clock:()=>at,
    clientFactory:()=>{
      state.clientCalls++;
      return api;
    }
  });
  const request=(token='synthetic-founder-token',method='GET')=>handler({
    method,headers:new Headers(token?{authorization:'Bearer '+token}:{})
  });
  return {request,state,handler};
};
const json=async res=>({status:res.status,data:await res.json(),
  cache:res.headers.get('cache-control')});

test('Monitoring is disabled by default and does not query Auth, queue or email',async()=>{
  const h=make({env:{DOMINIONSTAR_EMAIL_HEALTH_ENABLED:''}});
  const r=await json(await h.request());
  assert.equal(r.status,404);
  assert.equal(h.state.clientCalls,0);
  assert.equal(h.state.queries.length,0);
  assert.equal(h.state.writes,0);
});

test('POST cannot change anything; missing/invalid identity is rejected',async()=>{
  const h=make();
  const post=await json(await h.request('synthetic-founder-token','POST'));
  assert.equal(post.status,405);
  const missing=await json(await h.request(''));
  assert.equal(missing.status,401);
  const invalid=await json(await h.request('bad-token'));
  assert.equal(invalid.status,401);
  assert.equal(h.state.queries.length,0);
  assert.equal(h.state.writes,0);
});

test('Founder verification is checked server-side, never from user profile metadata',async()=>{
  for(const profile of [
    {id:'test',is_founder:false,verification_status:'approved'},
    {id:'test',is_founder:true,verification_status:'pending'},
    null
  ]){
    const h=make({profile});
    const r=await json(await h.request());
    assert.equal(r.status,403);
    assert.equal(h.state.queries.filter(q=>q.table==='email_notification_outbox').length,0);
  }
});

test('Founder receives bounded, read-only reconciliation cases with no PII',async()=>{
  const h=make();
  const res=await h.request();
  const r=await json(res);
  assert.equal(r.status,200);
  assert.equal(r.cache,'no-store, private');
  assert.deepEqual(r.data.totals,{
    processing_stalled:1,failed:1,pending_overdue:1
  });
  assert.equal(r.data.cases.length,3);
  assert.equal(r.data.truncated,false);
  assert.deepEqual(r.data.cases.map(c=>c.reason),[
    'processing_stalled','manual_review','pending_overdue'
  ]);
  assert.equal(r.data.cases[0].age_minutes,28);
  assert.equal(r.data.cases[0].queue_age_minutes,170);
  assert.equal(r.data.cases[2].has_provider_acknowledgement,true);
  assert.ok(!JSON.stringify(r.data).includes('PRIVATE@example.invalid'));
  assert.ok(!JSON.stringify(r.data).includes('Body of a private notification'));
  assert.ok(!JSON.stringify(r.data).includes('provider-private-id'));
  assert.equal(h.state.queries.filter(q=>q.table==='email_notification_outbox').length,3);
  assert.equal(h.state.writes,0);
});

test('Count totals expose the full backlog, despite bounded item pagination',async()=>{
  const h=make({counts:{processing:330,failed:90,pending:120}});
  const r=await json(await h.request());
  assert.equal(r.status,200);
  assert.equal(r.data.totals.processing_stalled,330);
  assert.equal(r.data.totals.failed,90);
  assert.equal(r.data.totals.pending_overdue,120);
  assert.equal(r.data.cases.length,3);
  assert.equal(r.data.truncated,true);
});

test('Invalid queue IDs are never shown in Founder detail cases',async()=>{
  const h=make({rows:{failed:[{...cases.failed,id:'invalid-client-data'}]}});
  const r=await json(await h.request());
  assert.equal(r.status,200);
  assert.equal(r.data.cases.length,2);
});

test('Sensitive PostgREST errors do not appear in responses',async()=>{
  for(const opts of [{profileError:true},{queueError:true}]){
    const h=make(opts);
    const r=await json(await h.request());
    assert.equal(r.status,503);
    assert.equal(JSON.stringify(r.data).includes('SECRET'),false);
    assert.equal(h.state.writes,0);
  }
});

test('Classifier refuses raw recipient, subject, provider error or message data',()=>{
  assert.equal(classifyEmailOutboxCase({
    status:'failed',last_error:'invalid_idempotency_key rejected'
  }),'idempotency_conflict');
  assert.equal(classifyEmailOutboxCase({
    status:'failed',attempts:6
  }),'retry_exhausted');
  const row=sanitizeEmailOutboxCase(cases.processing,at);
  assert.deepEqual(Object.keys(row).sort(),[
    'age_minutes','attempts','case_id','has_provider_acknowledgement',
    'queue_age_minutes','reason','status'
  ].sort());
  for(const key of ['recipient_email','recipient_id','subject','body','last_error',
    'provider_message_id','action_url'])assert.equal(key in row,false);
});
