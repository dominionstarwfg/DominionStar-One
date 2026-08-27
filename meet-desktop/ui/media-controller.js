(()=>{
  if(window.DominionMediaController)return;
  const desktopMedia=window.dominionDesktop?.media||null;
  const KEYS=Object.freeze({camera:'ds_meet_camera_id',microphone:'ds_meet_microphone_id',speaker:'ds_meet_speaker_id',mirror:'ds_meet_mirror'});
  const readPref=(key,fallback='')=>{try{const value=localStorage.getItem(KEYS[key]);return value===null?fallback:value;}catch{return fallback;}};
  const savePref=(key,value)=>{try{localStorage.setItem(KEYS[key],String(value??''));}catch{}};
  const state={stream:null,cameraId:readPref('camera'),microphoneId:readPref('microphone'),speakerId:readPref('speaker'),cameraOn:true,micOn:false,mirror:readPref('mirror','true')!=='false',userPreferencesLocked:false,lastError:'',permissionState:null};
  const listeners=new Set();
  const emit=()=>{const snapshot=api.snapshot();for(const fn of listeners){try{fn(snapshot);}catch{}}};
  const stopTrack=track=>{if(track&&track.readyState!=='ended'){try{track.stop();}catch{}}};
  const stopTracks=tracks=>tracks.forEach(stopTrack);
  const live=kind=>state.stream?.getTracks?.().filter(track=>track.kind===kind&&track.readyState==='live')||[];
  const unique=values=>[...new Set(values.filter(Boolean).map(String))];
  const mediaError=error=>String(error?.message||error||'Media device unavailable.').replace(/^.*?:\s*/,'');

  async function ensurePermissions(kinds){
    if(!desktopMedia?.permissions)return null;
    let status=await desktopMedia.permissions().catch(()=>null);
    const requested=(kinds||[]).filter(kind=>String(status?.[kind]||'').toLowerCase()==='not-determined');
    if(requested.length&&desktopMedia?.request)status=await desktopMedia.request(requested).catch(()=>status);
    state.permissionState=status;
    const blocked=(kinds||[]).filter(kind=>['denied','restricted'].includes(String(status?.[kind]||'').toLowerCase()));
    if(blocked.length){
      const names=blocked.map(kind=>kind==='camera'?'Camera':'Microphone').join(' and ');
      const error=new Error(`DominionStar Meet needs macOS ${names} permission. Open System Settings > Privacy & Security, allow DominionStar Meet, then reopen the app.`);
      error.name='NotAllowedError';
      throw error;
    }
    return status;
  }

  async function enumerate(){
    if(!navigator.mediaDevices?.enumerateDevices)return {cameras:[],microphones:[],speakers:[]};
    const devices=await navigator.mediaDevices.enumerateDevices();
    const label=(device,index,prefix)=>String(device.label||'').trim()||`${prefix} ${index+1}`;
    const cameras=devices.filter(d=>d.kind==='videoinput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Camera')}));
    const microphones=devices.filter(d=>d.kind==='audioinput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Microphone')}));
    const speakers=devices.filter(d=>d.kind==='audiooutput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Speaker')}));
    return {cameras,microphones,speakers};
  }

  const videoConstraints=id=>({deviceId:id?{ideal:id}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}});
  const audioConstraints=id=>({deviceId:id?{ideal:id}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true});

  async function acquireKind(kind,preferredId=''){
    const devices=await enumerate();
    const catalog=kind==='video'?devices.cameras:devices.microphones;
    const candidates=unique([preferredId,...catalog.map(item=>item.id)]);
    if(!candidates.length)candidates.push('');
    let lastError=null;
    for(const id of candidates){
      try{
        const constraints=kind==='video'?{video:videoConstraints(id),audio:false}:{video:false,audio:audioConstraints(id)};
        const stream=await navigator.mediaDevices.getUserMedia(constraints);
        const track=kind==='video'?stream.getVideoTracks()[0]:stream.getAudioTracks()[0];
        if(!track){stopTracks(stream.getTracks());continue;}
        const actualId=String(track.getSettings?.().deviceId||id||'');
        if(kind==='video'){state.cameraId=actualId;savePref('camera',actualId);}else{state.microphoneId=actualId;savePref('microphone',actualId);}
        return track;
      }catch(error){lastError=error;}
    }
    const label=kind==='video'?'video source':'audio source';
    throw new Error(lastError?.message||`Could not start ${label}`);
  }

  async function rebuild(){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera and microphone are unavailable on this device.');
    const kinds=[];if(state.cameraOn)kinds.push('camera');if(state.micOn)kinds.push('microphone');
    await ensurePermissions(kinds);
    const old=state.stream;
    const next=new MediaStream();
    try{
      if(state.cameraOn)next.addTrack(await acquireKind('video',state.cameraId));
      if(state.micOn)next.addTrack(await acquireKind('audio',state.microphoneId));
    }catch(error){
      stopTracks(next.getTracks());
      state.lastError=mediaError(error);
      throw error;
    }
    state.stream=next;state.lastError='';
    stopTracks(old?.getTracks?.()||[]);
    emit();
    return next;
  }

  const api=Object.freeze({
    async startPreview(options={}){
      if(!state.userPreferencesLocked){state.cameraOn=options.cameraOn!==false;state.micOn=Boolean(options.micOn);}
      if(options.cameraId)state.cameraId=String(options.cameraId);
      if(options.microphoneId)state.microphoneId=String(options.microphoneId);
      await rebuild();return {stream:state.stream,devices:await enumerate(),state:api.snapshot()};
    },
    async setCamera(on){
      const enabled=Boolean(on);state.userPreferencesLocked=true;if(state.cameraOn===enabled)return api.snapshot();
      if(!enabled){state.cameraOn=false;stopTracks(live('video'));for(const track of state.stream?.getVideoTracks?.()||[]){try{state.stream.removeTrack(track);}catch{}}emit();return api.snapshot();}
      state.cameraOn=true;try{await rebuild();}catch(error){state.cameraOn=false;emit();throw error;}return api.snapshot();
    },
    async setMicrophone(on){
      const enabled=Boolean(on);state.userPreferencesLocked=true;if(state.micOn===enabled)return api.snapshot();
      if(!enabled){state.micOn=false;for(const track of state.stream?.getAudioTracks?.()||[])track.enabled=false;emit();return api.snapshot();}
      state.micOn=true;if(live('audio').length){live('audio').forEach(track=>track.enabled=true);emit();return api.snapshot();}
      try{await rebuild();}catch(error){state.micOn=false;emit();throw error;}return api.snapshot();
    },
    async selectCamera(id){const previous=state.cameraId;state.userPreferencesLocked=true;state.cameraId=String(id||'');savePref('camera',state.cameraId);if(state.cameraOn){try{await rebuild();}catch(error){state.cameraId=previous;savePref('camera',previous);throw error;}}emit();return api.snapshot();},
    async selectMicrophone(id){const previous=state.microphoneId;state.userPreferencesLocked=true;state.microphoneId=String(id||'');savePref('microphone',state.microphoneId);if(state.micOn){try{await rebuild();}catch(error){state.microphoneId=previous;savePref('microphone',previous);throw error;}}emit();return api.snapshot();},
    async selectSpeaker(id,element){state.userPreferencesLocked=true;state.speakerId=String(id||'');savePref('speaker',state.speakerId);if(element?.setSinkId&&state.speakerId)await element.setSinkId(state.speakerId);emit();return api.snapshot();},
    setMirror(on){state.userPreferencesLocked=true;state.mirror=Boolean(on);savePref('mirror',state.mirror);emit();return api.snapshot();},
    stop(){stopTracks(state.stream?.getTracks?.()||[]);state.stream=null;emit();},
    resetPreferences(){state.userPreferencesLocked=false;state.cameraId='';state.microphoneId='';state.speakerId='';state.cameraOn=true;state.micOn=false;state.mirror=true;for(const key of Object.keys(KEYS))savePref(key,key==='mirror'?'true':'');emit();},
    stream(){return state.stream;},
    enumerate,
    permissions:()=>desktopMedia?.permissions?.()||Promise.resolve(null),
    openPrivacy:kind=>desktopMedia?.openPrivacy?.(kind),
    snapshot(){return {cameraOn:state.cameraOn,micOn:state.micOn,mirror:state.mirror,cameraId:state.cameraId,microphoneId:state.microphoneId,speakerId:state.speakerId,preferencesLocked:state.userPreferencesLocked,videoLive:live('video').length>0,audioLive:live('audio').length>0,lastError:state.lastError,permissionState:state.permissionState};},
    onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
  window.DominionMediaController=api;
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>emit());
  if(!document.querySelector('script[data-ds-share-integration]')){const script=document.createElement('script');script.src='./share-integration.js';script.dataset.dsShareIntegration='1';document.head.append(script);}
  if(!document.querySelector('link[data-ds-webrtc-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./webrtc.css';link.dataset.dsWebrtcStyle='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-webrtc-controller]')){const script=document.createElement('script');script.src='./webrtc-controller.js';script.dataset.dsWebrtcController='1';document.head.append(script);}
  if(!document.querySelector('link[data-ds-diagnostics-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./diagnostics.css';link.dataset.dsDiagnosticsStyle='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-diagnostics]')){const script=document.createElement('script');script.src='./diagnostics.js';script.dataset.dsDiagnostics='1';document.head.append(script);}
})();
