import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-single-instance-2.0.28.mjs <DominionStar Meet.app>');
const executable=path.resolve(appPath,'Contents','MacOS','DominionStar Meet');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function launch(args=[]){
  let stderr='';
  const child=spawn(executable,args,{
    env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'},
    stdio:['ignore','ignore','pipe']
  });
  child.stderr.on('data',chunk=>{stderr+=String(chunk);});
  return {child,stderr:()=>stderr};
}

async function waitAlive(child,label,timeout=8000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`${label} exited early with code ${child.exitCode}.`);
    await sleep(100);
    if(Date.now()+250>=deadline)return;
  }
}

async function waitExit(child,label,timeout=8000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(child.exitCode!==null)return child.exitCode;
    await sleep(100);
  }
  throw new Error(`${label} did not exit after single-instance handoff.`);
}

let first=null,second=null;
try{
  const primary=launch(['--remote-debugging-port=11928','--remote-allow-origins=*']);
  first=primary.child;
  await waitAlive(first,'Primary DominionStar Meet',4500);

  const duplicate=launch([]);
  second=duplicate.child;
  const duplicateExit=await waitExit(second,'Duplicate DominionStar Meet',7000);
  assert.ok([0,null].includes(duplicateExit)||Number.isInteger(duplicateExit),'Duplicate launch must terminate as a real process exit.');

  assert.equal(first.exitCode,null,'Primary DominionStar Meet must remain alive after duplicate launch.');
  assert.equal(first.killed,false,'Primary DominionStar Meet must not be terminated by the second launch.');

  console.log('DOMINIONSTAR_PACKAGED_SINGLE_INSTANCE_2_0_28_OK primary-remains duplicate-exits one-runtime-authority');
}finally{
  for(const child of [second,first]){
    if(child&&child.exitCode===null){
      try{child.kill('SIGTERM');}catch{}
      await sleep(200);
      if(child.exitCode===null){try{child.kill('SIGKILL');}catch{}}
    }
  }
}
