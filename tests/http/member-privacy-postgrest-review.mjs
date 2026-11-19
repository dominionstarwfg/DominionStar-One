// Disposable-only PostgREST HTTP RLS integration. NEVER point at a Supabase URL.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

const BASE='http://127.0.0.1:3000';
const SECRET='SYNTHETIC_ONLY_POSTGREST_JWT_SECRET_REVIEW_2026';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),PRIVATE=id(2),VISIBLE=id(3),PENDING=id(5),
  FOUNDER=id(10),RECIPIENT=id(15);
const connectionId='59000000-0000-4000-8000-000000000001';
let passed=0;
const jwt=sub=>{
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const head=encode({alg:'HS256',typ:'JWT'});
 const body=encode({role:'authenticated',sub,exp:Math.floor(Date.now()/1000)+600});
 const signature=createHmac('sha256',SECRET).update(head+'.'+body).digest('base64url');
 return head+'.'+body+'.'+signature;
};
async function call(method,path,sub,body){
 assert.ok(path.startsWith('/')&&!path.startsWith('//'),'No external API URL permitted');
 const opts={method,headers:{
   accept:'application/json',
   ...(sub?{authorization:'Bearer '+jwt(sub)}:{}),
   ...(body?{'content-type':'application/json',Prefer:'return=representation'}:{})
 },signal:AbortSignal.timeout(8000)};
 if(body)opts.body=JSON.stringify(body);
 const response=await fetch(BASE+path,opts);
 const raw=await response.text();
 let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}
 return {status:response.status,data};
}
const get=(path,who)=>call('GET',path,who);
const post=(path,who,body)=>call('POST',path,who,body);
const check=(label,ok,result)=>{
 assert.ok(ok,label+' -> '+JSON.stringify(result));
 process.stdout.write('ok '+(++passed)+' - '+label+'\n');
};
const denied=result=>[400,401,403].includes(result.status);
const cpath='/member_connections?select=id,requester_id,recipient_id,status&id=eq.'+connectionId;
const epath=kind=>'/executive_events?select=id,member_id,event_type,payload'
  +'&event_type=eq.'+kind+'&payload->>connection_id=eq.'+connectionId;
let r=await get('/member_public_profiles?select=id',null);
check('Anonymous cannot read directory',denied(r),r);
r=await get('/member_public_profiles?select=id',PENDING);
check('Pending member sees no approved directory identities',r.status===200&&r.data?.length===0,r);
r=await get('/member_public_profiles?select=id,full_name,rank',A);
check('Approved member sees visible peers and not private/unapproved identities',
 r.status===200&&r.data?.some(x=>x.id===VISIBLE)
 &&r.data?.some(x=>x.id===RECIPIENT)
 &&!r.data?.some(x=>[PRIVATE,id(4),PENDING].includes(x.id)),r);
r=await get('/member_profiles?select=id,email,phone,agent_code,address_line1,account_notes&id=eq.'+PRIVATE,A);
check('Approved member cannot retrieve peer private profile',
 r.status===200&&r.data?.length===0,r);
r=await get('/member_public_profiles?select=id,email',A);
check('Safe directory projection contains no email field',r.status===400,r);

const feedPath='/rpc/list_community_feed',chatPath='/rpc/list_community_chat';
const feedBefore=await post(feedPath,A,{result_limit:100});
check('HTTP Feed uses public-safe author profile for opted-out agent',
 feedBefore.status===200 && feedBefore.data?.some(row=>
 row.id==='11000000-0000-4000-8000-000000000001' &&
 row.author_full_name===null),feedBefore);
check('HTTP Feed initially attributes opted-in approved author',
 feedBefore.status===200 && feedBefore.data?.some(row=>
 row.id==='11000000-0000-4000-8000-000000000002' &&
 row.author_full_name==='Annabelle'),feedBefore);
const chatBefore=await post(chatPath,A,{result_limit:200});
check('HTTP Community Chat does not identify opted-out author',
 chatBefore.status===200 && chatBefore.data?.some(row=>
 row.id==='12000000-0000-4000-8000-000000000001' &&
 row.author_full_name===null),chatBefore);
