import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../assets/js/account-settings.js',import.meta.url),'utf8');

async function startAgentSettings(mode){
 const nodes={};
 const getNode=id=>nodes[id]??={textContent:'',classList:{
   classes:new Set(),add(x){this.classes.add(x)},remove(x){this.classes.delete(x)}
 }};
 let dbReads=0;
 const db={
   auth:{
     getSession:async()=>mode==='session-error'
       ? {data:{session:null},error:new Error('session read failed')}
       : {data:{session:mode==='signed-out'?null:{user:{id:'agent-id',email:'member@example.invalid'}}}}
   },
   from(){dbReads++;throw Error('Should not load member information before session verification')}
 };
 const auth={
   ready:true,
   init:async()=>{
     if(mode==='initialization-error')throw Error('Auth service unavailable');
     return db;
   }
 };
 const location={href:'/account-settings/',hash:''};
 const context={
   window:{DSAuth:auth},DSAuth:auth,document:{getElementById:getNode},
   location,console
 };
 await vm.runInNewContext(script,context);
 return {nodes,dbReads,location};
}

test('Authentication initialization failure remains behind gate and shows retry message',async()=>{
 const {nodes,dbReads,location}=await startAgentSettings('initialization-error');
 assert.equal(dbReads,0);
 assert.equal(nodes.settingsApp?.classList.classes.has('member-hidden')||false,false);
 assert.match(nodes.settingsGate.textContent,/Unable to verify your account session/);
 assert.equal(location.href,'/account-settings/');
});

test('Session read errors do not redirect or reveal Agent Settings',async()=>{
 const {nodes,dbReads,location}=await startAgentSettings('session-error');
 assert.equal(dbReads,0);
 assert.match(nodes.settingsGate.textContent,/secure session could not be verified/);
 assert.equal(location.href,'/account-settings/');
});

test('Signed-out members are directed to member login before profile reads',async()=>{
 const {dbReads,location}=await startAgentSettings('signed-out');
 assert.equal(dbReads,0);
 assert.equal(location.href,'/member-login/');
});
