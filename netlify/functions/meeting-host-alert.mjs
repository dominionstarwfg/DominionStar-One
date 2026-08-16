import { createClient } from '@supabase/supabase-js';
import processOutbox from './process-email-outbox.mjs';

const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

export default async request=>{
  if(String(request?.method||request?.httpMethod||'').toUpperCase()!=='POST')return reply(405,{error:'Method not allowed'});
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,EMAIL_PROCESSOR_SECRET}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return reply(500,{error:'Meeting alert queue is not configured.'});
  let input={};
  try{input=typeof request.json==='function'?await request.json():JSON.parse(request.body||'{}');}catch(_){return reply(400,{error:'Invalid request'});}
  const room=String(input.room||'').replace(/\D/g,'').slice(0,10);
  const visitorName=String(input.visitorName||'A guest').replace(/[\r\n<>]/g,' ').trim().slice(0,80)||'A guest';
  if(room.length<6)return reply(400,{error:'Invalid meeting room'});
  const client=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const queued=await client.rpc('queue_meeting_host_absent_notification',{target_room:room,visitor_name:visitorName});
  if(queued.error)return reply(500,{error:queued.error.message});
  // Process the outbox even when this request was deduplicated. A previous
  // request may already have queued the alert while the scheduled worker was
  // still waiting for its next run.
  // Queueing is the durable success boundary. Immediate delivery is attempted
  // when configured, while the scheduled worker remains the recovery path.
  if(!EMAIL_PROCESSOR_SECRET)return reply(202,{queued:Boolean(queued.data?.queued),reason:queued.data?.reason||null,delivery:{deferred:true}});
  const delivered=await processOutbox({method:'POST',httpMethod:'POST',headers:new Headers({'x-dominionstar-secret':EMAIL_PROCESSOR_SECRET})});
  const result=await delivered.json().catch(()=>({}));
  return reply(queued.data?.queued===false&&queued.data?.reason?200:202,{queued:Boolean(queued.data?.queued),reason:queued.data?.reason||null,delivery:{immediate:delivered.ok,...result}});
};
