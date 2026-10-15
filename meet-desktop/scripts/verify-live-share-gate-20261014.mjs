// Read-only acceptance classifier for the output of DominionWebRTCController.diagnosticWindow().
// Usage: node meet-desktop/scripts/verify-live-share-gate-20261014.mjs <diagnostic-window.json>
// A passing gate requires independent sender, receiver and visible video playback proof.
import fs from 'node:fs';
import assert from 'node:assert/strict';
export function evaluate(result,role='receiver'){
  const failures=[];
  const requireValue=(ok,reason)=>{if(!ok)failures.push(reason)};
  requireValue(result?.running===true,'meeting_not_running');
  requireValue(result?.networkOnline===true,'network_offline');
  requireValue(Number(result?.durationMs)>=3000,'insufficient_sample_window');
  requireValue(Number(result?.peerCount)>=1,'no_remote_peer');
  requireValue((result?.connectionStates||[]).some(s=>s==='connected'),'no_connected_peer');
  const lanes=result?.peerLanes||[];
  if(role==='sender'||role==='both'){
    requireValue(lanes.some(p=>p.connectionState==='connected'&&p.lanes?.screen?.senderState==='live'&&Number(p.lanes?.screen?.outbound?.frames)>0&&Number(p.lanes?.screen?.outbound?.bytes)>0),'no_screen_outbound_frame_progress');
  }
  if(role==='receiver'||role==='both'){
    requireValue(lanes.some(p=>p.connectionState==='connected'&&p.lanes?.screen?.receiverState==='live'&&Number(p.lanes?.screen?.inbound?.frames)>0&&Number(p.lanes?.screen?.inbound?.bytes)>0),'no_screen_decoded_frame_progress');
    const v=result?.remoteSharePlayback;
    requireValue(Boolean(v?.visible&&v.readyState>=2&&v.width>0&&v.height>0),'remote_screen_not_visible');
    requireValue(Number(v?.secondsAdvanced)>0,'remote_screen_playback_stalled');
    requireValue(Number(v?.renderedFramesAdvanced)>0,'remote_screen_rendered_frames_missing_or_stalled');
  }
  return {pass:failures.length===0,role,failures,physicalVisualAcceptance:false};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  const path=process.argv[2];if(!path){console.error('Usage: node verify-live-share-gate-20261014.mjs <diagnostic-window.json> [sender|receiver|both]');process.exitCode=2;}
  else{const sample=JSON.parse(fs.readFileSync(path,'utf8'));const verdict=evaluate(sample,process.argv[3]||'receiver');console.log(JSON.stringify(verdict,null,2));if(!verdict.pass)process.exitCode=1;}
}
export function selfTest(){
  const base={running:true,networkOnline:true,durationMs:4500,peerCount:1,connectionStates:['connected'],peerLanes:[{connectionState:'connected',lanes:{screen:{senderState:'live',receiverState:'live',outbound:{frames:12,bytes:8000},inbound:{frames:10,bytes:6000}}}}],remoteSharePlayback:{visible:true,readyState:4,width:1280,height:720,secondsAdvanced:4.1,renderedFramesAdvanced:82}};
  assert.equal(evaluate(base,'both').pass,true);
  assert.equal(evaluate({...base,remoteSharePlayback:{...base.remoteSharePlayback,renderedFramesAdvanced:null}},'receiver').pass,false);
  assert.equal(evaluate({...base,peerLanes:[{connectionState:'connected',lanes:{screen:{senderState:'live',receiverState:'live',outbound:{frames:12,bytes:8000},inbound:{frames:null,bytes:6000}}}}]},'receiver').pass,false);
  assert.equal(evaluate({...base,remoteSharePlayback:{...base.remoteSharePlayback,visible:false}},'receiver').pass,false);
  assert.equal(evaluate({...base,peerLanes:[{connectionState:'connected',lanes:{screen:{senderState:'live',receiverState:'live',outbound:{frames:0,bytes:0},inbound:{frames:0,bytes:0}}}}]},'both').pass,false);
  return 'PASS simulated sender/receiver/live-playback acceptance and failure modes';
}
