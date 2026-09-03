(()=>{
  if(window.DominionMediaController)return;
  const desktopMedia=window.dominionDesktop?.media||null;
  const KEYS=Object.freeze({camera:'ds_meet_camera_id',microphone:'ds_meet_microphone_id',speaker:'ds_meet_speaker_id',mirror:'ds_meet_mirror',echoCancellation:'ds_meet_echo_cancellation',noiseSuppression:'ds_meet_noise_suppression',autoGainControl:'ds_meet_auto_gain_control',originalSound:'ds_meet_original_sound'});
  const readPref=(key,fallback='')=>{try{const value=localStorage.getItem(KEYS[key]);return value===null?fallback:value;}catch{return fallback;}};
  const savePref=(key,value)=>{try{localStorage.setItem(KEYS[key],String(value??''));}catch{}};
  const state={stream:null,cameraId:readPref('camera'),microphoneId:readPref('microphone'),speakerId:readPref('speaker'),cameraOn:true,cameraPending:false,micOn:false,mirror:readPref('mirror','true')!=='false',echoCancellation:readPref('echoCancellation','true')!=='false',noiseSuppression:readPref('noiseSuppression','true')!=='false',autoGainControl:readPref('autoGainControl','true')!=='false',originalSound:readPref('originalSound','false')==='true',userPreferencesLocked:false,lastError:'',permissionState:null};
  let cameraIntent=0,warmVideoTrack=null,warmVideoTimer=0;
  const releaseWarmVideo=()=>{if(warmVideoTimer){clearTimeout(warmVideoTimer);warmVideoTimer=0;}if(warmVideoTrack){stopTrack(warmVideoTrack);warmVideoTrack=null;}};
  const holdWarmVideo=track=>{releaseWarmVideo();if(!track||track.readyState!=='live')return;try{track.enabled=false;}catch{}warmVideoTrack=track;warmVideoTimer=setTimeout(releaseWarmVideo,1800);};
  const listeners=new Set();
  const emit=()=>{const snapshot=api.snapshot();for(const fn of listeners){try{fn(snapshot);}catch{}}};
  const stopTrack=track=>{if(track&&track.readyState!=='ended'){try{track.stop();}catch{}}};
  const stopTracks=tracks=>tracks.forEach(stopTrack);
  const live=kind=>state.stream?.getTracks?.().filter(track=>track.kind===kind&&track.readyState==='live')||[];
  const unique=values=>[...new Set(values.filter(Boolean).map(String))];
  const mediaError=error=>String(error?.message||error||'Media device unavailable.').replace(/^.*?:\s*/,'');
  const ensureStream=()=>{if(!(state.stream instanceof MediaStream))state.stream=new MediaStream();return state.stream;};

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
    return {
      cameras:devices.filter(d=>d.kind==='videoinput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Camera')})),
      microphones:devices.filter(d=>d.kind==='audioinput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Microphone')})),
      speakers:devices.filter(d=>d.kind==='audiooutput').map((d,i)=>({id:d.deviceId,label:label(d,i,'Speaker')}))
    };
  }

  const videoConstraints=id=>({deviceId:id?{ideal:id}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}});
  const audioConstraints=id=>({deviceId:id?{ideal:id}:undefined,echoCancellation:state.originalSound?false:state.echoCancellation,noiseSuppression:state.originalSound?false:state.noiseSuppression,autoGainControl:state.originalSound?false:state.autoGainControl,channelCount:state.originalSound?{ideal:2}:undefined,sampleRate:state.originalSound?{ideal:48000}:undefined});

  async function acquireKind(kind,preferredId=''){
    await ensurePermissions([kind==='video'?'camera':'microphone']);
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
    throw new Error(lastError?.message||`Could not start ${kind==='video'?'video source':'audio source'}`);
  }

  function removeKind(kind){
    const stream=ensureStream();
    for(const track of [...stream.getTracks()].filter(track=>track.kind===kind)){
      try{stream.removeTrack(track);}catch{}
      stopTrack(track);
    }
  }

  async function replaceKind(kind,preferredId='',force=false){
    const current=live(kind)[0];
    const currentId=String(current?.getSettings?.().deviceId||'');
    if(!force&&current&&preferredId&&currentId===String(preferredId))return current;
    const fresh=await acquireKind(kind,preferredId);
    removeKind(kind);
    ensureStream().addTrack(fresh);
    state.lastError='';emit();return fresh;
  }

  async function startPreview(options={}){
    cameraIntent+=1;releaseWarmVideo();state.cameraPending=false;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera and microphone are unavailable on this device.');
    if(!state.userPreferencesLocked){state.cameraOn=options.cameraOn!==false;state.micOn=Boolean(options.micOn);}
    if(options.cameraId)state.cameraId=String(options.cameraId);
    if(options.microphoneId)state.microphoneId=String(options.microphoneId);
    stopTracks(state.stream?.getTracks?.()||[]);state.stream=new MediaStream();
    const failures=[];
    if(state.cameraOn){try{await replaceKind('video',state.cameraId);}catch(error){state.cameraOn=false;failures.push(mediaError(error));}}
    if(state.micOn){try{await replaceKind('audio',state.microphoneId);}catch(error){state.micOn=false;failures.push(mediaError(error));}}
    state.lastError=failures.join(' • ');emit();
    const result={stream:state.stream,devices:await enumerate(),state:api.snapshot(),warning:state.lastError};
    if(failures.length&&state.stream.getTracks().length===0)throw Object.assign(new Error(state.lastError),{mediaResult:result});
    return result;
  }

  const api=Object.freeze({
    startPreview,
    async setCamera(on){
      const enabled=Boolean(on);state.userPreferencesLocked=true;const intent=++cameraIntent;
      if(!enabled){
        state.cameraOn=false;state.cameraPending=false;state.lastError='';
        const stream=ensureStream(),current=live('video')[0]||null;
        if(current){try{stream.removeTrack(current);}catch{}holdWarmVideo(current);}else releaseWarmVideo();
        emit();return api.snapshot();
      }
      if(state.cameraOn&&live('video').length){state.cameraPending=false;return api.snapshot();}
      state.cameraOn=true;state.cameraPending=true;state.lastError='';emit();
      if(warmVideoTrack&&warmVideoTrack.readyState==='live'){
        const track=warmVideoTrack;warmVideoTrack=null;if(warmVideoTimer){clearTimeout(warmVideoTimer);warmVideoTimer=0;}
        if(intent!==cameraIntent||!state.cameraOn){holdWarmVideo(track);return api.snapshot();}
        try{track.enabled=true;}catch{}ensureStream().addTrack(track);state.cameraPending=false;emit();return api.snapshot();
      }
      let fresh=null;
      try{
        fresh=await acquireKind('video',state.cameraId);
        if(intent!==cameraIntent||!state.cameraOn){stopTrack(fresh);return api.snapshot();}
        removeKind('video');try{fresh.enabled=true;}catch{}ensureStream().addTrack(fresh);state.cameraPending=false;state.lastError='';emit();return api.snapshot();
      }catch(error){
        if(intent!==cameraIntent||!state.cameraOn){if(fresh)stopTrack(fresh);return api.snapshot();}
        state.cameraOn=false;state.cameraPending=false;state.lastError=mediaError(error);emit();throw error;
      }
    },
    async setMicrophone(on){
      const enabled=Boolean(on);state.userPreferencesLocked=true;
      if(!enabled){state.micOn=false;for(const track of live('audio'))track.enabled=false;emit();return api.snapshot();}
      state.micOn=true;if(live('audio').length){live('audio').forEach(track=>track.enabled=true);emit();return api.snapshot();}
      try{await replaceKind('audio',state.microphoneId);}catch(error){state.micOn=false;state.lastError=mediaError(error);emit();throw error;}return api.snapshot();
    },
    async selectCamera(id){
      const wanted=String(id||''),previous=state.cameraId;state.userPreferencesLocked=true;cameraIntent+=1;releaseWarmVideo();state.cameraPending=false;if(wanted===previous&&live('video').length)return api.snapshot();
      state.cameraId=wanted;savePref('camera',wanted);if(state.cameraOn){try{await replaceKind('video',wanted);}catch(error){state.cameraId=previous;savePref('camera',previous);throw error;}}emit();return api.snapshot();
    },
    async selectMicrophone(id){
      const wanted=String(id||''),previous=state.microphoneId;state.userPreferencesLocked=true;if(wanted===previous&&live('audio').length)return api.snapshot();
      state.microphoneId=wanted;savePref('microphone',wanted);if(state.micOn){try{await replaceKind('audio',wanted);}catch(error){state.microphoneId=previous;savePref('microphone',previous);throw error;}}emit();return api.snapshot();
    },
    async selectSpeaker(id,element){state.userPreferencesLocked=true;state.speakerId=String(id||'');savePref('speaker',state.speakerId);if(element?.setSinkId&&state.speakerId)await element.setSinkId(state.speakerId);emit();return api.snapshot();},
    setMirror(on){state.userPreferencesLocked=true;state.mirror=Boolean(on);savePref('mirror',state.mirror);emit();return api.snapshot();},
    async setAudioProcessing(next={}){
      const previous={echoCancellation:state.echoCancellation,noiseSuppression:state.noiseSuppression,autoGainControl:state.autoGainControl,originalSound:state.originalSound};
      if('echoCancellation' in next)state.echoCancellation=Boolean(next.echoCancellation);
      if('noiseSuppression' in next)state.noiseSuppression=Boolean(next.noiseSuppression);
      if('autoGainControl' in next)state.autoGainControl=Boolean(next.autoGainControl);
      if('originalSound' in next)state.originalSound=Boolean(next.originalSound);
      savePref('echoCancellation',state.echoCancellation);savePref('noiseSuppression',state.noiseSuppression);savePref('autoGainControl',state.autoGainControl);savePref('originalSound',state.originalSound);
      if(state.micOn&&live('audio').length){try{await replaceKind('audio',state.microphoneId,true);}catch(error){Object.assign(state,previous);throw error;}}
      emit();return api.snapshot();
    },
    async recoverAfterResume(){
      const desired={cameraOn:state.cameraOn,micOn:state.micOn,cameraId:state.cameraId,microphoneId:state.microphoneId,speakerId:state.speakerId};
      const videoAlive=live('video').length>0,audioAlive=live('audio').length>0;
      if(desired.cameraOn&&!videoAlive){try{await replaceKind('video',desired.cameraId,true);}catch{}}
      if(desired.micOn&&!audioAlive){try{await replaceKind('audio',desired.microphoneId,true);}catch{}}
      if(!desired.cameraOn)for(const track of live('video'))track.enabled=false;
      if(!desired.micOn)for(const track of live('audio'))track.enabled=false;
      emit();return api.snapshot();
    },
    async testMicrophoneStream(){
      const existing=live('audio')[0];if(existing){const clone=existing.clone();clone.enabled=true;return new MediaStream([clone]);}
      await ensurePermissions(['microphone']);
      const track=await acquireKind('audio',state.microphoneId);track.enabled=true;return new MediaStream([track]);
    },
    async testCameraStream(cameraId=state.cameraId){
      const existing=live('video')[0],wanted=String(cameraId||state.cameraId||''),existingId=String(existing?.getSettings?.().deviceId||'');
      if(existing&&(!wanted||wanted===existingId)){const clone=existing.clone();clone.enabled=true;return new MediaStream([clone]);}
      await ensurePermissions(['camera']);
      const track=await acquireKind('video',wanted);track.enabled=true;return new MediaStream([track]);
    },
    stop(){cameraIntent+=1;releaseWarmVideo();state.cameraPending=false;stopTracks(state.stream?.getTracks?.()||[]);state.stream=null;emit();},
    resetPreferences(){cameraIntent+=1;releaseWarmVideo();state.cameraPending=false;state.userPreferencesLocked=false;state.cameraId='';state.microphoneId='';state.speakerId='';state.cameraOn=true;state.micOn=false;state.mirror=true;state.echoCancellation=true;state.noiseSuppression=true;state.autoGainControl=true;state.originalSound=false;for(const key of Object.keys(KEYS)){const v=key==='mirror'||['echoCancellation','noiseSuppression','autoGainControl'].includes(key)?'true':key==='originalSound'?'false':'';savePref(key,v);}emit();},
    stream(){return state.stream;},
    enumerate,
    permissions:()=>desktopMedia?.permissions?.()||Promise.resolve(null),
    openPrivacy:kind=>desktopMedia?.openPrivacy?.(kind),
    snapshot(){return {cameraOn:state.cameraOn,cameraPending:state.cameraPending,micOn:state.micOn,mirror:state.mirror,cameraId:state.cameraId,microphoneId:state.microphoneId,speakerId:state.speakerId,echoCancellation:state.echoCancellation,noiseSuppression:state.noiseSuppression,autoGainControl:state.autoGainControl,originalSound:state.originalSound,preferencesLocked:state.userPreferencesLocked,videoLive:live('video').length>0,audioLive:live('audio').length>0,lastError:state.lastError,permissionState:state.permissionState};},
    onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
  window.DominionMediaController=api;

  // Zoom-style local voice activity: measure real microphone energy and expose
  // it to the meeting/presenter controls without changing mute authority.
  let voiceContext=null,voiceSource=null,voiceAnalyser=null,voiceTimer=0,voiceTrackId='';
  const stopVoiceMeter=()=>{if(voiceTimer){clearInterval(voiceTimer);voiceTimer=0;}try{voiceSource?.disconnect?.();}catch{}try{voiceContext?.close?.();}catch{}voiceContext=null;voiceSource=null;voiceAnalyser=null;voiceTrackId='';document.documentElement.style.setProperty('--ds-local-voice-level','0');document.body.classList.remove('ds-local-speaking');};
  const startVoiceMeter=()=>{
    const track=live('audio')[0];
    if(!state.micOn||!track||track.enabled===false){stopVoiceMeter();return;}
    if(voiceAnalyser&&voiceTrackId===String(track.id||''))return;
    stopVoiceMeter();
    try{
      voiceContext=new AudioContext();voiceSource=voiceContext.createMediaStreamSource(new MediaStream([track]));voiceAnalyser=voiceContext.createAnalyser();voiceAnalyser.fftSize=256;voiceAnalyser.smoothingTimeConstant=.72;voiceSource.connect(voiceAnalyser);voiceTrackId=String(track.id||'');
      const data=new Uint8Array(voiceAnalyser.fftSize);
      voiceTimer=setInterval(()=>{
        if(!state.micOn||track.readyState!=='live'||track.enabled===false){document.documentElement.style.setProperty('--ds-local-voice-level','0');document.body.classList.remove('ds-local-speaking');return;}
        voiceAnalyser.getByteTimeDomainData(data);let sum=0;for(const value of data){const n=(value-128)/128;sum+=n*n;}const raw=Math.sqrt(sum/data.length);const level=Math.max(0,Math.min(1,(raw-.008)/.09));const speaking=level>.08;
        document.documentElement.style.setProperty('--ds-local-voice-level',level.toFixed(3));document.body.classList.toggle('ds-local-speaking',speaking);
        window.dispatchEvent(new CustomEvent('dominion:local-voice-level',{detail:{level,speaking}}));
      },80);
    }catch{stopVoiceMeter();}
  };
  api.onChange(()=>startVoiceMeter());startVoiceMeter();
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>emit());
  if(!document.querySelector('script[data-ds-share-integration]')){const script=document.createElement('script');script.src='./share-integration.js';script.dataset.dsShareIntegration='1';document.head.append(script);}
  if(!document.querySelector('link[data-ds-webrtc-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./webrtc.css';link.dataset.dsWebrtcStyle='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-webrtc-controller]')){const script=document.createElement('script');script.src='./webrtc-controller.js';script.dataset.dsWebrtcController='1';document.head.append(script);}
  if(!document.querySelector('link[data-ds-diagnostics-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./diagnostics.css';link.dataset.dsDiagnosticsStyle='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-diagnostics]')){const script=document.createElement('script');script.src='./diagnostics.js';script.dataset.dsDiagnostics='1';document.head.append(script);}
})();
