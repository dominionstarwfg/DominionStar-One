import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { priorityEmailDecision, safeDominionStarEmailUrl } from './_shared/priority-email-policy.mjs';

const reply=(status,body)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[c]));
const methodOf=request=>String(request?.httpMethod||request?.method||'').toUpperCase();
const headerOf=(request,name)=>
  request?.headers?.get?.(name)||request?.headers?.[name]||
  request?.headers?.[name.toLowerCase()]||'';

const strictEmailGateEnabled=(env=process.env)=>env.DOMINIONSTAR_PRIORITY_EMAIL_ROUTING_ENABLED==='enabled';

const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const eventDedupe=new RegExp('^event:('+uuid+')

/**
 * This gate is activated only after isolated staging has verified the
 * corresponding SQL trigger and all event emitters. Keep it disabled until
 * approved. It NEVER trusts addresses or event priorities from the outbox.
 */
export async function recheckSelectedEmail(supabase,email){
  if(!email?.recipient_id)return {allowed:false,reason:'missing_recipient'};
  const account=await supabase.auth.admin.getUserById(email.recipient_id);
  if(account.error)throw account.error; // transient provider failure: retry
  const user=account.data?.user;
  if(!user?.email||!user?.email_confirmed_at)
    return {allowed:false,reason:'no_verified_email'};
  const currentEmail=String(user.email).trim();
  if(!currentEmail||currentEmail.toLowerCase()!==
      String(email.recipient_email||'').trim().toLowerCase()){
    // A previous address must never receive a delayed queue delivery.
    // Cancel stale mail instead of silently redirecting it.
    return {allowed:false,reason:'recipient_email_changed'};
  }

  let source={event_type:email.event_type,priority:'normal'};
  if(email.event_type==='meeting.host_absent'){
    if(!String(email.dedupe_key||'').startsWith('meeting-absent:'))
      return {allowed:false,reason:'untrusted_meeting_event'};
  }else{
    const match=String(email.dedupe_key||'').match(eventDedupe);
    if(!match)return {allowed:false,reason:'unverified_event_source'};
    const r=await supabase.from('executive_events')
      .select('id,member_id,event_type,priority')
      .eq('id',match[1]).maybeSingle();
    if(r.error)throw r.error;
    if(!r.data||r.data.member_id!==email.recipient_id||
       r.data.event_type!==email.event_type){
      return {allowed:false,reason:'unverified_event_source'};
    }
    source=r.data;
  }

  const p=await supabase.from('notification_preferences')
    .select('email_enabled,announcements_email_enabled,messages_email_enabled,community_email_enabled,appointments_email_enabled,meeting_room_email_enabled')
    .eq('user_id',email.recipient_id).maybeSingle();
  if(p.error)throw p.error;
  return priorityEmailDecision({
    eventType:source.event_type,priority:source.priority,
    preferences:p.data,verifiedEmail:true
  });
}

export const createEmailOutboxHandler=({
  clientFactory=createClient,
  resendFactory=key=>new Resend(key),
  env=process.env
}={})=>async request=>{
  if(methodOf(request)!=='POST')return reply(405,{error:'Method not allowed'});
  // Fail closed: an unapproved feature flag must never bypass recipient/source
  // revalidation and continue delivering legacy category-based emails.
  if(!strictEmailGateEnabled(env)){
    return reply(409,{error:'Priority email delivery is disabled pending staging approval.'});
  }
  const {
    SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,RESEND_API_KEY,
    DOMINIONSTAR_EMAIL_FROM,DOMINIONSTAR_EMAIL_FROM_NAME='DominionStar',
    DOMINIONSTAR_EMAIL_REPLY_TO,EMAIL_PROCESSOR_SECRET
  }=env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||
     !RESEND_API_KEY||!DOMINIONSTAR_EMAIL_FROM){
    return reply(500,{error:'Email delivery environment is incomplete.'});
  }
  const supplied=headerOf(request,'x-dominionstar-secret');
  const secretAuthorized=Boolean(EMAIL_PROCESSOR_SECRET&&supplied&&supplied===EMAIL_PROCESSOR_SECRET);
  const supabase=clientFactory(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  if(!secretAuthorized){
    const token=headerOf(request,'authorization').replace(/^Bearer\s+/i,'');
    if(!token)return reply(401,{error:'Authentication required.'});
    const u=await supabase.auth.getUser(token);
    if(u.error||!u.data.user)return reply(401,{error:'Authentication required.'});
    const p=await supabase.from('member_profiles')
      .select('role,is_founder').eq('id',u.data.user.id).single();
    if(p.error||!(p.data.role==='founder'||p.data.is_founder===true)){
      return reply(403,{error:'Founder access required.'});
    }
  }
  const s=await supabase.from('email_delivery_settings')
    .select('*').eq('id',true).single();
  if(s.error||!s.data?.is_enabled)
    return reply(409,{error:'Automatic email delivery is disabled.'});

  const q=await supabase.rpc('claim_email_notification_batch',{batch_size:25});
  if(q.error)return reply(500,{error:q.error.message});
  if(!q.data?.length)return reply(200,{sent:0,failed:0,skipped:0});

  const resend=resendFactory(RESEND_API_KEY);
  let sent=0,failed=0,skipped=0;
  const errors=[];
  for(const email of q.data){
    let providerAccepted=false;
    try{
      const decision=await recheckSelectedEmail(supabase,email);
      if(!decision.allowed){
        const cancelled=await supabase.from('email_notification_outbox')
          .update({status:'cancelled',
            last_error:'Suppressed by priority email policy: '+decision.reason,
            updated_at:new Date().toISOString()})
          .eq('id',email.id);
        if(cancelled.error)throw cancelled.error;
        skipped++;
        continue;
      }
      const providerKey=providerEmailIdempotencyKey(email);
      if(!providerKey)throw new Error('Invalid outbox ID: cannot safely deduplicate provider delivery');
      if(needsIdempotencyManualReview(email)){
        const held=await supabase.from('email_notification_outbox')
          .update({status:'failed',
            last_error:'Manual reconciliation required: provider dedupe window may have expired',
            updated_at:new Date().toISOString()})
          .eq('id',email.id);
        if(held.error)throw held.error;
        skipped++;
        continue;
      }
      const actionUrl=safeDominionStarEmailUrl(email.action_url);
      const r=await resend.emails.send({
        from:`${s.data.from_name||DOMINIONSTAR_EMAIL_FROM_NAME} <${DOMINIONSTAR_EMAIL_FROM}>`,
        to:[email.recipient_email],
        replyTo:s.data.reply_to_email||s.data.from_email||
          DOMINIONSTAR_EMAIL_REPLY_TO||undefined,
        subject:email.subject,
        html:`<div style="font-family:Arial,sans-serif;background:#101216;color:#f5f2e8;padding:32px"><div style="max-width:640px;margin:auto;background:#1b1f26;border:1px solid #d9b448;border-radius:18px;padding:28px"><p style="color:#d9b448;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">DominionStar</p><h1 style="font-family:Georgia,serif;color:#fff">${esc(email.subject)}</h1><div style="white-space:pre-wrap;line-height:1.65">${esc(email.body)}</div>${actionUrl?`<p style="margin-top:24px"><a href="${esc(actionUrl)}" style="display:inline-block;background:#d9b448;color:#101216;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open DominionStar</a></p>`:''}<p style="margin-top:28px;color:#aeb3bd;font-size:12px">Develop Leaders. Protect Families. Build Legacies.</p></div></div>`,
        text:email.body
      },{idempotencyKey:providerKey});
      if(r.error){
        const err=new Error(r.error.message||'Provider email request failed');
        err.code=r.error.name||r.error.code;
        throw err;
      }
      providerAccepted=true;
      const saved=await supabase.from('email_notification_outbox')
        .update({status:'sent',provider_message_id:r.data?.id||null,
          sent_at:new Date().toISOString(),last_error:null,
          updated_at:new Date().toISOString()})
        .eq('id',email.id);
      if(saved.error)throw saved.error;
      sent++;
    }catch(error){
      const reason=error?.message||String(error);
      // The provider may already have accepted the message. Do not turn a
      // failed DB acknowledgement into a second outbound delivery attempt.
      // Leave the claimed row processing for explicit operator reconciliation.
      if(providerAccepted){
        errors.push('Provider accepted; outbox status update requires manual reconciliation: '+reason);
        failed++;
        continue;
      }
      const attempts=email.attempts||1;
      const permanent=String(error?.code||'')==='invalid_idempotent_request'
        ||String(error?.code||'')==='invalid_idempotency_key'
        ||reason.startsWith('Invalid outbox ID:');
      const terminal=permanent||attempts>=5;
      const retry=Math.min(60,Math.pow(2,attempts)*2);
      const saved=await supabase.from('email_notification_outbox')
        .update({status:terminal?'failed':'pending',last_error:reason,
          next_attempt_at:new Date(Date.now()+retry*60000).toISOString(),
          updated_at:new Date().toISOString()})
        .eq('id',email.id);
      errors.push(saved.error?`${reason}; queue update: ${saved.error.message}`:reason);
      failed++;
    }
  }
  return reply(failed?207:200,{sent,failed,skipped,processed:q.data.length,errors});
};

// Default Netlify handler uses real services only after the explicit release flag.
export default createEmailOutboxHandler();
,'i');
const outboxUuid=new RegExp('^'+uuid+'

/**
 * This gate is activated only after isolated staging has verified the
 * corresponding SQL trigger and all event emitters. Keep it disabled until
 * approved. It NEVER trusts addresses or event priorities from the outbox.
 */
export async function recheckSelectedEmail(supabase,email){
  if(!email?.recipient_id)return {allowed:false,reason:'missing_recipient'};
  const account=await supabase.auth.admin.getUserById(email.recipient_id);
  if(account.error)throw account.error; // transient provider failure: retry
  const user=account.data?.user;
  if(!user?.email||!user?.email_confirmed_at)
    return {allowed:false,reason:'no_verified_email'};
  const currentEmail=String(user.email).trim();
  if(!currentEmail||currentEmail.toLowerCase()!==
      String(email.recipient_email||'').trim().toLowerCase()){
    // A previous address must never receive a delayed queue delivery.
    // Cancel stale mail instead of silently redirecting it.
    return {allowed:false,reason:'recipient_email_changed'};
  }

  let source={event_type:email.event_type,priority:'normal'};
  if(email.event_type==='meeting.host_absent'){
    if(!String(email.dedupe_key||'').startsWith('meeting-absent:'))
      return {allowed:false,reason:'untrusted_meeting_event'};
  }else{
    const match=String(email.dedupe_key||'').match(eventDedupe);
    if(!match)return {allowed:false,reason:'unverified_event_source'};
    const r=await supabase.from('executive_events')
      .select('id,member_id,event_type,priority')
      .eq('id',match[1]).maybeSingle();
    if(r.error)throw r.error;
    if(!r.data||r.data.member_id!==email.recipient_id||
       r.data.event_type!==email.event_type){
      return {allowed:false,reason:'unverified_event_source'};
    }
    source=r.data;
  }

  const p=await supabase.from('notification_preferences')
    .select('email_enabled,announcements_email_enabled,messages_email_enabled,community_email_enabled,appointments_email_enabled,meeting_room_email_enabled')
    .eq('user_id',email.recipient_id).maybeSingle();
  if(p.error)throw p.error;
  return priorityEmailDecision({
    eventType:source.event_type,priority:source.priority,
    preferences:p.data,verifiedEmail:true
  });
}

export const createEmailOutboxHandler=({
  clientFactory=createClient,
  resendFactory=key=>new Resend(key),
  env=process.env
}={})=>async request=>{
  if(methodOf(request)!=='POST')return reply(405,{error:'Method not allowed'});
  // Fail closed: an unapproved feature flag must never bypass recipient/source
  // revalidation and continue delivering legacy category-based emails.
  if(!strictEmailGateEnabled(env)){
    return reply(409,{error:'Priority email delivery is disabled pending staging approval.'});
  }
  const {
    SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,RESEND_API_KEY,
    DOMINIONSTAR_EMAIL_FROM,DOMINIONSTAR_EMAIL_FROM_NAME='DominionStar',
    DOMINIONSTAR_EMAIL_REPLY_TO,EMAIL_PROCESSOR_SECRET
  }=env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||
     !RESEND_API_KEY||!DOMINIONSTAR_EMAIL_FROM){
    return reply(500,{error:'Email delivery environment is incomplete.'});
  }
  const supplied=headerOf(request,'x-dominionstar-secret');
  const secretAuthorized=Boolean(EMAIL_PROCESSOR_SECRET&&supplied&&supplied===EMAIL_PROCESSOR_SECRET);
  const supabase=clientFactory(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  if(!secretAuthorized){
    const token=headerOf(request,'authorization').replace(/^Bearer\s+/i,'');
    if(!token)return reply(401,{error:'Authentication required.'});
    const u=await supabase.auth.getUser(token);
    if(u.error||!u.data.user)return reply(401,{error:'Authentication required.'});
    const p=await supabase.from('member_profiles')
      .select('role,is_founder').eq('id',u.data.user.id).single();
    if(p.error||!(p.data.role==='founder'||p.data.is_founder===true)){
      return reply(403,{error:'Founder access required.'});
    }
  }
  const s=await supabase.from('email_delivery_settings')
    .select('*').eq('id',true).single();
  if(s.error||!s.data?.is_enabled)
    return reply(409,{error:'Automatic email delivery is disabled.'});

  const q=await supabase.rpc('claim_email_notification_batch',{batch_size:25});
  if(q.error)return reply(500,{error:q.error.message});
  if(!q.data?.length)return reply(200,{sent:0,failed:0,skipped:0});

  const resend=resendFactory(RESEND_API_KEY);
  let sent=0,failed=0,skipped=0;
  const errors=[];
  for(const email of q.data){
    try{
      const decision=await recheckSelectedEmail(supabase,email);
      if(!decision.allowed){
        const cancelled=await supabase.from('email_notification_outbox')
          .update({status:'cancelled',
            last_error:'Suppressed by priority email policy: '+decision.reason,
            updated_at:new Date().toISOString()})
          .eq('id',email.id);
        if(cancelled.error)throw cancelled.error;
        skipped++;
        continue;
      }
      const actionUrl=safeDominionStarEmailUrl(email.action_url);
      const r=await resend.emails.send({
        from:`${s.data.from_name||DOMINIONSTAR_EMAIL_FROM_NAME} <${DOMINIONSTAR_EMAIL_FROM}>`,
        to:[email.recipient_email],
        replyTo:s.data.reply_to_email||s.data.from_email||
          DOMINIONSTAR_EMAIL_REPLY_TO||undefined,
        subject:email.subject,
        html:`<div style="font-family:Arial,sans-serif;background:#101216;color:#f5f2e8;padding:32px"><div style="max-width:640px;margin:auto;background:#1b1f26;border:1px solid #d9b448;border-radius:18px;padding:28px"><p style="color:#d9b448;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">DominionStar</p><h1 style="font-family:Georgia,serif;color:#fff">${esc(email.subject)}</h1><div style="white-space:pre-wrap;line-height:1.65">${esc(email.body)}</div>${actionUrl?`<p style="margin-top:24px"><a href="${esc(actionUrl)}" style="display:inline-block;background:#d9b448;color:#101216;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open DominionStar</a></p>`:''}<p style="margin-top:28px;color:#aeb3bd;font-size:12px">Develop Leaders. Protect Families. Build Legacies.</p></div></div>`,
        text:email.body
      });
      if(r.error)throw new Error(r.error.message);
      const saved=await supabase.from('email_notification_outbox')
        .update({status:'sent',provider_message_id:r.data?.id||null,
          sent_at:new Date().toISOString(),last_error:null,
          updated_at:new Date().toISOString()})
        .eq('id',email.id);
      if(saved.error)throw saved.error;
      sent++;
    }catch(error){
      const reason=error?.message||String(error);
      const attempts=email.attempts||1,terminal=attempts>=5;
      const retry=Math.min(60,Math.pow(2,attempts)*2);
      const saved=await supabase.from('email_notification_outbox')
        .update({status:terminal?'failed':'pending',last_error:reason,
          next_attempt_at:new Date(Date.now()+retry*60000).toISOString(),
          updated_at:new Date().toISOString()})
        .eq('id',email.id);
      errors.push(saved.error?`${reason}; queue update: ${saved.error.message}`:reason);
      failed++;
    }
  }
  return reply(failed?207:200,{sent,failed,skipped,processed:q.data.length,errors});
};

// Default Netlify handler uses real services only after the explicit release flag.
export default createEmailOutboxHandler();
,'i');
// Provider deduplication is per immutable outbox row, never per retry attempt.
export const providerEmailIdempotencyKey=email=>
  outboxUuid.test(String(email?.id||''))
    ? 'dominionstar/outbox/'+String(email.id).toLowerCase():null;
