import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/member-login.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function launch(overrides={}){
  const message={textContent:'',className:''};
  const calls={login:0,signup:0,reset:0};
  let pendingResolve;
  const pendingLogin=new Promise(resolve=>{pendingResolve=resolve});
  const makeForm=(values={})=>{
    const submitButton={disabled:false};
    return {
      ...values,
      method:null,
      querySelector:()=>submitButton,
      submitButton,
      reset(){this.wasReset=true},
      addEventListener(event,handler){if(event==='submit')this.submit=handler}
    };
  };
  const login=makeForm({email:{value:'agent@example.test'},password:{value:'password-123'}});
  const register=makeForm({
    full_name:{value:'Test Agent'},email:{value:'agent@example.test'},
    password:{value:'password-123'},agent_code:{value:'DS123'},smd_name:{value:''}
  });
  const reset=makeForm({email:{value:'agent@example.test'}});
  register.agent_code.focus=()=>{};
  const elements={memberMessage:message,memberLoginForm:login,memberRegisterForm:register,memberResetForm:reset};
  const location={search:'',origin:'https://dominionstarld.com',href:'/member-login/'};
  const client={
    auth:{
      async signInWithPassword(){calls.login++;if(overrides.waitLogin) return pendingLogin; if(overrides.rejectLogin)throw Error('Network inaccessible');return {error:null}},
      async signUp(){calls.signup++;if(overrides.rejectRegistration)throw Error('Network inaccessible');return {data:{session:null},error:null}},
      async resetPasswordForEmail(){calls.reset++;if(overrides.rejectReset)throw Error('Network inaccessible');return {error:null}}
    }
  };
  const document={
    getElementById:id=>elements[id]||null,
    querySelectorAll:()=>[],
    querySelector:()=>null
  };
  const window={DSAuth:{ready:true,init:async()=>client},DOMINIONSTAR_AUTH_FEATURES:{googleSignIn:false},location};
  vm.runInNewContext(source,{window,document,URL,URLSearchParams,WeakSet,console},{timeout:2000});
  await tick();
  return {login,register,reset,message,calls,location,releaseLogin:()=>pendingResolve({error:null})};
}
async function submit(form){await form.submit({preventDefault(){}})}

test('Unexpected login service exception is shown and submit button recovers',async()=>{
  const h=await launch({rejectLogin:true});
  await submit(h.login);
  assert.equal(h.calls.login,1);
  assert.equal(h.login.submitButton.disabled,false);
  assert.match(h.message.textContent,/Unable to reach the sign-in service/);
  assert.equal(h.location.href,'/member-login/');
});
test('Double click cannot start a second simultaneous authentication request',async()=>{
  const h=await launch({waitLogin:true});
  const first=submit(h.login);
  const second=submit(h.login);
  await tick();
  assert.equal(h.calls.login,1);
  assert.equal(h.login.submitButton.disabled,true);
  h.releaseLogin();
  await Promise.all([first,second]);
  assert.equal(h.login.submitButton.disabled,false);
  assert.equal(h.location.href,'/member-dashboard/');
});
test('Registration failure does not pretend an account was created',async()=>{
  const h=await launch({rejectRegistration:true});
  await submit(h.register);
  assert.equal(h.calls.signup,1);
  assert.equal(h.register.submitButton.disabled,false);
  assert.match(h.message.textContent,/Unable to reach/);
  assert.equal(h.register.wasReset,undefined);
});
test('Password reset failure does not claim recovery instructions were sent',async()=>{
  const h=await launch({rejectReset:true});
  await submit(h.reset);
  assert.equal(h.calls.reset,1);
  assert.equal(h.reset.submitButton.disabled,false);
  assert.match(h.message.textContent,/Unable to reach/);
  assert.equal(h.reset.wasReset,undefined);
});
test('Normal registration and recovery retain their preexisting success messages',async()=>{
  const h=await launch();
  await submit(h.register);
  assert.match(h.message.textContent,/Founder approval is still required/);
  assert.equal(h.register.wasReset,true);
  await submit(h.reset);
  assert.match(h.message.textContent,/If an account exists/);
  assert.equal(h.reset.wasReset,true);
});
test('Login code avoids script-scheme form actions while Google release flag remains off',()=>{
  assert.doesNotMatch(source,/javascript:void\(0\)/);
  assert.match(source,/googleEnabled = window\.DOMINIONSTAR_AUTH_FEATURES\?\.googleSignIn === true/);
  assert.match(readFileSync(new URL('../assets/js/member-login-google-flags.js',import.meta.url),'utf8'),/googleSignIn:\s*false/);
});