r=await post('/rpc/set_my_member_directory_visibility',VISIBLE,{target_visibility:'private'});
check('Agent can opt their own public directory identity out through scoped RPC',
 r.status===200&&r.data==='private',r);
r=await get('/member_public_profiles?select=id&id=eq.'+VISIBLE,A);
check('Privacy opt-out immediately removes peer from directory over HTTP',
 r.status===200&&r.data?.length===0,r);
r=await post(feedPath,A,{result_limit:100});
check('Privacy opt-out removes attribution from existing Feed posts',
 r.status===200&&r.data?.some(row=>
 row.id==='11000000-0000-4000-8000-000000000002' &&
 row.author_full_name===null),r);
r=await post(chatPath,A,{result_limit:200});
check('Privacy opt-out removes attribution from existing Community chat',
 r.status===200&&r.data?.some(row=>
 row.id==='12000000-0000-4000-8000-000000000002' &&
 row.author_full_name===null),r);
r=await post('/rpc/set_my_member_directory_visibility',PENDING,{target_visibility:'members'});
check('Unapproved agent cannot change server-authoritative directory visibility',
 denied(r),r);
r=await post('/rpc/set_my_member_directory_visibility',VISIBLE,{target_visibility:'outside'});
check('Directory visibility RPC rejects unsupported values',denied(r),r);
r=await post('/rpc/set_my_member_directory_visibility',null,{target_visibility:'members'});
check('Anonymous user cannot alter server directory visibility',denied(r),r);
r=await post('/rpc/set_my_member_directory_visibility',VISIBLE,{target_visibility:'members'});
check('Agent can explicitly opt back into the public directory',
 r.status===200&&r.data==='members',r);
r=await get('/member_public_profiles?select=id&id=eq.'+VISIBLE,A);
check('Directory projection restores an opted-in approved member',
 r.status===200&&r.data?.length===1&&r.data[0].id===VISIBLE,r);
r=await post(feedPath,A,{result_limit:100});
check('Feed attribution restored only after the agent opts back in',
 r.status===200&&r.data?.some(row=>
 row.id==='11000000-0000-4000-8000-000000000002' &&
 row.author_full_name==='Annabelle'),r);
r=await post('/rpc/list_community_feed',PENDING,{result_limit:100});
check('Unapproved agent cannot read Feed through privileged RPC',
 r.status===200&&r.data?.length===0,r);
r=await post('/rpc/list_community_chat',PENDING,{result_limit:200});
check('Unapproved agent cannot read Community Chat through privileged RPC',
 r.status===200&&r.data?.length===0,r);
r=await get('/member_profiles?select=id,email&id=eq.'+A,FOUNDER);
check('Founder remains authorized to read private profile',
 r.status===200&&r.data?.length===1&&r.data[0].id===A,r);

r=await post('/rpc/set_my_member_directory_visibility',RECIPIENT,{target_visibility:'private'});
check('Recipient can immediately hide themselves from directory',
 r.status===200&&r.data==='private',r);
r=await post('/member_connections',A,{requester_id:A,recipient_id:RECIPIENT,status:'pending'});
check('New invitations to an opted-out agent are blocked by server policy',
 denied(r),r);
r=await post('/rpc/set_my_member_directory_visibility',RECIPIENT,{target_visibility:'members'});
check('Recipient can resume receiving listed-member invitations',
 r.status===200&&r.data==='members',r);
r=await post('/member_connections',A,{requester_id:A,recipient_id:PRIVATE,status:'pending'});
check('Invitation to directory-hidden peer denied',denied(r),r);
r=await post('/member_connections',A,{requester_id:A,recipient_id:PENDING,status:'pending'});
check('Invitation to unapproved peer denied',denied(r),r);
r=await post('/member_connections',A,{requester_id:A,recipient_id:RECIPIENT,status:'accepted'});
check('Preaccepted client INSERT denied',denied(r),r);
r=await post('/member_connections',A,{id:connectionId,requester_id:A,recipient_id:RECIPIENT,status:'pending'});
check('Approved sender creates only pending invitation',
 r.status===201&&r.data?.[0]?.id===connectionId,r);
