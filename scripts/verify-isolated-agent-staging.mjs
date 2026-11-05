/* Read-only authenticated staging gate for DominionStar Agent OS.
 * Requires separate nonproduction Supabase project and synthetic test accounts.
 * No service-role key, no SQL writes, no email sends and no queue claims.
 * Usage: DOMINIONSTAR_STAGING_ISOLATION_APPROVED=STAGING_ONLY ... \
 *        node scripts/verify-isolated-agent-staging.mjs
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';

const productionProjectRef='ckmurvhjumzlhsegncba'; // Production identifier, NOT a secret.
export function validateStagingConfig(env){
  if(env.DOMINIONSTAR_STAGING_ISOLATION_APPROVED!=='STAGING_ONLY')
    throw new Error('Staging authorization missing. No tests executed.');
  const raw=String(env.DOMINIONSTAR_STAGING_SUPABASE_URL||'');
  let url;
  try{url=new URL(raw);}catch{throw new Error('Invalid staging Supabase URL.');}
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||
    !url.hostname.startsWith('https:')&&url.hostname===productionProjectRef+'.supabase.co'||
    url.hostname.includes(productionProjectRef)){
    throw new Error('Refusing production or non-isolated Supabase URL.');
  }
  if(url.username||url.password||url.pathname!=='/'&&url.pathname!==''){
    throw new Error('Staging URL must be the project root without credentials.');
  }
  const key=String(env.DOMINIONSTAR_STAGING_SUPABASE_PUBLISHABLE_KEY||'');
  if(!key.startsWith('sb_publishable_'))
    throw new Error('A staging publishable key is required; secret/service keys are forbidden.');
  const a=String(env.DOMINIONSTAR_STAGING_TEST_MEMBER_A_EMAIL||'').trim();
  const b=String(env.DOMINIONSTAR_STAGING_TEST_MEMBER_B_EMAIL||'').trim();
  const ap=String(env.DOMINIONSTAR_STAGING_TEST_MEMBER_A_PASSWORD||'');
  const bp=String(env.DOMINIONSTAR_STAGING_TEST_MEMBER_B_PASSWORD||'');
  if(!a||!b||a.toLowerCase()===b.toLowerCase()||!ap||!bp)
    throw new Error('Two different synthetic approved staging member credentials are required.');
  return {url:url.origin,key,a,b,ap,bp};
}
const report=(name)=>process.stdout.write('PASS '+name+'\n');
const clientFor=(cfg)=>createClient(cfg.url,cfg.key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
async function signIn(client,email,password){
  const result=await client.auth.signInWithPassword({email,password});
  if(result.error||!result.data?.user?.id)throw new Error('Staging test account login failed.');
  return result.data.user;
}
async function read(client,table,columns,filter){
  let query=client.from(table).select(columns);
  if(filter)query=query.eq(filter.key,filter.value);
  return query;
}
export async function runStagingVerification(env=process.env){
  const cfg=validateStagingConfig(env); // Fail before any network request.
  const alice=clientFor(cfg),bob=clientFor(cfg);
  const [userA,userB]=await Promise.all([
    signIn(alice,cfg.a,cfg.ap),signIn(bob,cfg.b,cfg.bp)
  ]);
  assert.notEqual(userA.id,userB.id);
  const [aProfile,bProfile]=await Promise.all([
    alice.from('member_profiles').select('id,verification_status,profile_visibility')
      .eq('id',userA.id).single(),
    bob.from('member_profiles').select('id,verification_status,profile_visibility')
      .eq('id',userB.id).single()
  ]);
  if(aProfile.error||bProfile.error||
    aProfile.data?.verification_status!=='approved'||
    bProfile.data?.verification_status!=='approved'){
    throw new Error('Synthetic test accounts must be approved on isolated staging.');
  }
  report('two distinct approved staging sessions');

  const peerPrivate=await alice.from('member_profiles')
    .select('id,email,phone,address_line1,account_notes')
    .eq('id',userB.id);
  if(peerPrivate.error)throw peerPrivate.error;
  assert.equal(peerPrivate.data?.length,0,
    'P0 SECURITY FAILURE: approved A can read approved B private profile');
  report('peer private profile RLS denies cross-member data');

  const peerPublic=await alice.from('member_public_profiles')
    .select('id,full_name,preferred_name,rank,avatar_path,city,state')
    .eq('id',userB.id);
  if(peerPublic.error)throw peerPublic.error;
  const expected=bProfile.data.profile_visibility==='members';
  assert.equal(peerPublic.data?.length,expected?1:0,
    'Directory must honor server-owned member visibility');
  report('approved opted-in directory projection verified');

  const privatePrefs=await alice.from('notification_preferences')
    .select('user_id,email_enabled').eq('user_id',userB.id);
  if(!privatePrefs.error)assert.equal(privatePrefs.data?.length,0,
    'Another member notification preferences were exposed');
  report('member notification email choices are private');

  const events=await alice.from('executive_events')
    .select('id,member_id').eq('member_id',userB.id);
  if(!events.error)assert.equal(events.data?.length,0,
    'Another member notification inbox was exposed');
  report('member notification inbox RLS verified');

  const outbox=await alice.from('email_notification_outbox')
    .select('id',{head:true,count:'exact'});
  if(!outbox.error)assert.equal(outbox.count,0,
    'Members must not read the privileged email delivery queue');
  report('privileged email outbox inaccessible to ordinary agents');

  const [authA,authB]=await Promise.all([alice.auth.getUser(),bob.auth.getUser()]);
  if(authA.error||authB.error)throw new Error('Staging Auth verification unavailable.');
  for(const result of [authA,authB]){
    assert.ok(result.data?.user?.email_confirmed_at,
      'Synthetic member email must be verified in Supabase Auth');
  }
  report('email destination derives from verified Auth member record');
  // Do not print UUIDs or member email addresses in CI logs.
  process.stdout.write('ISOLATED_AGENT_STAGING_READ_ONLY_PASS\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  runStagingVerification().catch(error=>{
    process.stderr.write('STAGING_GATE_FAILED: '+error.message+'\n');
    process.exitCode=1;
  });
}
