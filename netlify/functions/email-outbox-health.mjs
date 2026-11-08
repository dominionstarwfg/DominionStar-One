import {createClient} from '@supabase/supabase-js';

// Read-only Founder triage. No provider API, no claim RPC, no queue changes,
// and no private recipient details in the response.
const reply=(status,body)=>new Response(JSON.stringify(body),{
  status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, private',
    'x-content-type-options':'nosniff'
  }
});
const header=(request,name)=>request?.headers?.get?.(name)
  ||request?.headers?.[name]||request?.headers?.[name.toLowerCase()]||'';
const method=request=>String(request?.method||request?.httpMethod||'').toUpperCase();
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const minutes=60*1000;
const lookback={
  processing:15*minutes,
  pending:60*minutes
};

export const classifyEmailOutboxCase=item=>{
  const raw=String(item?.last_error||'').toLowerCase();
  if(raw.includes('manual reconciliation')||
     raw.includes('manual review'))return 'manual_review';
  if(raw.includes('idempotency'))return 'idempotency_conflict';
  if(item.status==='processing')return 'processing_stalled';
  if(item.status==='pending')return 'pending_overdue';
  if(Number(item.attempts||0)>=5)return 'retry_exhausted';
  return 'delivery_failure';
};

export const sanitizeEmailOutboxCase=(item,now=Date.now())=>{
  if(!uuidPattern.test(String(item?.id||'')))return null;
  const updated=Date.parse(String(item.updated_at||''));
  const created=Date.parse(String(item.created_at||''));
  const age=(timestamp)=>Number.isFinite(timestamp)&&timestamp<=now
    ?Math.floor((now-timestamp)/minutes):null;
  return {
    case_id:String(item.id).toLowerCase(),
    status:['processing','pending','failed'].includes(item.status)
      ?item.status:'unknown',
    reason:classifyEmailOutboxCase(item),
    attempts:Number.isInteger(item.attempts)&&item.attempts>=0
      ?item.attempts:0,
    age_minutes:age(updated),
    queue_age_minutes:age(created),
    has_provider_acknowledgement:Boolean(item.provider_message_id)
  };
};

const projected='id,status,attempts,created_at,updated_at,next_attempt_at,provider_message_id,last_error';
export const createEmailOutboxHealthHandler=({
  clientFactory=createClient,
  env=process.env,
  clock=()=>Date.now()
}={})=>async request=>{
  if(method(request)!=='GET')return reply(405,{error:'GET required'});
  // The health route must not accidentally expose production queue metadata.
  if(env.DOMINIONSTAR_EMAIL_HEALTH_ENABLED!=='enabled'){
    return reply(404,{error:'Email health inspection is unavailable'});
  }
  const token=String(header(request,'authorization')).replace(/^Bearer\s+/i,'');
  if(!token||token===header(request,'authorization'))
    return reply(401,{error:'Authentication required'});
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY){
    return reply(503,{error:'Email health inspection is unavailable'});
  }

  try{
    const client=clientFactory(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const identity=await client.auth.getUser(token);
    if(identity.error||!identity.data?.user?.id)
      return reply(401,{error:'Authentication required'});
    // Server-owned Founder status; never trust browser metadata or JWT role text.
    const owner=await client.from('member_profiles')
      .select('id,is_founder,verification_status')
      .eq('id',identity.data.user.id).maybeSingle();
    if(owner.error)return reply(503,{error:'Email health inspection is unavailable'});
    if(owner.data?.is_founder!==true||
       owner.data?.verification_status!=='approved')
      return reply(403,{error:'Founder access required'});

    const now=clock();
    if(!Number.isFinite(now))return reply(503,{error:'Email health inspection is unavailable'});
    const iso=timestamp=>new Date(timestamp).toISOString();
    const results=await Promise.all([
      client.from('email_notification_outbox')
        .select(projected,{count:'exact'})
        .eq('status','processing')
        .lt('updated_at',iso(now-lookback.processing))
        .order('updated_at',{ascending:true}).limit(30),
      client.from('email_notification_outbox')
        .select(projected,{count:'exact'})
        .eq('status','failed')
        .order('updated_at',{ascending:false}).limit(30),
      client.from('email_notification_outbox')
        .select(projected,{count:'exact'})
        .eq('status','pending')
        .lt('next_attempt_at',iso(now-lookback.pending))
        .order('next_attempt_at',{ascending:true}).limit(30)
    ]);
    if(results.some(r=>r.error))return reply(503,{
      error:'Email health inspection is unavailable'
    });
    const [processing,failed,pending]=results;
    const rows=[...(processing.data||[]),...(failed.data||[]),...(pending.data||[])];
    return reply(200,{
      status:'review_only',
      as_of:iso(now),
      thresholds_minutes:{processing:15,pending:60},
      totals:{
        processing_stalled:processing.count??(processing.data||[]).length,
        failed:failed.count??(failed.data||[]).length,
        pending_overdue:pending.count??(pending.data||[]).length
      },
      cases:rows.map(row=>sanitizeEmailOutboxCase(row,now)).filter(Boolean),
      truncated:rows.length>=90,
      note:'No queue modifications, automatic retries or email sends are performed'
    });
  }catch{
    // Do not return service-role errors or raw provider errors to clients.
    return reply(503,{error:'Email health inspection is unavailable'});
  }
};
export default createEmailOutboxHealthHandler();
