import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Browser preflight needs explicit handling. All POST room/identity checks
// below are deliberately preserved from the live deployed function.
const JSON_HEADERS={"content-type":"application/json","cache-control":"no-store"};
const ALLOWED_ORIGINS=new Set(["https://dominionstarld.com","https://www.dominionstarld.com"]);
const ALLOWED_HEADERS="authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
const corsHeaders=(req:Request):Record<string,string>=>{
  const origin=req.headers.get("origin")||"";
  const headers:Record<string,string>={"vary":"Origin"};
  if(ALLOWED_ORIGINS.has(origin)){
    headers["access-control-allow-origin"]=origin;
    headers["access-control-allow-methods"]="POST, OPTIONS";
    headers["access-control-allow-headers"]=ALLOWED_HEADERS;
    headers["access-control-max-age"]="600";
  }
  return headers;
};
Deno.serve(async(req:Request)=>{
  const headers={...JSON_HEADERS,...corsHeaders(req)};
  const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==="OPTIONS"){
    return new Response(null,{status:ALLOWED_ORIGINS.has(req.headers.get("origin")||"")?204:403,headers});
  }
  if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return respond(401,{error:"authentication_required"});
  let body:any={};
  try{body=await req.json();}catch{return respond(400,{error:"invalid_json"});}
  const roomId=String(body?.roomId||"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(roomId))return respond(400,{error:"invalid_room"});

  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
  if(!supabaseUrl||!anonKey)return respond(503,{error:"broker_backend_unavailable"});

  const access=await fetch(`${supabaseUrl}/rest/v1/rpc/meet_v2_room_snapshot`,{
    method:"POST",
    headers:{"content-type":"application/json","apikey":anonKey,"authorization":auth},
    body:JSON.stringify({p_room_id:roomId})
  });
  if(!access.ok)return respond(access.status===401?401:403,{error:"meeting_access_required"});

  const turnKeyId=Deno.env.get("CLOUDFLARE_TURN_KEY_ID")||"";
  const turnApiToken=Deno.env.get("CLOUDFLARE_TURN_API_TOKEN")||"";
  if(!turnKeyId||!turnApiToken)return respond(503,{error:"turn_not_configured"});

  const requested=Number(body?.ttl||7200);
  const ttl=Math.max(900,Math.min(Number.isFinite(requested)?Math.floor(requested):7200,43200));
  const response=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`,{
    method:"POST",
    headers:{"authorization":`Bearer ${turnApiToken}`,"content-type":"application/json"},
    body:JSON.stringify({ttl})
  });
  if(!response.ok)return respond(502,{error:"turn_provider_error",status:response.status});
  const data=await response.json();
  const raw=Array.isArray(data?.iceServers)?data.iceServers:[];
  const iceServers=raw.map((server:any)=>{
    const urls=(Array.isArray(server?.urls)?server.urls:[server?.urls]).filter(Boolean).filter((url:string)=>!/:53(?:\?|$)/.test(String(url)));
    const clean:any={urls};
    if(server?.username)clean.username=String(server.username);
    if(server?.credential)clean.credential=String(server.credential);
    return clean;
  }).filter((server:any)=>server.urls.length>0);
  if(!iceServers.some((server:any)=>server.username&&server.credential))return respond(502,{error:"turn_provider_invalid_response"});
  return respond(201,{iceServers,ttl,expiresAt:new Date(Date.now()+ttl*1000).toISOString(),provider:"cloudflare"});
});
