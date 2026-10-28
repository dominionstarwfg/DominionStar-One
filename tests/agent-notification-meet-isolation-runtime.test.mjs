import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('assets/js/account-settings.js');
const page=read('account-settings/index.html');
const css=read('assets/css/agent-settings-boundary-review.css');

async function simulateAgentNotificationSave({existing=true,writeFailure=false,approvalStatus='approved',metadataFailure=false,readFailure=false}={}){
  let row=existing?{
    user_id:'approved-agent',email_enabled:true,
    announcements_email_enabled:true,messages_email_enabled:true,
    community_email_enabled:true,appointments_email_enabled:true,
    meeting_room_email_enabled:false
  }:null;
  const state={
    nodes:{},inputs:{},ops:[],storage:{},queriedTables:[],
    user:{id:'approved-agent',email:'agent@example.invalid',
      user_metadata:{dominionstar_settings:{
        notifications:{meetingRoom:false,oldUnrelatedSetting:'preserve'},
        meetingMedia:{joinMuted:true}
      }}}
  };
  const node=id=>state.nodes[id]??=( {
    dataset:{},classList:{add(){},remove(){}},setAttribute(){},append(){},
    value:id==='theme'?'system':id==='textSize'?'standard':'',
    focus(){},reset(){}
  });
  const document={
    getElementById:node,
    querySelectorAll(selector){
      if(selector==='[data-settings-tab]'||selector==='[data-settings-panel]')return [];
      if(selector==='.settings-switch input,.settings-field select')
        return Object.values(state.inputs);
      return [];
    },
    querySelector(){return null},
    createElement(){
      const wrap={
        className:'',innerHTML:'',
        querySelector(){return wrap.input??={checked:false,disabled:false}}
      };
      return wrap;
    }
  };
  for(const id of ['systemSwitches','messageSwitches','notificationSwitches','privacySwitches']){
    state.nodes[id]={
      dataset:{},setAttribute(){},classList:{add(){},remove(){}},
      append(wrap){
        const label=wrap.innerHTML.match(/<strong>(.*?)<\/strong>/)?.[1]||id;
        state.inputs[label]=wrap.querySelector('input');
      }
    };
  }
  const db={
    auth:{
      getSession:async()=>({data:{session:{user:state.user}}}),
      getUser:async()=>({data:{user:state.user}}),
      updateUser:async({data})=>{
        if(metadataFailure)return {error:new Error('Metadata sync blocked')};
        state.user.user_metadata={...state.user.user_metadata,...data};
        return {data:{user:state.user}};
      },
      signOut:async()=>({})
    },
    from(table){
      state.queriedTables.push(table);
      if(table==='member_profiles'){
        const profileQuery={
          select(){return profileQuery},
          eq(){return profileQuery},
          async maybeSingle(){return{data:{verification_status:approvalStatus},error:null}}
        };
        return profileQuery;
      }
      assert.equal(table,'notification_preferences');
      let operation='read',payload=null;
      const query={
        select(){return query},
        eq(){return query},
        update(value){operation='update';payload=value;state.ops.push({operation,payload});return query},
        insert(value){operation='insert';payload=value;state.ops.push({operation,payload});return query},
        async maybeSingle(){
          if(writeFailure&&operation!=='read')
            return {data:null,error:new Error('RLS update blocked')};
          if(operation==='update'&&row)Object.assign(row,payload);
          if(operation==='insert')row={meeting_room_email_enabled:true,...payload};
          return {data:row,error:null};
        },
        async single(){return readFailure
          ? {data:null,error:new Error('Verification unavailable')}
          : {data:row,error:null}}
      };
      return query;
    }
  };
  const DSAuth={ready:true,init:async()=>db};
  const context={document,window:{DSAuth,CommunicationEngine:{play(){}}},
    DSAuth,location:{hash:'',href:''},history:{replaceState(){}},
    localStorage:{getItem:k=>state.storage[k]||null,setItem:(k,v)=>{state.storage[k]=v}},
    console,setTimeout,clearTimeout};
  await vm.runInNewContext(source,context);
  if(approvalStatus!=='approved')return {state,row};
  const control=state.inputs['Private-message email alerts'];
  assert.ok(control,'Expected agent message notification control');
  control.checked=false;
  await control.onchange();
  return {state,row};
}

