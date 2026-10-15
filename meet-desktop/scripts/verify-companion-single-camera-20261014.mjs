import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const transport=read('ui/mac-companion-rtc.js');
const companion=read('ui/mac-share-video.js');
const integration=read('ui/share-integration.js');
const html=read('ui/mac-share-video.html');
const mainPreload=read('src/preload.cjs');
const companionPreload=read('src/presenter-preload.cjs');
const mainProcess=read('src/mac-share-presenter-overlay.mjs');
const webrtc=read('ui/webrtc-controller.js');

assert.ok(!companion.includes('navigator.mediaDevices.getUserMedia('),'native presenter cannot request an additional camera');
assert.ok(integration.includes('media.stream?.()'),'presenter must reuse the meeting camera');
assert.ok(integration.includes('window.DominionWebRTCController?.companionTracks?.()'),'remote camera transport must reuse canonical receiver tracks');
assert.ok(!integration.includes("toDataURL('image/jpeg'"),'main renderer must not JPEG-encode companion camera frames');
assert.ok(!mainProcess.includes("ipcMain.on('mac-share:video-frame'"),'native transport must not relay JPEG base64 frames');
assert.ok(!companion.includes('applyRemoteFrame('),'floating video window must not consume snapshot images');
assert.ok(html.indexOf('mac-companion-rtc.js')<html.indexOf('mac-share-video.js'),'transport module must load before native video consumer');
assert.ok(mainPreload.includes('onVideoSignal:')&&companionPreload.includes('onVideoSignal:'),'both Electron renderers require signaling listeners');
assert.ok(mainProcess.includes("ipcMain.on('mac-share:video-signal'"),'native signaling relay must exist');
assert.ok(companion.includes('video class="remote-live-video" autoplay muted playsinline'),'video panel must preserve continuous muted video element');
assert.ok(transport.includes('earlyIce=new Map()'),'ICE candidates received before SDP offer must be queued');
assert.ok(webrtc.includes('function companionTracks()'),'main WebRTC controller must expose existing receiver tracks');

async function testLocalVideo(){
  const tracksBySdp=new Map();
  let sdpSeq=0,created=0,destroyed=0,candidatesApplied=0;
  class FakeMediaStream {
    constructor(tracks){this.tracks=tracks;}
    getVideoTracks(){return this.tracks.filter(track=>track.kind==='video');}
  }
  class FakeRTCPeerConnection {
    constructor(config){created++;assert.deepEqual(config.iceServers,[]);this.signalingState='stable';this.connectionState='new';}
    addTransceiver(track){this.track=track;this.transceiver={sender:{track,replaceTrack:async next=>{this.track=next;this.transceiver.sender.track=next;}}};return this.transceiver;}
    async createOffer(){return {type:'offer',sdp:'local-'+(++sdpSeq)};}
    async setLocalDescription(description){
      this.localDescription=description;
      if(description.type==='offer'){this.signalingState='have-local-offer';tracksBySdp.set(description.sdp,this.track);}
      else this.signalingState='stable';
    }
    async setRemoteDescription(description){
      this.remoteDescription=description;
      if(description.type==='offer'){
        this.signalingState='have-remote-offer';
        const track=tracksBySdp.get(description.sdp);
        if(track)this.ontrack?.({track,streams:[new FakeMediaStream([track])]});
      }else this.signalingState='stable';
    }
    async createAnswer(){return {type:'answer',sdp:'local-answer'};}
    async addIceCandidate(){candidatesApplied++;}
    close(){destroyed++;this.connectionState='closed';}
  }
  const createContext=()=>{
    const win={};
    new Function('window','RTCPeerConnection','MediaStream',transport)(win,FakeRTCPeerConnection,FakeMediaStream);
    return win.DominionCompanionRTC;
  };
  const one=createContext(),two=createContext();
  const fromSender=new Set(),fromReceiver=new Set(),trace=[];
  const senderBridge={
    onVideoSignal:cb=>{fromSender.add(cb);return ()=>fromSender.delete(cb);},
    videoSignal:payload=>{trace.push(['sender',payload.type]);Promise.resolve().then(()=>{for(const cb of fromReceiver)cb(payload);});}
  };
  const receiverBridge={
    onVideoSignal:cb=>{fromReceiver.add(cb);return ()=>fromReceiver.delete(cb);},
    videoSignal:payload=>{trace.push(['receiver',payload.type]);Promise.resolve().then(()=>{for(const cb of fromSender)cb(payload);});}
  };
  const first={kind:'video',readyState:'live',enabled:true},second={kind:'video',readyState:'live',enabled:true};
  const received=[],removed=[],errors=[];
  let sender;
  sender=one.createSender(senderBridge,{onReady:()=>{void sender.sync([{id:'self',track:first}]);},onError:err=>errors.push(String(err))});
  const receiver=two.createReceiver(receiverBridge,{
    onTrack:(id,stream,track)=>received.push({id,track,stream}),
    onClose:id=>removed.push(id),onError:err=>errors.push(String(err))
  });
  const drain=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
  await drain();
  assert.equal(received.length,1,'receiver must receive first camera track');
  assert.equal(received[0].track,first,'no second camera may be acquired');
  assert.equal(received[0].stream.getVideoTracks()[0],first);
  assert.equal(errors.length,0);
  const initialPeers=created;
  await sender.sync([{id:'self',track:first}]);
  assert.equal(created,initialPeers,'unchanged track must not remount peer');
  sender.clear();await drain();
  assert.ok(removed.includes('self'),'share reset must release received camera track');
  senderBridge.videoSignal({type:'ice',participantId:'self',candidate:{candidate:'early-local-ice'}});
  await drain();
  await sender.sync([{id:'self',track:second}]);await drain();
  assert.equal(received.length,2,'second session should rebind new camera track');
  assert.equal(received[1].track,second);
  assert.ok(candidatesApplied>=1,'early ICE must be retained and applied after offer');
  sender.stop();receiver.stop();
  assert.equal(created,destroyed,'all local WebRTC connections must be closed at teardown');
  assert.equal(fromSender.size,0);
  assert.equal(fromReceiver.size,0);
  assert.equal(errors.length,0);
  return trace;
}
const trace=await testLocalVideo();
console.log('PASS continuous native companion WebRTC mock — live tracks, SDP/ICE, reset, recovery, and cleanup (NOT real Mac acceptance)');
