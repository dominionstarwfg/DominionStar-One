(()=>{
  if(window.DominionMediaController)return;
  const state={stream:null,cameraId:'',microphoneId:'',speakerId:'',cameraOn:true,micOn:false,mirror:true,userPreferencesLocked:false};
  const listeners=new Set();
  const emit=()=>{const snapshot=api.snapshot();for(const fn of listeners){try{fn(snapshot);}catch{}}};
  const stopTrack=track=>{if(track&&track.readyState!=='ended'){try{track.stop();}catch{}}};
  const stopTracks=tracks=>tracks.forEach(stopTrack);
  const live=kind=>state.stream?.getTracks?.().filter(track=>track.kind===kind&&track.readyState==='live')||[];
  const constraints=()=>({
    audio:state.micOn?{deviceId:state.microphoneId?{exact:state.microphoneId}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true}:false,
    video:state.cameraOn?{deviceId:state.cameraId?{exact:state.cameraId}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}:false
  });

  async function rebuild(){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera and microphone are unavailable on this device.');
    const old=state.stream;
    let next=new MediaStream();
    const wants=constraints();
    if(wants.audio||wants.video){next=await navigator.mediaDevices.getUserMedia(wants);}
    state.stream=next;
    stopTracks(old?.getTracks?.()||[]);
    emit();
    return next;
  }

  async function enumerate(){
    if(!navigator.mediaDevices?.enumerateDevices)return {cameras:[],microphones:[],speakers:[]};
    const devices=await navigator.mediaDevices.enumerateDevices();
    const label=(device,index,prefix)=>device.label||`${prefix} ${index+1}`;
    const cameras=devices.filter(d=>d.kind==='videoinput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Camera')}));
    const microphones=devices.filter(d=>d.kind==='audioinput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Microphone')}));
    const speakers=devices.filter(d=>d.kind==='audiooutput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Speaker')}));
    return {cameras,microphones,speakers};
  }

  const api=Object.freeze({
    async startPreview(options={}){
      if(!state.userPreferencesLocked){state.cameraOn=options.cameraOn!==false;state.micOn=Boolean(options.micOn);}
      if(options.cameraId&&!state.cameraId)state.cameraId=String(options.cameraId);
      if(options.microphoneId&&!state.microphoneId)state.microphoneId=String(options.microphoneId);
      await rebuild();return {stream:state.stream,devices:await enumerate(),state:api.snapshot()};
    },
    async setCamera(on){const enabled=Boolean(on);state.userPreferencesLocked=true;if(state.cameraOn===enabled)return api.snapshot();state.cameraOn=enabled;if(!enabled){stopTracks(live('video'));for(const track of state.stream?.getVideoTracks?.()||[]){try{state.stream.removeTrack(track);}catch{}}emit();return api.snapshot();}await rebuild();return api.snapshot();},
    async setMicrophone(on){const enabled=Boolean(on);state.userPreferencesLocked=true;if(state.micOn===enabled)return api.snapshot();state.micOn=enabled;if(!enabled){for(const track of state.stream?.getAudioTracks?.()||[])track.enabled=false;emit();return api.snapshot();}if(live('audio').length){live('audio').forEach(track=>track.enabled=true);emit();return api.snapshot();}await rebuild();return api.snapshot();},
    async selectCamera(id){state.userPreferencesLocked=true;state.cameraId=String(id||'');if(state.cameraOn)await rebuild();return api.snapshot();},
    async selectMicrophone(id){state.userPreferencesLocked=true;state.microphoneId=String(id||'');if(state.micOn)await rebuild();return api.snapshot();},
    async selectSpeaker(id,element){state.userPreferencesLocked=true;state.speakerId=String(id||'');if(element?.setSinkId&&state.speakerId)await element.setSinkId(state.speakerId);emit();return api.snapshot();},
    setMirror(on){state.userPreferencesLocked=true;state.mirror=Boolean(on);emit();return api.snapshot();},
    stop(){stopTracks(state.stream?.getTracks?.()||[]);state.stream=null;emit();},
    resetPreferences(){state.userPreferencesLocked=false;state.cameraId='';state.microphoneId='';state.speakerId='';state.cameraOn=true;state.micOn=false;state.mirror=true;emit();},
    stream(){return state.stream;},
    enumerate,
    snapshot(){return {cameraOn:state.cameraOn,micOn:state.micOn,mirror:state.mirror,cameraId:state.cameraId,microphoneId:state.microphoneId,speakerId:state.speakerId,preferencesLocked:state.userPreferencesLocked,videoLive:live('video').length>0,audioLive:live('audio').length>0};},
    onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
  window.DominionMediaController=api;
  if(!document.querySelector('script[data-ds-share-integration]')){const script=document.createElement('script');script.src='./share-integration.js';script.dataset.dsShareIntegration='1';document.head.append(script);}
  if(!document.querySelector('link[data-ds-webrtc-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./webrtc.css';link.dataset.dsWebrtcStyle='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-webrtc-controller]')){const script=document.createElement('script');script.src='./webrtc-controller.js';script.dataset.dsWebrtcController='1';document.head.append(script);}
})();