// Resend retains keys for 24 hours. A 23-hour conservative cutoff from the
// queue creation time protects ambiguous retries, including long outages.
export const needsIdempotencyManualReview=(email,now=Date.now())=>{
  if(Number(email?.attempts||0)<=1)return false;
  const created=Date.parse(String(email?.created_at||''));
  return !Number.isFinite(created)||created>now||now-created>=23*60*60*1000;
};

/**
 * This gate is activated only after isolated staging has verified the
 * corresponding SQL trigger and all event emitters. Keep it disabled until
 * approved. It NEVER trusts addresses or event priorities from the outbox.
 */
export async function recheckSelectedEmail(supabase,email){
  if(!email?.recipient_id)return {allowed:false,reason:'missing_recipient'};
  const account=await supabase.auth.admin.getUserById(email.recipient_id);
  if(account.error)throw account.error; // transient provider failure: retry
  const user=account.data?.user;
  if(!user?.email||!user?.email_confirmed_at)
    return {allowed:false,reason:'no_verified_email'};
  const currentEmail=String(user.email).trim();
  if(!currentEmail||currentEmail.toLowerCase()!==
      String(email.recipient_email||'').trim().toLowerCase()){
    // A previous address must never receive a delayed queue delivery.
    // Cancel stale mail instead of silently redirecting it.
    return {allowed:false,reason:'recipient_email_changed'};
  }

  let source={event_type:email.event_type,priority:'normal'};
  if(email.event_type==='meeting.host_absent'){
    if(!String(email.dedupe_key||'').startsWith('meeting-absent:'))
      return {allowed:false,reason:'untrusted_meeting_event'};
  }else{
    const match=String(email.dedupe_key||'').match(eventDedupe);
    if(!match)return {allowed:false,reason:'unverified_event_source'};
    const r=await supabase.from('executive_events')
      .select('id,member_id,event_type,priority')
      .eq('id',match[1]).maybeSingle();
    if(r.error)throw r.error;
    if(!r.data||r.data.member_id!==email.recipient_id||
       r.data.event_type!==email.event_type){
      return {allowed:false,reason:'unverified_event_source'};
    }
    source=r.data;
  }

  const p=await supabase.from('notification_preferences')
    .select('email_enabled,announcements_email_enabled,messages_email_enabled,community_email_enabled,appointments_email_enabled,meeting_room_email_enabled')
    .eq('user_id',email.recipient_id).maybeSingle();
  if(p.error)throw p.error;
  return priorityEmailDecision({
    eventType:source.event_type,priority:source.priority,
    preferences:p.data,verifiedEmail:true
  });
}