r=await get(cpath,VISIBLE);
check('Unrelated member cannot view connection',r.status===200&&r.data?.length===0,r);
r=await get(cpath,RECIPIENT);
check('Recipient can view incoming request',r.status===200&&r.data?.[0]?.status==='pending',r);
r=await post('/member_connections',RECIPIENT,{requester_id:RECIPIENT,recipient_id:A,status:'pending'});
check('Reciprocal duplicate invitation denied by unique pair index',r.status===409,r);
r=await call('PATCH','/member_connections?id=eq.'+connectionId,A,{status:'accepted'});
check('Direct browser connection UPDATE denied',denied(r),r);
r=await post('/rpc/respond_my_member_connection',VISIBLE,{target_connection_id:connectionId,target_status:'accepted'});
check('Unrelated member cannot accept request',
 r.status===200&&r.data===false,r);
r=await post('/rpc/respond_my_member_connection',RECIPIENT,{target_connection_id:connectionId,target_status:'accepted'});
check('Recipient may accept via narrowly authorized RPC',
 r.status===200&&r.data===true,r);

r=await post('/rpc/respond_my_member_connection',RECIPIENT,{
 target_connection_id:connectionId,target_status:'declined'
});
check('Accepted connection cannot be changed to declined by a replayed RPC',
 r.status===200&&r.data===false,r);
r=await post('/rpc/cancel_my_member_connection',A,{target_connection_id:connectionId});
check('Requester cannot cancel an already accepted connection',
 r.status===200&&r.data===false,r);
r=await get(cpath,A);
check('Sender sees authenticated accepted state',r.status===200&&r.data?.[0]?.status==='accepted',r);
r=await get(epath('connection.request'),RECIPIENT);
check('Recipient gets source-generated in-app request event',
 r.status===200&&r.data?.length===1&&r.data[0].member_id===RECIPIENT,r);
r=await get(epath('connection.accepted'),A);
check('Sender gets source-generated in-app acceptance event',
 r.status===200&&r.data?.length===1&&r.data[0].member_id===A,r);
r=await get(epath('connection.request'),VISIBLE);
check('Unrelated agent cannot see another recipient alert',
 r.status===200&&r.data?.length===0,r);
r=await post('/executive_events',VISIBLE,{member_id:RECIPIENT,actor_id:VISIBLE,event_type:'connection.request',title:'Forged event'});
check('Browser cannot forge other member notification',denied(r),r);
r=await post('/rpc/respond_my_member_connection',null,{target_connection_id:connectionId,target_status:'accepted'});
check('Anonymous cannot invoke privileged member response',denied(r),r);

const cancelId='59000000-0000-4000-8000-000000000002';
r=await post('/member_connections',A,{
 id:cancelId,requester_id:A,recipient_id:FOUNDER,status:'pending'
});
check('Approved requester creates independent pending invitation',
 r.status===201&&r.data?.[0]?.id===cancelId,r);
r=await post('/rpc/cancel_my_member_connection',VISIBLE,{target_connection_id:cancelId});
check('Unrelated member cannot cancel a pending connection invitation',
 r.status===200&&r.data===false,r);
r=await post('/rpc/cancel_my_member_connection',FOUNDER,{target_connection_id:cancelId});
check('Recipient cannot cancel request that was sent by the requester',
 r.status===200&&r.data===false,r);
r=await post('/rpc/cancel_my_member_connection',A,{target_connection_id:cancelId});
check('Requester may cancel only their own pending invitation',
 r.status===200&&r.data===true,r);
r=await get('/member_connections?select=id&id=eq.'+cancelId,A);
check('Cancelled pending connection does not remain accessible in inbox',
 r.status===200&&r.data?.length===0,r);
const invalid=await fetch(BASE+'/member_public_profiles?select=id',{
 headers:{authorization:'Bearer '+jwt(A)+'invalid'},signal:AbortSignal.timeout(8000)
});
check('Invalid JWT rejected before private table request',
 [401,403].includes(invalid.status),{status:invalid.status});
process.stdout.write('DISPOSABLE_MEMBER_POSTGREST_HTTP_RLS_PASS ('+passed+' HTTP assertions)\n');
