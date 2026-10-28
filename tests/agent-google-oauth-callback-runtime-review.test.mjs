import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../assets/js/member-login.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

async function simulate({
  identity=true, status='approved', agentCode='DS123',
  profileError=null, authenticated=true, userError=null, profileId='agent-001',
  callback=true
}={}){
  const messages={textContent:'',className:''};
  const calls={getUser:0,readProfile:0,signOut:0,redirects:[],history:[],oauth:0};
  const form=()=>({
    classList:{add() {},remove() {}},
    addEventListener(event,handler){this[event]=handler;},
    querySelector(){return{disabled:false};}
  });
  const login=form(),register=form(),reset=form();
  const googleSection={classList:{remove(){},toggle(){}}};
  const googleButton={disabled:false,addEventListener(event,handler){this[event]=handler;}};
  const elements={
    memberMessage:messages,
    memberLoginForm:login,
    memberRegisterForm:register,
    memberResetForm:reset,
    memberGoogleSignIn:googleSection,
    memberGoogleSignInButton:googleButton,
    login2Title:{textContent:''}
  };
  const window={
    DOMINIONSTAR_AUTH_FEATURES:{googleSignIn:true},
    location:{
      origin:'https://dominionstarld.com',
      search:callback?'?oauth=google':'',
      replace(url){calls.redirects.push(url);}
    },
    history:{replaceState(a,b,url){calls.history.push(url);}},
    DSAuth:{
      ready:true,
      async init(){return supabase;}
    }
  };
  const user=authenticated?{
    id:'agent-001',
    identities:identity?[{provider:'google',id:'google-test-id'}]:[{provider:'email',id:'email-test-id'}]
  }:null;
  const supabase={
    auth:{
      async getUser(){calls.getUser++;return {data:{user},error:userError};},
      async signOut(){calls.signOut++;return {error:null};},
      async signInWithOAuth(){calls.oauth++;return {error:null};}
    },
    from(table){
      assert.equal(table,'member_profiles');
      return {
        select(fields){
          assert.match(fields,/verification_status/);
          return {
            eq(column,id){
              assert.equal(column,'id');
              assert.equal(id,'agent-001');
              return {
                async maybeSingle(){
                  calls.readProfile++;
                  return {data:profileError?null:{id:profileId,agent_code:agentCode,verification_status:status},error:profileError};
                }
              };
            }
          };
        }
      };
    }
  };
  const document={
    getElementById(id){return elements[id]||null;},
    querySelectorAll(){return[];},
    querySelector(){return null;}
  };
  vm.runInNewContext(code,{window,document,URL,URLSearchParams,WeakSet,console},{timeout:2000});
  for(let i=0;i<5;i++)await flush();
  return {messages,calls,googleButton,window};
}

test('Google callback permits only approved account with Agent Code and actual linked Google identity',async()=>{
  const result=await simulate();
  assert.deepEqual(result.calls.redirects,['/member-dashboard/']);
  assert.equal(result.calls.signOut,0);
  assert.equal(result.calls.readProfile,1);
});
test('Pending Google user is signed out and never enters the Dashboard',async()=>{
  const result=await simulate({status:'pending'});
  assert.deepEqual(result.calls.redirects,[]);
  assert.equal(result.calls.signOut,1);
  assert.match(result.messages.textContent,/not approved/);
  assert.deepEqual(result.calls.history,['/member-login/']);
});
test('Approved member without a linked Google identity is denied',async()=>{
  const result=await simulate({identity:false});
  assert.deepEqual(result.calls.redirects,[]);
  assert.equal(result.calls.readProfile,0);
  assert.equal(result.calls.signOut,1);
  assert.match(result.messages.textContent,/linked Google identity/);
});
test('Profile lookup outage fails closed and signs out',async()=>{
  const result=await simulate({profileError:{message:'network unavailable'}});
  assert.deepEqual(result.calls.redirects,[]);
  assert.equal(result.calls.signOut,1);
  assert.match(result.messages.textContent,/Membership verification is unavailable/);
});
test('Agent Code missing or wrong profile id cannot bypass Founder approval',async()=>{
  for(const options of [{agentCode:' '},{profileId:'different-user'}]){
    const result=await simulate(options);
    assert.deepEqual(result.calls.redirects,[]);
    assert.equal(result.calls.signOut,1);
  }
});
test('Missing authenticated user is rejected before profile access',async()=>{
  const result=await simulate({authenticated:false});
  assert.deepEqual(result.calls.redirects,[]);
  assert.equal(result.calls.readProfile,0);
  assert.equal(result.calls.signOut,1);
});
test('Google flow remains disabled by default on the real website',()=>{
  const flags=readFileSync(new URL('../assets/js/member-login-google-flags.js',import.meta.url),'utf8');
  assert.match(flags,/googleSignIn:\s*false/);
  assert.match(flags,/googleIdentityLinking:\s*false/);
  assert.match(code,/signInWithOAuth\(\{/);
});