export const createEmailOutboxHandler=({
  clientFactory=createClient,
  resendFactory=key=>new Resend(key),
  env=process.env
}={})=>async request=>{
  if(methodOf(request)!=='POST')return reply(405,{error:'Method not allowed'});
  // Fail closed: an unapproved feature flag must never bypass recipient/source
  // revalidation and continue delivering legacy category-based emails.
  if(!strictEmailGateEnabled(env)){
    return reply(409,{error:'Priority email delivery is disabled pending staging approval.'});
  }
  const {
    SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,RESEND_API_KEY,
    DOMINIONSTAR_EMAIL_FROM,DOMINIONSTAR_EMAIL_FROM_NAME='DominionStar',
    DOMINIONSTAR_EMAIL_REPLY_TO,EMAIL_PROCESSOR_SECRET
  }=env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||
     !RESEND_API_KEY||!DOMINIONSTAR_EMAIL_FROM){
    return reply(500,{error:'Email delivery environment is incomplete.'});
  }
  const supplied=headerOf(request,'x-dominionstar-secret');
  const secretAuthorized=Boolean(EMAIL_PROCESSOR_SECRET&&supplied&&supplied===EMAIL_PROCESSOR_SECRET);
  const supabase=clientFactory(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  if(!secretAuthorized){
    const token=headerOf(request,'authorization').replace(/^Bearer\s+/i,'');
    if(!token)return reply(401,{error:'Authentication required.'});
    const u=await supabase.auth.getUser(token);
    if(u.error||!u.data.user)return reply(401,{error:'Authentication required.'});
    const p=await supabase.from('member_profiles')
      .select('role,is_founder').eq('id',u.data.user.id).single();
    if(p.error||!(p.data.role==='founder'||p.data.is_founder===true)){
      return reply(403,{error:'Founder access required.'});
    }
  }
  const s=await supabase.from('email_delivery_settings')
    .select('*').eq('id',true).single();
  if(s.error||!s.data?.is_enabled)
    return reply(409,{error:'Automatic email delivery is disabled.'});

  const q=await supabase.rpc('claim_email_notification_batch',{batch_size:25});
  if(q.error)return reply(500,{error:q.error.message});
  if(!q.data?.length)return reply(200,{sent:0,failed:0,skipped:0});

  const resend=resendFactory(RESEND_API_KEY);
  let sent=0,failed=0,skipped=0;
  const errors=[];
  for(const email of q.data){
    try{
      const decision=await recheckSelectedEmail(supabase,email);
      if(!decision.allowed){
        const cancelled=await supabase.from('email_notification_outbox')
          .update({status:'cancelled',
            last_error:'Suppressed by priority email policy: '+decision.reason,
            updated_at:new Date().toISOString()})
          .eq('id',email.id);
        if(cancelled.error)throw cancelled.error;
        skipped++;
        continue;
      }
      const actionUrl=safeDominionStarEmailUrl(email.action_url);
      const r=await resend.emails.send({
        from:`${s.data.from_name||DOMINIONSTAR_EMAIL_FROM_NAME} <${DOMINIONSTAR_EMAIL_FROM}>`,
        to:[email.recipient_email],
        replyTo:s.data.reply_to_email||s.data.from_email||
          DOMINIONSTAR_EMAIL_REPLY_TO||undefined,
        subject:email.subject,
        html:`<div style="font-family:Arial,sans-serif;background:#101216;color:#f5f2e8;padding:32px"><div style="max-width:640px;margin:auto;background:#1b1f26;border:1px solid #d9b448;border-radius:18px;padding:28px"><p style="color:#d9b448;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">DominionStar</p><h1 style="font-family:Georgia,serif;color:#fff">${esc(email.subject)}</h1><div style="white-space:pre-wrap;line-height:1.65">${esc(email.body)}</div>${actionUrl?`<p style="margin-top:24px"><a href="${esc(actionUrl)}" style="display:inline-block;background:#d9b448;color:#101216;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open DominionStar</a></p>`:''}<p style="margin-top:28px;color:#aeb3bd;font-size:12px">Develop Leaders. Protect Families. Build Legacies.</p></div></div>`,
        text:email.body
      });
      if(r.error)throw new Error(r.error.message);
      const saved=await supabase.from('email_notification_outbox')
        .update({status:'sent',provider_message_id:r.data?.id||null,
          sent_at:new Date().toISOString(),last_error:null,
          updated_at:new Date().toISOString()})
        .eq('id',email.id);
      if(saved.error)throw saved.error;
      sent++;
    }catch(error){
      const reason=error?.message||String(error);
      const attempts=email.attempts||1,terminal=attempts>=5;
      const retry=Math.min(60,Math.pow(2,attempts)*2);
      const saved=await supabase.from('email_notification_outbox')
        .update({status:terminal?'failed':'pending',last_error:reason,
          next_attempt_at:new Date(Date.now()+retry*60000).toISOString(),
          updated_at:new Date().toISOString()})
        .eq('id',email.id);
      errors.push(saved.error?`${reason}; queue update: ${saved.error.message}`:reason);
      failed++;
    }
  }
  return reply(failed?207:200,{sent,failed,skipped,processed:q.data.length,errors});
};

// Default Netlify handler uses real services only after the explicit release flag.
export default createEmailOutboxHandler();
