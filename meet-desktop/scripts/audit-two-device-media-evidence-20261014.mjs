// Two-device diagnosticWindow() comparator. Read-only offline Node utility.
// Values must be collected from a real host and guest while sharing moving content.
// Even successful counters are *technical evidence only*, never release approval.
import fs from 'node:fs';

const hasValue=value=>typeof value==='number'&&Number.isFinite(value);
const result=(status,code,details,metrics={})=>({status,code,details,metrics,
  releaseApproved:false,physicalVisualAcceptanceRequired:true});

export function compareTwoDeviceMedia(host,guest){
  if(!host||!guest||typeof host!=='object'||typeof guest!=='object')
    return result('UNVERIFIED','REPORT_MISSING','Collect both timed host and guest diagnosticWindow reports.');
  if(host.peerCount!==1||guest.peerCount!==1)
    return result('UNVERIFIED','TWO_PERSON_SCOPE','Use exactly one host and one guest for this media-pair diagnostic.');
  if(host.running!==true||guest.running!==true)
    return result('FAIL','MEETING_NOT_RUNNING','A participant left or media controller is not active on both computers.');
  const hostPeer=host.peerLanes?.[0],guestPeer=guest.peerLanes?.[0];
  if(!hostPeer||!guestPeer)return result('UNVERIFIED','PEER_TELEMETRY_MISSING','At least one peer lane report is absent.');
  if(hostPeer.connectionState!=='connected'||guestPeer.connectionState!=='connected')
    return result('FAIL','TRANSPORT_NOT_CONNECTED','The peer connection is not connected on both devices.');
  const sent=hostPeer.lanes?.screen?.outbound?.frames;
  const received=guestPeer.lanes?.screen?.inbound?.frames;
  if(!hasValue(sent)||!hasValue(received))
    return result('UNVERIFIED','RTP_COUNTERS_MISSING','Screen sender/decoder counters were not available on both computers.');
  const metrics={hostScreenFramesSent:sent,guestScreenFramesDecoded:received};
  if(sent<=0)return result('FAIL','NO_HOST_SCREEN_FRAMES','The host did not send screen-video frames during the sample.',metrics);
  if(received<=0)return result('FAIL','GUEST_NO_DECODED_FRAMES','Host sent screen frames but the guest did not decode any.',metrics);
  const video=guest.remoteSharePlayback;
  if(!video||typeof video!=='object')return result('UNVERIFIED','VIDEO_ELEMENT_MISSING','Receiver screen-video element telemetry is unavailable.',metrics);
  metrics.guestPlaybackSecondsAdvanced=video.secondsAdvanced;
  metrics.guestRenderedFramesAdvanced=video.renderedFramesAdvanced??null;
  if(video.visible!==true||!hasValue(video.width)||video.width<=0||
      !hasValue(video.height)||video.height<=0)
    return result('FAIL','GUEST_SHARE_NOT_VISIBLE','Receiver decoded screen frames but did not display a valid visible video stage.',metrics);
  if(!hasValue(video.secondsAdvanced))return result('UNVERIFIED','PLAYBACK_CLOCK_MISSING','Receiver playback clock progress could not be measured.',metrics);
  if(video.secondsAdvanced<=0)
    return result('FAIL','GUEST_SHARE_PLAYBACK_STALLED','Receiver decoded frames but the visible screen-video clock did not advance.',metrics);
  if(hasValue(video.renderedFramesAdvanced)&&video.renderedFramesAdvanced<=0)
    return result('FAIL','GUEST_RENDERED_FRAMES_STALLED','Receiver decoded RTP but no additional frames were rendered by the video element.',metrics);
  // Success is intentionally not PASS: counters cannot prove the actual content
  // is the right source, unobscured, readable, or visually flicker-free.
  return result('TECHNICAL_PROGRESS_ONLY','MEDIA_PROGRESS_DETECTED',
    video.renderedFramesAdvanced==null?
      'Sender and decoder progress detected; rendered-frame telemetry unavailable. Human visual acceptance required.':
      'Sender, decoder, rendered-frame and playback progress detected. Human visual acceptance required.',metrics);
}

if(process.argv[1]&&process.argv[1].endsWith('audit-two-device-media-evidence-20261014.mjs')){
  const [hostPath,guestPath]=process.argv.slice(2);
  if(!hostPath||!guestPath){
    console.error('Usage: node scripts/audit-two-device-media-evidence-20261014.mjs host-report.json guest-report.json');
    process.exitCode=2;
  }else{
    try{
      const host=JSON.parse(fs.readFileSync(hostPath,'utf8'));
      const guest=JSON.parse(fs.readFileSync(guestPath,'utf8'));
      const comparison=compareTwoDeviceMedia(host,guest);
      console.log(JSON.stringify(comparison,null,2));
      if(comparison.status==='FAIL')process.exitCode=1;
      if(comparison.status==='UNVERIFIED')process.exitCode=2;
    }catch(error){
      console.error('Unable to compare sanitized reports:',String(error?.message||error));
      process.exitCode=2;
    }
  }
}
