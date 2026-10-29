import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/account-settings.js',import.meta.url),'utf8');

async function simulateAppearanceSave({serverError=false,fragment='#invalid"]'}={}){
  const state={
    inputs:{},nodes:{},
    storage:{'ds.theme':'light','ds.textSize':'large'},
    writes:0,
    user:{id:'approved-agent',email:'agent@example.invalid',
      user_metadata:{dominionstar_settings:{
        appearance:{theme:'system',textSize:'standard',reduceMotion:false}
      }}}
  };
  const node=id=>state.nodes[id]??={
    dataset:{},classList:{add(){},remove(){}},
    setAttribute(){},append(){},value:'',focus(){},reset(){}
  };
  const document={
    getElementById:node,
    querySelectorAll(selector){
      if(selector==='[data-settings-tab]'||selector==='[data-settings-panel]')return [];
      if(selector==='.settings-switch input,.settings-field select')
        return Object.values(state.inputs);
      return [];
    },
    createElement(){
      const wrapper={innerHTML:'',querySelector(){return wrapper.input??={checked:false,disabled:false}}};
      return wrapper;
    }
  };
  for(const id of ['systemSwitches','messageSwitches','notificationSwitches','privacySwitches']){
    state.nodes[id]={dataset:{},setAttribute(){},classList:{add(){},remove(){}},
      append(wrapper){
        const label=wrapper.innerHTML.match(new RegExp('<strong>(.*?)</strong>'))?.[1];
        state.inputs[label]=wrapper.querySelector('input');
      }
    };
  }
  const client={
    auth:{
      getSession:async()=>({data:{session:{user:state.user}}}),
      getUser:async()=>({data:{user:state.user}}),
      updateUser:async({data})=>{
        state.writes++;
        if(serverError)return {error:new Error('Server rejected update')};
        state.user.user_metadata={...state.user.user_metadata,...data};
        return {data:{user:state.user}};
      },
      signOut:async()=>({})
    },
    from(table){
      if(table==='member_profiles')return {
        select(){return this},eq(){return this},
        async maybeSingle(){return {data:{verification_status:'approved'},error:null}}
      };
      assert.equal(table,'notification_preferences');
      return {select(){return this},eq(){return this},
        async maybeSingle(){return {data:null,error:null}}};
    }
  };
  const auth={ready:true,init:async()=>client};
  const storage={
    getItem:key=>state.storage[key]||null,
    setItem:(key,value)=>{state.storage[key]=value}
  };
  const context={document,window:{DSAuth:auth,CommunicationEngine:{}},DSAuth:auth,
    localStorage:storage,location:{hash:fragment,href:''},
    history:{replaceState(){}},console,setTimeout};
  await vm.runInNewContext(source,context);
  const theme=node('theme'),size=node('textSize');
  theme.value='dark';size.value='large';
  await theme.onchange();
  return {state,theme,size};
}

test('Server-failed appearance save restores selects and never writes local cache',async()=>{
  const {state,theme,size}=await simulateAppearanceSave({serverError:true});
  assert.equal(state.writes,1);
  assert.equal(theme.value,'system');
  assert.equal(size.value,'standard');
  assert.equal(state.storage['ds.theme'],'light');
  assert.equal(state.storage['ds.textSize'],'large');
  assert.match(state.nodes.systemResult.textContent,/Server rejected update/);
  assert.equal(state.user.user_metadata.dominionstar_settings.appearance.theme,'system');
});

test('Server-verified appearance save updates selectors, metadata, and browser cache',async()=>{
  const {state,theme,size}=await simulateAppearanceSave();
  assert.equal(state.writes,1);
  assert.equal(theme.value,'dark');
  assert.equal(size.value,'large');
  assert.equal(state.storage['ds.theme'],'dark');
  assert.equal(state.storage['ds.textSize'],'large');
  assert.match(state.nodes.systemResult.textContent,/Saved and verified/);
  assert.equal(state.user.user_metadata.dominionstar_settings.appearance.theme,'dark');
});

test('Invalid settings hash is safely ignored, without constructing a CSS selector',async()=>{
  const {state}=await simulateAppearanceSave({fragment:'#bad"]\u005d'});
  assert.equal(state.writes,1);
  assert.match(source,/tabs.find\(t=>t.dataset.settingsTab===initialTab\)/);
  assert.doesNotMatch(source,/document.querySelector\(\u0060\[data-settings-tab/);
});