test('Existing Agent notification update never writes a Meet-room field',async()=>{
  const {state,row}=await simulateAgentNotificationSave();
  assert.equal(state.ops.length,1);
  assert.equal(state.ops[0].operation,'update');
  assert.equal(Object.hasOwn(state.ops[0].payload,'meeting_room_email_enabled'),false);
  assert.equal(row.meeting_room_email_enabled,false);
  assert.equal(row.messages_email_enabled,false);
  assert.equal(state.user.user_metadata.dominionstar_settings.notifications.meetingRoom,false);
  assert.equal(state.user.user_metadata.dominionstar_settings.notifications.oldUnrelatedSetting,'preserve');
  assert.equal(state.user.user_metadata.dominionstar_settings.meetingMedia.joinMuted,true);
  assert.match(state.nodes.messagesResult.textContent,/saved and verified/i);
});

test('Initial Agent notification insert delegates Meet defaults to database',async()=>{
  const {state,row}=await simulateAgentNotificationSave({existing:false});
  assert.equal(state.ops.length,1);
  assert.equal(state.ops[0].operation,'insert');
  assert.equal(Object.hasOwn(state.ops[0].payload,'meeting_room_email_enabled'),false);
  assert.equal(row.meeting_room_email_enabled,true);
  assert.match(state.nodes.messagesResult.textContent,/saved and verified/i);
});

test('An RLS write failure is displayed instead of claiming save success',async()=>{
  const {state,row}=await simulateAgentNotificationSave({writeFailure:true});
  assert.equal(state.ops.length,1);
  assert.equal(state.ops[0].operation,'update');
  assert.equal(row.messages_email_enabled,true);
  assert.match(state.nodes.messagesResult.textContent,/RLS update blocked/);
  assert.equal(state.nodes.messagesResult.dataset.state,'error');
});

test('Agent Settings gives a left-aligned link to the real Meet workspace',()=>{
  assert.match(page,/id="agentMeetBridgeHeading"/);
  assert.match(page,/href="\/meet\/">Open DominionStar Meet<\/a>/);
  assert.match(page,/Choose <strong>Settings<\/strong> inside Meet/);
  assert.match(css,/align-items:flex-start/);
  assert.doesNotMatch(page,/data-settings-panel="audio-video"|data-settings-panel="meeting-defaults"/);
});

test('An unapproved Auth session cannot reveal Agent Settings or request notification rows',async()=>{
  const {state}=await simulateAgentNotificationSave({approvalStatus:'pending'});
  assert.equal(state.ops.length,0);
  assert.deepEqual(state.queriedTables,['member_profiles']);
  assert.match(state.nodes.settingsGate.textContent,/after Founder approval/);
  assert.equal(Object.keys(state.inputs).length,0);
});

test('Verified database save remains selected when secondary metadata sync fails',async()=>{
  const {state,row}=await simulateAgentNotificationSave({metadataFailure:true});
  assert.equal(row.messages_email_enabled,false);
  assert.equal(state.inputs['Private-message email alerts'].checked,false);
  assert.equal(state.nodes.messagesResult.dataset.state,'warning');
  assert.match(state.nodes.messagesResult.textContent,/saved in the database/i);
  assert.equal(state.user.user_metadata.dominionstar_settings.notifications.meetingRoom,false);
});
test('Acknowledged database write with failed readback is reported as uncertain',async()=>{
  const {state,row}=await simulateAgentNotificationSave({readFailure:true});
  assert.equal(row.messages_email_enabled,false);
  assert.equal(state.inputs['Private-message email alerts'].checked,false);
  assert.equal(state.nodes.messagesResult.dataset.state,'warning');
  assert.match(state.nodes.messagesResult.textContent,/confirmation failed/);
});
