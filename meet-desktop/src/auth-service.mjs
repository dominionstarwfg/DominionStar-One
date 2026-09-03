import { safeStorage } from 'electron';
import { createClient } from '@supabase/supabase-js';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SUPABASE_URL='https://ckmurvhjumzlhsegncba.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_zAzk_tobvWHOWR22bmzMMw_uqHnCVxb';
const CALLBACK_HOST='127.0.0.1';
const CALLBACK_PORT=37654;
const CALLBACK_PATH='/auth/callback';
export const CALLBACK_URL=`http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;

const callbackSuccessHtml=`<!doctype html><meta charset="utf-8"><title>DominionStar Meet</title><style>body{margin:0;background:#07111f;color:#f5f7fb;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center}.card{width:min(520px,calc(100% - 48px));padding:34px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#0d1a2a;text-align:center}.mark{color:#e5b842;font-size:28px}h1{font-size:22px;margin:14px 0 8px}p{color:#91a0b4;line-height:1.55;margin:0}</style><div class="card"><div class="mark">✦</div><h1>Signed in to DominionStar Meet</h1><p>You can close this browser window. DominionStar Meet is returning to the foreground.</p></div>`;
const callbackErrorHtml=message=>`<!doctype html><meta charset="utf-8"><title>DominionStar Meet sign-in error</title><style>body{margin:0;background:#07111f;color:#f5f7fb;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center}.card{width:min(520px,calc(100% - 48px));padding:34px;border:1px solid rgba(232,78,97,.32);border-radius:20px;background:#0d1a2a}h1{font-size:22px;margin:0 0 10px}p{color:#c5cfdb;line-height:1.55;margin:0}</style><div class="card"><h1>Sign-in could not be completed</h1><p>${String(message||'Unknown authentication error').replace(/[<>&"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[char]))}</p></div>`;

function userSummary(user,profile=null){
  if(!user)return null;
  const metadata=user.user_metadata||{};
  const preferred=String(profile?.preferred_name||'').trim();
  const full=String(profile?.full_name||'').trim();
  return {
    id:String(user.id||''),
    email:String(profile?.email||user.email||''),
    name:preferred||full||String(metadata.full_name||metadata.name||user.email?.split('@')[0]||'DominionStar Member'),
    avatarUrl:String(profile?.avatar_url||metadata.avatar_url||metadata.picture||''),
    rank:String(profile?.rank||''),
    agentCode:String(profile?.agent_code||''),
    isFounder:Boolean(profile?.is_founder),
    memberProfile:Boolean(profile)
  };
}

function createEncryptedStorage(app){
  const storagePath=path.join(app.getPath('userData'),'auth','supabase-session.bin');
  let cache=null;
  const load=async()=>{if(cache)return cache;cache={};try{const encoded=await readFile(storagePath,'utf8');if(!encoded||!safeStorage.isEncryptionAvailable())return cache;const json=safeStorage.decryptString(Buffer.from(encoded,'base64'));const parsed=JSON.parse(json);if(parsed&&typeof parsed==='object')cache=parsed;}catch{}return cache;};
  const persist=async()=>{if(!safeStorage.isEncryptionAvailable())return;await mkdir(path.dirname(storagePath),{recursive:true});const encrypted=safeStorage.encryptString(JSON.stringify(cache||{}));await writeFile(storagePath,encrypted.toString('base64'),{encoding:'utf8',mode:0o600});};
  return {getItem:async key=>String((await load())[key]??'')||null,setItem:async(key,value)=>{const data=await load();data[key]=value;await persist();},removeItem:async key=>{const data=await load();delete data[key];await persist();}};
}

export function createDesktopAuth({app,shell,getMainWindow}){
  let client=null;let callbackServer=null;let subscription=null;
  const avatarUrlCache=new Map();
  const normalizeAvatarPath=value=>{const next=String(value||'').trim().replace(/^\/+/, '');return /^[0-9a-f-]{36}\/avatar\.(?:png|jpe?g|webp)$/i.test(next)?next:'';};
  const foregroundApp=()=>{const win=getMainWindow?.();if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();};
  const emitState=async()=>{const state=await getState();const win=getMainWindow?.();if(win&&!win.isDestroyed())win.webContents.send('auth:changed',state);return state;};

  async function initialize(){
    if(client)return;
    client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:createEncryptedStorage(app)}});
    const {data}=client.auth.onAuthStateChange(()=>setTimeout(()=>void emitState(),0));subscription=data?.subscription||null;
    app.once('before-quit',()=>{subscription?.unsubscribe?.();callbackServer?.close?.();avatarUrlCache.clear();});
  }
  async function signedAvatarUrl(value,{force=false}={}){
    if(!client)await initialize();
    const avatarPath=normalizeAvatarPath(value);if(!avatarPath)return '';
    const cached=avatarUrlCache.get(avatarPath),now=Date.now();
    if(!force&&cached?.url&&cached.expiresAt-now>10*60*1000)return cached.url;
    try{
      const signed=await client.storage.from('member-avatars').createSignedUrl(avatarPath,3600);
      const url=String(signed.data?.signedUrl||'');
      if(signed.error||!url){avatarUrlCache.delete(avatarPath);return '';}
      avatarUrlCache.set(avatarPath,{url,expiresAt:now+50*60*1000});
      return url;
    }catch{avatarUrlCache.delete(avatarPath);return '';}
  }
  async function getState(){
    if(!client)return {ready:false,signedIn:false,user:null};
    const {data,error}=await client.auth.getSession();
    if(error||!data?.session)return {ready:true,signedIn:false,user:null,error:error?.message||''};
    let profile=null;
    try{
      const result=await client.from('member_profiles').select('full_name,preferred_name,email,rank,agent_code,is_founder,avatar_path').eq('id',data.session.user.id).maybeSingle();
      if(!result.error){
        profile=result.data||null;
        if(profile?.avatar_path){const avatarUrl=await signedAvatarUrl(profile.avatar_path);if(avatarUrl)profile={...profile,avatar_url:avatarUrl};}
      }
    }catch{}
    return {ready:true,signedIn:true,user:userSummary(data.session.user,profile)};
  }
  async function ensureCallbackServer(){
    if(callbackServer?.listening)return;
    callbackServer=http.createServer(async(req,res)=>{try{const requestUrl=new URL(req.url||'/',CALLBACK_URL);if(req.method!=='GET'||requestUrl.pathname!==CALLBACK_PATH){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return;}const providerError=requestUrl.searchParams.get('error_description')||requestUrl.searchParams.get('error');if(providerError)throw new Error(providerError);const code=requestUrl.searchParams.get('code');if(!code)throw new Error('The authentication callback did not contain a PKCE authorization code.');const {data,error}=await client.auth.exchangeCodeForSession(code);if(error||!data?.session)throw new Error(error?.message||'Supabase did not return a desktop session.');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(callbackSuccessHtml);foregroundApp();await emitState();}catch(error){res.writeHead(400,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(callbackErrorHtml(error?.message));const win=getMainWindow?.();if(win&&!win.isDestroyed())win.webContents.send('auth:error',{message:String(error?.message||error)});foregroundApp();}});
    await new Promise((resolve,reject)=>{const onError=error=>{callbackServer?.removeListener('listening',onListening);reject(error);};const onListening=()=>{callbackServer?.removeListener('error',onError);resolve();};callbackServer.once('error',onError);callbackServer.once('listening',onListening);callbackServer.listen(CALLBACK_PORT,CALLBACK_HOST);});
  }
  async function startGoogle(){
    if(!client)await initialize();
    try{await ensureCallbackServer();}catch(error){if(error?.code==='EADDRINUSE')throw new Error(`DominionStar Meet cannot start Google sign-in because local callback port ${CALLBACK_PORT} is already in use.`);throw error;}
    const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:CALLBACK_URL,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
    if(error||!data?.url)throw new Error(error?.message||'Google sign-in URL was not created.');const authorizationUrl=new URL(data.url);const redirect=authorizationUrl.searchParams.get('redirect_to');if(redirect!==CALLBACK_URL)throw new Error('Desktop authentication refused an unexpected redirect destination.');await shell.openExternal(data.url);return {ok:true,callbackUrl:CALLBACK_URL};
  }
  async function signInPassword(email,password){
    if(!client)await initialize();
    const normalizedEmail=String(email||'').trim().toLowerCase();
    const normalizedPassword=String(password||'');
    if(!normalizedEmail||!normalizedEmail.includes('@'))throw new Error('Enter a valid email address.');
    if(!normalizedPassword)throw new Error('Enter your password.');
    const {data,error}=await client.auth.signInWithPassword({email:normalizedEmail,password:normalizedPassword});
    if(error||!data?.session)throw new Error(error?.message||'Email sign-in could not be completed.');
    foregroundApp();
    return emitState();
  }
  async function updateAvatar(dataUrl){
    if(!client)await initialize();
    const {data,error}=await client.auth.getSession();if(error||!data?.session?.user)throw new Error('authentication_required');
    const match=String(dataUrl||'').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);if(!match)throw new Error('invalid_profile_image');
    const mime=match[1].toLowerCase()==='jpeg'?'image/jpeg':`image/${match[1].toLowerCase()}`;
    const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>5*1024*1024)throw new Error('profile_image_too_large');
    const ext=mime==='image/jpeg'?'jpg':mime.split('/')[1];const userId=String(data.session.user.id);const avatarPath=`${userId}/avatar.${ext}`;
    const upload=await client.storage.from('member-avatars').upload(avatarPath,bytes,{contentType:mime,upsert:true,cacheControl:'3600'});if(upload.error)throw new Error(upload.error.message||'avatar_upload_failed');
    const current=await client.from('member_profiles').select('full_name,phone,address_line1,address_line2,city,state,postal_code,country').eq('id',userId).maybeSingle();if(current.error||!current.data)throw new Error(current.error?.message||'profile_not_found');
    const profile=current.data;
    const saved=await client.rpc('update_own_contact_profile',{
      new_full_name:profile.full_name||'',new_phone:profile.phone||'',new_address_line1:profile.address_line1||'',new_address_line2:profile.address_line2||'',new_city:profile.city||'',new_state:profile.state||'',new_postal_code:profile.postal_code||'',new_country:profile.country||'',new_avatar_path:avatarPath
    });if(saved.error)throw new Error(saved.error.message||'avatar_profile_update_failed');
    avatarUrlCache.delete(avatarPath);
    return emitState();
  }
  async function signOut(){if(!client)return {ok:true};const {error}=await client.auth.signOut();if(error)throw error;avatarUrlCache.clear();await emitState();return {ok:true};}
  async function rpc(name,args={}){if(!client)await initialize();const {data,error}=await client.rpc(name,args);if(error)throw new Error(error.message||`Meeting service failed: ${name}`);return data;}
  async function invokeServerFunction(name,body={}){
    if(!client)await initialize();
    const {data,error}=await client.functions.invoke(String(name||''),{body:body||{}});
    if(error)throw new Error(error.message||`Server function failed: ${name}`);
    if(data?.error)throw new Error(String(data.error));
    return data;
  }

  return Object.freeze({initialize,getState,startGoogle,signInPassword,updateAvatar,signOut,rpc,invokeServerFunction,signedAvatarUrl,callbackUrl:CALLBACK_URL});
}
