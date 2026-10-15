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
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  const path=process.argv[2];if(!path){console.error('Usage: node verify-live-share-gate-20261014.mjs <diagnostic-window.json> [sender|receiver|both]');process.exitCode=2;}
  else{const sample=JSON.parse(fs.readFileSync(path,'utf8'));const verdict=evaluate(sample,process.argv[3]||'receiver');console.log(JSON.stringify(verdict,null,2));if(!verdict.pass)process.exitCode=1;}
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
  return 'PASS simulated sender/receiver/live-playback acceptance and failure modes';
}
