import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const reply=(status,body)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json','cache-control':'no-store'}
});
const methodOf=request=>String(request?.httpMethod||request?.method||'').toUpperCase();
const headerOf=(request,name)=>request?.headers?.get?.(name)||request?.headers?.[name]||request?.headers?.[name.toLowerCase()]||'';

export default async(request)=>{
  if(methodOf(request)!=='POST')return reply(405,{error:'Method not allowed'});

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    PUSH_PROCESSOR_SECRET
  }=process.env;

  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY||!VAPID_SUBJECT){
    return reply(500,{error:'Push delivery environment is incomplete.'});
  }

  const supplied=headerOf(request,'x-dominionstar-secret');
  const secretAuthorized=Boolean(PUSH_PROCESSOR_SECRET&&supplied&&supplied===PUSH_PROCESSOR_SECRET);

  const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });

  if(!secretAuthorized){
    const token=headerOf(request,'authorization').replace(/^Bearer\s+/i,'');
    if(!token)return reply(401,{error:'Authentication required.'});
    const user=await supabase.auth.getUser(token);
    if(user.error||!user.data.user)return reply(401,{error:'Authentication required.'});
    const profile=await supabase.from('member_profiles')
      .select('role,is_founder')
      .eq('id',user.data.user.id)
      .single();
    if(profile.error||!(profile.data.role==='founder'||profile.data.is_founder===true)){
      return reply(403,{error:'Founder access required.'});
    }
  }

  webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);

  const claimed=await supabase.rpc('claim_push_notification_batch',{batch_size:25});
  if(claimed.error)return reply(500,{error:claimed.error.message});
  if(!claimed.data?.length)return reply(200,{sent:0,failed:0,disabled:0,processed:0});

  let sent=0,failed=0,disabled=0;
  const errors=[];

  for(const item of claimed.data){
    const subscriptions=await supabase.from('web_push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('user_id',item.recipient_id)
      .eq('enabled',true);

    if(subscriptions.error){
      failed++;
      errors.push(subscriptions.error.message);
      await supabase.from('push_notification_outbox')
        .update({
          status:'pending',
          last_error:subscriptions.error.message,
          next_attempt_at:new Date(Date.now()+120000).toISOString(),
          updated_at:new Date().toISOString()
        }).eq('id',item.id);
      continue;
    }

    if(!subscriptions.data?.length){
      await supabase.from('push_notification_outbox')
        .update({
          status:'sent',
          sent_at:new Date().toISOString(),
          last_error:'No active browser subscriptions',
          updated_at:new Date().toISOString()
        }).eq('id',item.id);
      continue;
    }

    let transientFailure=false;
    for(const sub of subscriptions.data){
      try{
        await webpush.sendNotification({
          endpoint:sub.endpoint,
          keys:{p256dh:sub.p256dh,auth:sub.auth}
        },JSON.stringify({
          title:item.title,
          body:item.body,
          tag:item.event_id||item.id,
          action_url:item.action_url||'/notifications/',
          priority:item.priority||'normal'
        }),{TTL:3600,urgency:['high','critical'].includes(String(item.priority||'').toLowerCase())?'high':'normal'});
        sent++;
      }catch(error){
        const statusCode=Number(error?.statusCode||0);
        if(statusCode===404||statusCode===410){
          const disabledRow=await supabase.from('web_push_subscriptions')
            .update({enabled:false,updated_at:new Date().toISOString()})
            .eq('id',sub.id);
          if(!disabledRow.error)disabled++;
        }else{
          transientFailure=true;
          failed++;
          errors.push(error?.message||String(error));
        }
      }
    }

    if(transientFailure){
      const attempts=Number(item.attempts||1);
      const terminal=attempts>=5;
      const retryMinutes=Math.min(60,Math.pow(2,attempts)*2);
      await supabase.from('push_notification_outbox')
        .update({
          status:terminal?'failed':'pending',
          last_error:errors.at(-1)||'Push delivery failed',
          next_attempt_at:new Date(Date.now()+retryMinutes*60000).toISOString(),
          updated_at:new Date().toISOString()
        }).eq('id',item.id);
    }else{
      await supabase.from('push_notification_outbox')
        .update({
          status:'sent',
          sent_at:new Date().toISOString(),
          last_error:null,
          updated_at:new Date().toISOString()
        }).eq('id',item.id);
    }
  }

  return reply(failed?207:200,{sent,failed,disabled,processed:claimed.data.length,errors});
};
