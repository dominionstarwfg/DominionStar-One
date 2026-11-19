import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  normalizeFounderEmailHealth,requestFounderEmailHealth,
  renderFounderEmailHealth
} from '../assets/js/founder-email-health.mjs';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=text('founder-email/index.html');
const code=text('assets/js/founder-email-health.mjs');
const css=text('assets/css/dominionstar-founder-email-health.css');
const server=text('netlify/functions/email-outbox-health.mjs');
const source={
  status:'review_only',totals:{processing_stalled:3,failed:4,pending_overdue:5},
  cases:[{
    case_id:'90000000-0000-4000-8000-000000000001',
    status:'processing',reason:'manual_review',
    attempts:2,age_minutes:25,queue_age_minutes:180,
    has_provider_acknowledgement:true,
    recipient_email:'confidential@example.invalid',
    subject:'PRIVATE EMAIL SUBJECT',
    body:'PRIVATE BODY',provider_message_id:'PRIVATE_PROVIDER_ID'
  }],
  truncated:false
};

test('Founder Email page reuses existing navigation and only one review panel',()=>{
  assert.match(page,/href="\/founder-control\/"/);
  assert.match(page,/id="emailHealthPanel"/);
  assert.match(page,/id="emailHealthRefresh"/);
  assert.match(page,/id="emailHealthCases"/);
  assert.match(page,/id="emailHealthProcessing"/);
  assert.match(page,/id="emailHealthFailed"/);
  assert.match(page,/id="emailHealthPending"/);
  assert.match(page,/founder-email-health\.mjs\?v=review-20261108/);
  assert.match(page,/dominionstar-founder-email-health\.css\?v=review-20261108/);
  assert.match(page,/This panel cannot send, retry, cancel or modify email/);
});

test('Response normalizer returns allowlisted numbers and sanitized case data only',()=>{
  const report=normalizeFounderEmailHealth(source);
  assert.deepEqual(report.totals,{
    processing_stalled:3,failed:4,pending_overdue:5
  });
  assert.deepEqual(report.cases[0],{
    case_id:source.cases[0].case_id,
    status:'processing',reason:'manual_review',
    attempts:2,age_minutes:25,queue_age_minutes:180,
    has_provider_acknowledgement:true
  });
  const serialized=JSON.stringify(report);
  for(const secret of ['confidential@example.invalid','PRIVATE BODY',
    'PRIVATE EMAIL SUBJECT','PRIVATE_PROVIDER_ID'])assert.ok(!serialized.includes(secret));
  assert.equal('recipient_email' in report.cases[0],false);
});

test('Unexpected server fields, invalid case references and malformed state are discarded',()=>{
  assert.throws(()=>normalizeFounderEmailHealth({cases:[]}),/Unrecognized/);
  const report=normalizeFounderEmailHealth({
    status:'review_only',
    totals:{processing_stalled:-40,failed:3.2,pending_overdue:'12'},
    cases:[{...source.cases[0],case_id:'not-valid'},
      {...source.cases[0],status:'sent'},
      {...source.cases[0],reason:'raw sensitive recipient'},
      {...source.cases[0],attempts:-9,age_minutes:-6}],
    truncated:true
  });
  assert.equal(report.cases.length,1);
  assert.equal(report.cases[0].attempts,0);
  assert.equal(report.cases[0].age_minutes,null);
  assert.deepEqual(report.totals,{
    processing_stalled:0,failed:0,pending_overdue:0
  });
  assert.equal(report.truncated,true);
});

test('Only a fixed read-only endpoint is requested with a bearer token',async()=>{
  const calls=[];
  const report=await requestFounderEmailHealth('SYNTHETIC-TOKEN',{
    fetchImpl:async(url,config)=>{
      calls.push({url,config});
      return {ok:true,status:200,json:async()=>source};
    }
  });
  assert.equal(report.cases.length,1);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{
    url:'/.netlify/functions/email-outbox-health',
    config:{
      method:'GET',cache:'no-store',credentials:'same-origin',
      headers:{authorization:'Bearer SYNTHETIC-TOKEN'}
    }
  });
});

test('Disabled, unauthorized, expired or network-failed monitoring is never shown as working',async()=>{
  for(const [status,error] of [
    [404,'monitoring_not_enabled'],[401,'auth_required'],
    [403,'access_denied'],[503,'monitoring_unavailable']
  ]){
    await assert.rejects(()=>requestFounderEmailHealth('TOKEN',{
      fetchImpl:async()=>({status,ok:false})
    }),new RegExp(error));
  }
  await assert.rejects(()=>requestFounderEmailHealth('',{
    fetchImpl:()=>{throw Error('Should not fetch')}
  }),/auth_required/);
  await assert.rejects(()=>requestFounderEmailHealth('TOKEN',{
    fetchImpl:async()=>{throw Error('Sensitive network endpoint')}
  }),/monitoring_unavailable/);
});

test('Visible review components never render server data as HTML',()=>{
  const original=globalThis.document;
  const newNode=(tag)=>{
    const e={
      tagName:tag,className:'',textContent:'',children:[],
      append(...items){this.children.push(...items)},
      replaceChildren(...items){this.children=[...items]}
    };
    return e;
  };
  const parts={};
  for(const id of ['emailHealthProcessing','emailHealthFailed',
    'emailHealthPending','emailHealthCases'])parts[id]=newNode('div');
  const panel={querySelector:selector=>parts[selector.slice(1)]};
  globalThis.document={createElement:newNode};
  try{
    renderFounderEmailHealth(panel,normalizeFounderEmailHealth(source));
    assert.equal(parts.emailHealthProcessing.textContent,'3');
    assert.equal(parts.emailHealthFailed.textContent,'4');
    assert.equal(parts.emailHealthPending.textContent,'5');
    assert.equal(parts.emailHealthCases.children.length,1);
    const serialized=JSON.stringify(parts);
    assert.ok(!serialized.includes('PRIVATE BODY'));
    assert.ok(!serialized.includes('confidential@example.invalid'));
    assert.ok(serialized.includes(source.cases[0].case_id));
  }finally{
    if(original===undefined)delete globalThis.document;
    else globalThis.document=original;
  }
});

test('Client review never claims queue, sends email, posts form or writes data',()=>{
  assert.match(code,/addEventListener\('click'/);
  assert.match(code,/button\.disabled=true/);
  assert.match(code,/getSession\(\)/);
  assert.match(code,/panel\.querySelector\('#emailHealthCases'\)\?\.replaceChildren\(\)/);
  assert.doesNotMatch(code,/innerHTML\s*=|\\.rpc\(|\\.update\(|\\.insert\(|\\.delete\(|method:'POST'|resend|process-email-outbox/i);
  assert.match(server,/DOMINIONSTAR_EMAIL_HEALTH_ENABLED!=='enabled'/);
  assert.match(server,/owner\.data\?\.is_founder!==true/);
  assert.match(server,/owner\.data\?\.verification_status!=='approved'/);
});

test('Founder-only CSS keeps icons and text visible on mobile without unscoped overrides',()=>{
  assert.match(css,/#emailHealthPanel\.ds-email-health/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/color:#edf3ff/);
  assert.match(css,/overflow-wrap:anywhere/);
});
