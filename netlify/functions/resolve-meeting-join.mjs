import { createClient } from '@supabase/supabase-js';

const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const cleanDigits=value=>String(value||'').replace(/\D/g,'').slice(0,10);

export default async request=>{
  if(String(request?.method||request?.httpMethod||'').toUpperCase()!=='POST')return reply(405,{error:'Method not allowed'});
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return reply(500,{error:'Meeting lookup is not configured.'});
  let input={};
  try{input=typeof request.json==='function'?await request.json():JSON.parse(request.body||'{}');}catch(_){return reply(400,{error:'Invalid request'});}
  const room=cleanDigits(input.room);
  const suppliedPasscode=cleanDigits(input.passcode);
  if(room.length<6)return reply(400,{error:'Enter a valid meeting ID.'});
  const client=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const [live,scheduled,personal]=await Promise.all([
    client.from('meet_rooms').select('room_id,owner_id,waiting_room_enabled,passcode,active').eq('room_id',room).maybeSingle(),
    client.from('meet_scheduled_meetings').select('meeting_id,user_id,waiting_room_enabled,passcode').eq('meeting_id',room).maybeSingle(),
    client.from('meet_personal_rooms').select('personal_room_id,user_id,waiting_room_enabled,passcode').eq('personal_room_id',room).maybeSingle()
  ]);
  if(live.error||scheduled.error||personal.error)return reply(500,{error:'Meeting lookup failed.'});
  const canonical=scheduled.data||personal.data;
  if(!live.data&&!canonical)return reply(404,{found:false,error:'Meeting not found.'});
  // Scheduled/personal records are the canonical invitation configuration.
  // A live room may be left from an older session, so it must not replace the
  // current passcode or owner when a canonical meeting record exists.
  const expectedPasscode=cleanDigits(canonical?.passcode||live.data?.passcode);
  return reply(200,{
    found:true,
    owner_id:canonical?.user_id||live.data?.owner_id,
    waiting_room_enabled:canonical?Boolean(canonical.waiting_room_enabled):Boolean(live.data?.waiting_room_enabled),
    active:canonical?true:live.data?.active!==false,
    passcode_required:Boolean(expectedPasscode),
    passcode_valid:!expectedPasscode||suppliedPasscode===expectedPasscode
  });
};
