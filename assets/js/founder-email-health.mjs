/* Scoped Founder Email read-only health panel.
 * Deliberately no database writes, queue claims, resend action or polling.
 * The server independently checks an approved, founder-owned Auth identity.
 */
const validUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedStatuses=new Set(['processing','pending','failed']);
const allowedReasons=new Set([
  'manual_review','idempotency_conflict','processing_stalled',
  'pending_overdue','retry_exhausted','delivery_failure'
]);

const safeCount=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const safeMinutes=value=>Number.isSafeInteger(value)&&value>=0?value:null;

export function normalizeFounderEmailHealth(payload){
  if(payload?.status!=='review_only'||!Array.isArray(payload?.cases))
    throw Error('Unrecognized email-health response');
  const totals=payload.totals||{};
  const list=payload.cases.slice(0,90);
  const cases=[];
  for(const raw of list){
    if(!validUuid.test(String(raw?.case_id||''))||
       !allowedStatuses.has(raw.status)||
       !allowedReasons.has(raw.reason))continue;
    // Whitelist output fields: never copy an arbitrary server response
    // object into the visible UI, including if it contains hidden PII.
    cases.push({
      case_id:raw.case_id.toLowerCase(),
      status:raw.status,
      reason:raw.reason,
      attempts:safeCount(raw.attempts),
      age_minutes:safeMinutes(raw.age_minutes),
      queue_age_minutes:safeMinutes(raw.queue_age_minutes),
      has_provider_acknowledgement:raw.has_provider_acknowledgement===true
    });
  }
  return {
    totals:{
      processing_stalled:safeCount(totals.processing_stalled),
      failed:safeCount(totals.failed),
      pending_overdue:safeCount(totals.pending_overdue)
    },
    cases,
    truncated:payload.truncated===true
  };
}

export async function requestFounderEmailHealth(accessToken,{
  fetchImpl=fetch
}={}){
  if(typeof accessToken!=='string'||!accessToken.trim())
    throw Error('auth_required');
  // Strict fixed endpoint: no user-entered URL or query is accepted.
  let response;
  try{
    response=await fetchImpl('/.netlify/functions/email-outbox-health',{
      method:'GET',
      cache:'no-store',
      credentials:'same-origin',
      headers:{authorization:'Bearer '+accessToken}
    });
  }catch{
    throw Error('monitoring_unavailable');
  }
  if(response.status===404)throw Error('monitoring_not_enabled');
  if(response.status===401)throw Error('auth_required');
  if(response.status===403)throw Error('access_denied');
  if(!response.ok)throw Error('monitoring_unavailable');
  let data;
  try{data=await response.json();}catch{throw Error('monitoring_unavailable')}
  return normalizeFounderEmailHealth(data);
}

const labelForReason=reason=>({
  manual_review:'Manual verification needed',
  idempotency_conflict:'Delivery identity conflict',
  processing_stalled:'Processing is stalled',
  pending_overdue:'Pending retry is overdue',
  retry_exhausted:'Maximum attempts reached',
  delivery_failure:'Delivery failure'
})[reason]||'Review required';

const node=(tag,cls,value)=>{
  const element=document.createElement(tag);
  if(cls)element.className=cls;
  if(value!==undefined)element.textContent=String(value);
  return element;
};

export function renderFounderEmailHealth(panel,report){
  const processing=panel.querySelector('#emailHealthProcessing');
  const failed=panel.querySelector('#emailHealthFailed');
  const pending=panel.querySelector('#emailHealthPending');
  const cases=panel.querySelector('#emailHealthCases');
  if(!processing||!failed||!pending||!cases)
    throw Error('Founder health panel is incomplete');
  processing.textContent=String(report.totals.processing_stalled);
  failed.textContent=String(report.totals.failed);
  pending.textContent=String(report.totals.pending_overdue);
  cases.replaceChildren();
  if(!report.cases.length){
    cases.append(node('p','ds-email-health-empty',
      'No stalled or failed items were reported in this review sample.'));
    return;
  }
  for(const item of report.cases){
    const article=node('article','ds-email-health-case');
    const top=node('div','ds-email-health-case-heading');
    top.append(node('strong','',labelForReason(item.reason)));
    top.append(node('span','ds-email-health-state',item.status));
    article.append(top);
    // A bounded case reference is needed for an authorized admin to locate
    // a queued record. It is not a link and triggers no mutation.
    article.append(node('p','ds-email-health-ref','Case '+item.case_id));
    article.append(node('p','ds-email-health-meta',
      'Attempts '+item.attempts+' · Last activity '+(
        item.age_minutes===null?'unknown':item.age_minutes+' min ago'
      )+' · Provider acknowledgement '+(
        item.has_provider_acknowledgement?'recorded':'not recorded'
      )));
    cases.append(article);
  }
  if(report.truncated){
    cases.append(node('p','ds-email-health-empty',
      'Additional cases exist. Review the full backlog in the authorized operations environment.'));
  }
}

export async function initFounderEmailHealth(){
  const panel=document.getElementById('emailHealthPanel');
  if(!panel)return;
  const button=panel.querySelector('#emailHealthRefresh');
  const status=panel.querySelector('#emailHealthStatus');
  if(!button||!status)return;

  button.addEventListener('click',async()=>{
    if(button.disabled)return;
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    status.textContent='Checking authorized delivery health…';
    try{
      if(!window.DSAuth?.ready)throw Error('auth_required');
      const client=await window.DSAuth.init();
      const {data,error}=await client.auth.getSession();
      if(error||!data?.session?.access_token)throw Error('auth_required');
      const report=await requestFounderEmailHealth(data.session.access_token);
      renderFounderEmailHealth(panel,report);
      status.textContent='Founder-only read-only report loaded. No emails were sent or modified.';
    }catch(error){
      const message={
        monitoring_not_enabled:'Email delivery monitoring is not enabled for this release.',
        auth_required:'A valid Founder sign-in is required. Sign in again to continue.',
        access_denied:'The signed-in account is not authorized for this Founder report.',
        monitoring_unavailable:'Delivery monitoring is currently unavailable.'
      }[error?.message]||'Delivery monitoring is currently unavailable.';
      status.textContent=message;
      // Never leave previous privileged data visible after failed or expired
      // authorization. Keep the Founder page, but clear health details.
      for(const id of ['emailHealthProcessing','emailHealthFailed','emailHealthPending']){
        const element=panel.querySelector('#'+id);
        if(element)element.textContent='—';
      }
      panel.querySelector('#emailHealthCases')?.replaceChildren();
    }finally{
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  });
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',()=>initFounderEmailHealth(),{once:true});
  else initFounderEmailHealth();
}
