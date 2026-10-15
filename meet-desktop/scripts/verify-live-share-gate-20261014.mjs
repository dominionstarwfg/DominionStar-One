// Read-only acceptance classifier for the output of DominionWebRTCController.diagnosticWindow().
// Usage: node meet-desktop/scripts/verify-live-share-gate-20261014.mjs <diagnostic-window.json>
// A passing gate requires independent sender, receiver and visible video playback proof.
import fs from 'node:fs';
import assert from 'node:assert/strict';
export function evaluate(result,role='receiver'){
  const failures=[];
  if(!['sender','receiver','both'].includes(role))return {pass:false,role,failures:['invalid_role'],physicalVisualAcceptance:false};
  const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
  const requireValue=(ok,reason)=>{if(!ok)failures.push(reason)};
  requireValue(result?.running===true,'meeting_not_running');
  requireValue(result?.networkOnline===true,'network_offline');
  requireValue(Number(result?.durationMs)>=3000,'insufficient_sample_window');
  requireValue(Number(result?.peerCount)>=1,'no_remote_peer');
  requireValue((result?.connectionStates||[]).some(s=>s==='connected'),'no_connected_peer');
  const lanes=result?.peerLanes||[];
  if(role==='sender'||role==='both'){
    requireValue(lanes.some(p=>p.connectionState==='connected'&&p.lanes?.screen?.senderState==='live'&&positive(p.lanes?.screen?.outbound?.frames)&&positive(p.lanes?.screen?.outbound?.bytes)),'no_screen_outbound_frame_progress');
  }
  if(role==='receiver'||role==='both'){
    requireValue(lanes.some(p=>p.connectionState==='connected'&&p.lanes?.screen?.receiverState==='live'&&positive(p.lanes?.screen?.inbound?.frames)&&positive(p.lanes?.screen?.inbound?.bytes)),'no_screen_decoded_frame_progress');
    const v=result?.remoteSharePlayback;
    requireValue(Boolean(v?.visible&&v.readyState>=2&&v.width>0&&v.height>0),'remote_screen_not_visible');
    requireValue(Boolean(v?.streamTracks?.some(t=>t.kind==='video'&&t.readyState==='live'&&t.enabled===true&&t.muted===false)),'remote_screen_track_not_live');
    requireValue(positive(v?.secondsAdvanced),'remote_screen_playback_stalled');
    requireValue(positive(v?.renderedFramesAdvanced),'remote_screen_rendered_frames_missing_or_stalled');
  }
  return {pass:failures.length===0,role,failures,physicalVisualAcceptance:false};
}
// Pairing is an operator-supplied assertion: telemetry omits room/participant IDs.
// Separate sender and receiver samples are required. A single client's 'both'
// result must not be presented as end-to-end two-device acceptance.
export function evaluatePair(sender,receiver,{sameMeetingConfirmed=false,maxSkewMs=15000}={}){
  const tx=evaluate(sender,'sender'),rx=evaluate(receiver,'receiver');
  const failures=[...tx.failures.map(x=>'sender:'+x),...rx.failures.map(x=>'receiver:'+x)];
  if(sameMeetingConfirmed!==true)failures.push('same_meeting_not_confirmed');
  const senderAt=Date.parse(sender?.at||''),receiverAt=Date.parse(receiver?.at||'');
  if(!Number.isFinite(senderAt)||!Number.isFinite(receiverAt)||Math.abs(senderAt-receiverAt)>maxSkewMs)
    failures.push('sample_timestamps_not_aligned');
  if(sender===receiver)failures.push('same_sample_used_twice');
  return {pass:failures.length===0,failures,physicalVisualAcceptance:false};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    const args=process.argv.slice(2);
    if(args[0]==='--pair'){
      const [senderPath,receiverPath,...flags]=args.slice(1);
      if(!senderPath||!receiverPath||!flags.includes('--confirm-same-meeting')||flags.some(x=>x!=='--confirm-same-meeting')){
        console.error('Usage: node verify-live-share-gate-20261014.mjs --pair <sender.json> <receiver.json> --confirm-same-meeting');process.exitCode=2;
      }else{
        const senderReal=fs.realpathSync(senderPath),receiverReal=fs.realpathSync(receiverPath);
        if(senderReal===receiverReal){console.log(JSON.stringify({pass:false,failures:['same_file_used_twice'],physicalVisualAcceptance:false},null,2));process.exitCode=1;}
        else{
          const sender=JSON.parse(fs.readFileSync(senderReal,'utf8'));
          const receiver=JSON.parse(fs.readFileSync(receiverReal,'utf8'));
          const verdict=evaluatePair(sender,receiver,{sameMeetingConfirmed:true});
          console.log(JSON.stringify(verdict,null,2));if(!verdict.pass)process.exitCode=1;
        }
      }
    }else if(args[0]==='--self-test'){
      console.log(selfTest());
    }else if(args.length>=1&&args.length<=2&&(!args[1]||['sender','receiver','both'].includes(args[1]))){
      const verdict=evaluate(JSON.parse(fs.readFileSync(args[0],'utf8')),args[1]||'receiver');
      console.log(JSON.stringify(verdict,null,2));if(!verdict.pass)process.exitCode=1;
    }else{console.error('Usage: node verify-live-share-gate-20261014.mjs <sample.json> [sender|receiver|both] OR --pair <sender.json> <receiver.json> --confirm-same-meeting OR --self-test');process.exitCode=2;}
  }catch(error){console.error('QA input error:',error?.message||String(error));process.exitCode=2;}
}
export function selfTest(){
  const base={running:true,networkOnline:true,durationMs:4500,peerCount:1,connectionStates:['connected'],peerLanes:[{connectionState:'connected',lanes:{screen:{senderState:'live',receiverState:'live',outbound:{frames:12,bytes:8000},inbound:{frames:10,bytes:6000}}}}],remoteSharePlayback:{visible:true,readyState:4,width:1280,height:720,secondsAdvanced:4.1,renderedFramesAdvanced:82,streamTracks:[{kind:'video',readyState:'live',enabled:true,muted:false}]}};
  assert.equal(evaluate(base,'both').pass,true);
  assert.equal(evaluate({...base,remoteSharePlayback:{...base.remoteSharePlayback,renderedFramesAdvanced:null}},'receiver').pass,false);
  assert.equal(evaluate({...base,peerLanes:[{connectionState:'connected',lanes:{screen:{senderState:'live',receiverState:'live',outbound:{frames:12,bytes:8000},inbound:{frames:null,bytes:6000}}}}]},'receiver').pass,false);
  assert.equal(evaluate({...base,remoteSharePlayback:{...base.remoteSharePlayback,visible:false}},'receiver').pass,false);
  assert.equal(evaluate({...base,peerLanes:[{connectionState:'connected',lanes:{screen:{senderState:'live',receiverState:'live',outbound:{frames:0,bytes:0},inbound:{frames:0,bytes:0}}}}]},'both').pass,false);
  assert.equal(evaluate(base,'invalid').pass,false);
  assert.equal(evaluate({...base,remoteSharePlayback:{...base.remoteSharePlayback,streamTracks:[]}},'receiver').pass,false);
  assert.equal(evaluate({...base,remoteSharePlayback:{...base.remoteSharePlayback,secondsAdvanced:'5'}},'receiver').pass,false);
  const pairedSender={...base,at:'2026-10-14T12:00:00Z'};
  const pairedReceiver={...base,at:'2026-10-14T12:00:03Z'};
  assert.equal(evaluatePair(pairedSender,pairedReceiver,{sameMeetingConfirmed:true}).pass,true);
  assert.equal(evaluatePair(pairedSender,pairedReceiver).pass,false);
  assert.equal(evaluatePair(pairedSender,pairedSender,{sameMeetingConfirmed:true}).pass,false);
  assert.equal(evaluatePair(pairedSender,{...pairedReceiver,at:'2026-10-14T12:02:00Z'},{sameMeetingConfirmed:true}).pass,false);
  return 'PASS simulated sender/receiver/live-playback acceptance and failure modes';
}
