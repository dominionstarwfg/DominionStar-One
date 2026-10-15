import assert from 'node:assert/strict';
import {compareTwoDeviceMedia} from './audit-two-device-media-evidence-20261014.mjs';

const host=(frames=48)=>({
  running:true,peerCount:1,peerLanes:[{connectionState:'connected',
    lanes:{screen:{outbound:{frames},inbound:{frames:0}}}}],
});
const guest=(frames=44,rendered=43,clock=5)=>({
  running:true,peerCount:1,peerLanes:[{connectionState:'connected',
    lanes:{screen:{inbound:{frames},outbound:{frames:0}}}}],
  remoteSharePlayback:{visible:true,width:1280,height:720,secondsAdvanced:clock,
    renderedFramesAdvanced:rendered}
});
const validate=(h,g,expected)=>{
  const actual=compareTwoDeviceMedia(h,g);
  assert.equal(actual.code,expected);
  assert.equal(actual.releaseApproved,false,'no numerical telemetry may release a build');
  assert.equal(actual.physicalVisualAcceptanceRequired,true);
  return actual;
};

const good=validate(host(),guest(),'MEDIA_PROGRESS_DETECTED');
assert.equal(good.status,'TECHNICAL_PROGRESS_ONLY');
assert.equal(good.metrics.hostScreenFramesSent,48);
assert.equal(good.metrics.guestScreenFramesDecoded,44);
validate(host(0),guest(0),'NO_HOST_SCREEN_FRAMES');
validate(host(),guest(0),'GUEST_NO_DECODED_FRAMES');
validate({...host(),peerLanes:[{connectionState:'failed',lanes:{screen:{outbound:{frames:48}}}}]},guest(),'TRANSPORT_NOT_CONNECTED');
validate(host(),{...guest(),remoteSharePlayback:{...guest().remoteSharePlayback,visible:false}},'GUEST_SHARE_NOT_VISIBLE');
validate(host(),guest(44,43,0),'GUEST_SHARE_PLAYBACK_STALLED');
validate(host(),guest(44,0,4),'GUEST_RENDERED_FRAMES_STALLED');
validate(host(),{...guest(),peerLanes:[{connectionState:'connected',lanes:{screen:{inbound:null}}}]},'RTP_COUNTERS_MISSING');
validate(host(),{...guest(),peerCount:2},'TWO_PERSON_SCOPE');
const noRenderStats=validate(host(),guest(43,null,4),'MEDIA_PROGRESS_DETECTED');
assert.equal(noRenderStats.status,'TECHNICAL_PROGRESS_ONLY');
validate(null,guest(),'REPORT_MISSING');
const missingVideo=validate(host(),{...guest(),remoteSharePlayback:null},'VIDEO_ELEMENT_MISSING');
assert.equal(missingVideo.status,'UNVERIFIED');
console.log('PASS 12 two-device evidence classifications: transport, sender, decoder, render, missing data; no automatic release');