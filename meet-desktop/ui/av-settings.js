(()=>{
  if(window.DominionAVSettings)return;
  const $=selector=>document.querySelector(selector);
  const STORAGE=Object.freeze({quality:'ds_meet_video_quality',lowLight:'ds_meet_adjust_low_light',lowLightMode:'ds_meet_low_light_mode',lowLightLevel:'ds_meet_low_light_level',originalRatio:'ds_meet_original_ratio',touchUp:'ds_meet_touch_up',touchUpLevel:'ds_meet_touch_up_level',portraitLight:'ds_meet_portrait_light',portraitLevel:'ds_meet_portrait_level'});
  const read=(key,fallback='')=>{try{const value=localStorage.getItem(STORAGE[key]);return value===null?fallback:value;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(STORAGE[key],String(value));}catch{}};
  const state={quality:read('quality','720'),lowLight:read('lowLight','0')==='1',lowLightMode:read('lowLightMode','auto'),lowLightLevel:Number(read('lowLightLevel','65'))||65,originalRatio:read('originalRatio','0')==='1',touchUp:read('touchUp','0')==='1',touchUpLevel:Number(read('touchUpLevel','25'))||25,portraitLight:read('portraitLight','0')==='1',portraitLevel:Number(read('portraitLevel','35'))||35};
  let menu=null,settingsPreviewRaw=null;

  const waitForMedia=()=>new Promise(resolve=>{let tries=0;const tick=()=>{if(window.DominionMediaController)return resolve(window.DominionMediaController);if(++tries>160)return resolve(null);setTimeout(tick,50);};tick();});
  const localVideos=()=>['prejoinVideo','localMeetingVideo','presenterCameraTile','settingsVideoPreview'].map(id=>document.getElementById(id)).filter(Boolean);
  const currentVideoTrack=media=>media?.stream?.()?.getVideoTracks?.().find(track=>track.readyState==='live')||null;
  const safeLabel=(value,fallback)=>String(value||'').trim()||fallback;
  const effects=()=>window.DominionVideoEffects||null;
  async function previewStream(media,sourceStream=null){
    const raw=sourceStream?.getVideoTracks?.().find(track=>track.readyState==='live')||currentVideoTrack(media);
    const fallback=sourceStream||media.stream();
    if(!raw)return fallback;
    const fx=effects();if(!fx?.outputStream)return fallback;
    try{return await fx.outputStream(raw)||fallback;}catch{return fallback;}
  }
  function stopSettingsPreview(){
    for(const track of settingsPreviewRaw?.getTracks?.()||[]){try{track.stop();}catch{}}
    settingsPreviewRaw=null;
    const video=$('#settingsVideoPreview');if(video)video.srcObject=null;
  }
  async function startSettingsPreview(media,video,cameraId=''){
    stopSettingsPreview();
    const status=video?.closest('.av-video-preview')?.querySelector('.av-preview-status');
    try{
      settingsPreviewRaw=await media.testCameraStream?.(cameraId||media.snapshot().cameraId);
      if(!settingsPreviewRaw?.getVideoTracks?.().length)throw new Error('Camera preview unavailable.');
      video.srcObject=await previewStream(media,settingsPreviewRaw);
      await video.play().catch(()=>{});
      video.closest('.av-video-preview')?.classList.remove('preview-unavailable');
      if(status)status.textContent='Live preview';
      return true;
    }catch(error){
      if(video)video.srcObject=null;
      video?.closest('.av-video-preview')?.classList.add('preview-unavailable');
      if(status)status.textContent=String(error?.message||'Camera preview unavailable');
      return false;
    }
  }

  function closeMenu(){menu?.remove();menu=null;}
  function option(select,item){const node=document.createElement('option');node.value=String(item.id||'');node.textContent=safeLabel(item.label,'Device');select.append(node);}
  async function fillSelects(media,root=document){
    const devices=await media.enumerate();const snapshot=media.snapshot();
    const specs=[['[data-av-camera]',devices.cameras,snapshot.cameraId],['[data-av-microphone]',devices.microphones,snapshot.microphoneId],['[data-av-speaker]',devices.speakers,snapshot.speakerId]];
    for(const [selector,items,selected] of specs){for(const select of root.querySelectorAll(selector)){select.replaceChildren();if(!items.length)option(select,{id:'',label:'Default'});else items.forEach(item=>option(select,item));if(selected&&[...select.options].some(o=>o.value===selected))select.value=selected;}}
  }

  function applyMirror(media){const mirror=Boolean(media.snapshot().mirror);for(const video of localVideos())video.style.transform=mirror?'scaleX(-1)':'none';}
  function applyOriginalRatio(){write('originalRatio',state.originalRatio?'1':'0');for(const video of localVideos())video.style.objectFit=state.originalRatio?'contain':'';}
  function applyAppearance(){
    write('touchUp',state.touchUp?'1':'0');write('touchUpLevel',state.touchUpLevel);write('portraitLight',state.portraitLight?'1':'0');write('portraitLevel',state.portraitLevel);
    const soften=state.touchUp?Math.min(.12,.02+(state.touchUpLevel/100)*.10):0;
    const portrait=state.portraitLight?Math.min(.16,(state.portraitLevel/100)*.16):0;
    for(const video of localVideos()){
      video.style.filter=`brightness(${1+portrait}) contrast(${1-soften*.35}) saturate(${1-soften*.22})`;
      video.style.setProperty('--ds-touch-up',String(soften));
    }
    effects()?.setAppearance?.({touchUp:state.touchUp,touchUpLevel:state.touchUpLevel,portraitLight:state.portraitLight,portraitLevel:state.portraitLevel});
  }
  function addRange(detail,labelText,value,min,max,onInput){
    const label=document.createElement('label');label.className='av-range-row';const head=document.createElement('span');head.textContent=labelText;const input=document.createElement('input');input.type='range';input.min=String(min);input.max=String(max);input.value=String(value);input.oninput=()=>onInput(Number(input.value));label.append(head,input);detail.append(label);return input;
  }
  async function applyQuality(media){
    write('quality',state.quality);const track=currentVideoTrack(media);if(!track?.applyConstraints)return false;
    const map={360:[640,360,24],540:[960,540,30],720:[1280,720,30]};const [width,height,fps]=map[state.quality]||map[720];
    try{await track.applyConstraints({width:{ideal:width},height:{ideal:height},frameRate:{ideal:fps,max:fps}});return true;}catch{return false;}
  }
  async function applyLowLight(media){
    write('lowLight',state.lowLight?'1':'0');write('lowLightMode',state.lowLightMode);write('lowLightLevel',state.lowLightLevel);const track=currentVideoTrack(media);if(!track?.applyConstraints)return false;
    const caps=track.getCapabilities?.()||{},advanced={};
    if(Array.isArray(caps.exposureMode)&&caps.exposureMode.includes('continuous')&&state.lowLightMode==='auto')advanced.exposureMode='continuous';
    if(caps.exposureCompensation&&Number.isFinite(caps.exposureCompensation.min)&&Number.isFinite(caps.exposureCompensation.max)){
      const min=Number(caps.exposureCompensation.min),max=Number(caps.exposureCompensation.max),step=Number(caps.exposureCompensation.step||.1),ratio=state.lowLightMode==='manual'?state.lowLightLevel/100:.72,desired=state.lowLight?min+(max-min)*ratio:Math.max(min,Math.min(max,0));advanced.exposureCompensation=Math.round(desired/step)*step;
    }else if(caps.brightness&&Number.isFinite(caps.brightness.min)&&Number.isFinite(caps.brightness.max)){
      const min=Number(caps.brightness.min),max=Number(caps.brightness.max),step=Number(caps.brightness.step||1),ratio=state.lowLightMode==='manual'?state.lowLightLevel/100:.62,desired=state.lowLight?min+(max-min)*ratio:min+(max-min)*.5;advanced.brightness=Math.round(desired/step)*step;
    }
    if(!Object.keys(advanced).length)return false;
    try{await track.applyConstraints({advanced:[advanced]});return true;}catch{return false;}
  }

  function ensureDetail(dialog){
    let detail=dialog.querySelector('#avSettingsDetail');if(detail)return detail;
    detail=document.createElement('section');detail.id='avSettingsDetail';detail.className='av-settings-detail';detail.hidden=true;dialog.querySelector('form')?.insertBefore(detail,dialog.querySelector('.settings-note'));return detail;
  }
  function detailHeader(detail,title,copy){detail.innerHTML='';const header=document.createElement('header');header.className='av-detail-head';const back=document.createElement('button');back.type='button';back.className='secondary-button av-back';back.textContent='‹ Back';const text=document.createElement('div');const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=copy;text.append(h,p);header.append(back,text);detail.append(header);back.onclick=()=>showSettingsList();}
  function showSettingsList(){stopSettingsPreview();const dialog=$('#settingsDialog');if(!dialog)return;dialog.classList.remove('av-video-settings-open');dialog.querySelector('.settings-list').hidden=false;dialog.querySelector('.settings-note').hidden=false;const detail=dialog.querySelector('#avSettingsDetail');if(detail)detail.hidden=true;}
  function addSelect(detail,labelText,attr){const label=document.createElement('label');label.className='av-field';const span=document.createElement('span');span.textContent=labelText;const select=document.createElement('select');select.setAttribute(attr,'1');label.append(span,select);detail.append(label);return select;}
  function addToggle(detail,labelText,checked,onChange){const label=document.createElement('label');label.className='av-toggle-row';const span=document.createElement('span');span.textContent=labelText;const input=document.createElement('input');input.type='checkbox';input.checked=Boolean(checked);input.onchange=()=>onChange(input.checked);label.append(span,input);detail.append(label);return input;}
  function addBackgroundPicker(detail,fx,video,media){
    const snap=fx.snapshot();const wrap=document.createElement('section');wrap.className='av-backgrounds';const title=document.createElement('div');title.className='av-backgrounds-head';title.innerHTML='<strong>Virtual background</strong><small>Applied to the outgoing camera feed</small>';wrap.append(title);
    const grid=document.createElement('div');grid.className='av-background-grid';
    const items=[['none','None'],['aurora','Dominion Aurora'],['studio','Studio']];
    for(const [id,label] of items){
      const b=document.createElement('button');b.type='button';b.className='av-background-card';b.dataset.background=id;b.classList.toggle('selected',snap.virtualBackground===id);b.innerHTML=`<span class="av-bg-swatch ${id}"></span><strong>${label}</strong>`;
      b.onclick=async()=>{await fx.setVirtualBackground(id);video.srcObject=await previewStream(media,settingsPreviewRaw);void video.play().catch(()=>{});wrap.querySelectorAll('.av-background-card').forEach(n=>n.classList.toggle('selected',n===b));};grid.append(b);
    }
    const upload=document.createElement('label');upload.className='av-background-card upload';upload.innerHTML='<span class="av-bg-swatch custom">+</span><strong>Custom image</strong><input type="file" accept="image/png,image/jpeg,image/webp" hidden>';
    const input=upload.querySelector('input');input.onchange=()=>{const file=input.files?.[0];if(!file)return;if(file.size>1024*1024){input.value='';const note=wrap.querySelector('.av-background-status');if(note)note.textContent='Custom background must be 1 MB or smaller.';return;}const reader=new FileReader();reader.onload=async()=>{const result=await fx.setVirtualBackground('custom',String(reader.result||''));const note=wrap.querySelector('.av-background-status');if(!result?.ok){if(note)note.textContent='Could not use that image.';return;}video.srcObject=await previewStream(media);void video.play().catch(()=>{});wrap.querySelectorAll('.av-background-card').forEach(n=>n.classList.remove('selected'));upload.classList.add('selected');if(note)note.textContent='Custom background ready.';};reader.readAsDataURL(file);};grid.append(upload);wrap.append(grid);
    const persist=addSelect(wrap,'Keep virtual background for','data-av-background-persistence');persist.append(new Option('All meetings','all'),new Option('Current meeting only','current'));persist.value=snap.backgroundPersistence||'all';persist.onchange=()=>fx.setBackgroundPersistence(persist.value);
    const status=document.createElement('p');status.className='av-background-status';status.textContent=snap.faceDetectionSupported?'Background processing is available on this desktop.':'Virtual backgrounds require on-device face detection support on this desktop.';wrap.append(status);
    if(!snap.faceDetectionSupported)grid.querySelectorAll('button,label.upload').forEach(node=>{node.classList.add('disabled');if(node.tagName==='BUTTON')node.disabled=true;const file=node.querySelector?.('input');if(file)file.disabled=true;});
    detail.append(wrap);
  }

  async function testSpeaker(media,speakerId,status){
    let context=null,oscillator=null,audio=null;
    try{
      context=new AudioContext();oscillator=context.createOscillator();const gain=context.createGain();const destination=context.createMediaStreamDestination();
      oscillator.type='sine';oscillator.frequency.value=660;gain.gain.value=.1;oscillator.connect(gain);gain.connect(destination);
      audio=document.createElement('audio');audio.autoplay=true;audio.srcObject=destination.stream;if(audio.setSinkId&&speakerId)await audio.setSinkId(speakerId);
      status.textContent='Playing test tone…';oscillator.start();await audio.play().catch(()=>{});
      setTimeout(()=>{try{oscillator.stop();context.close();}catch{}if(audio)audio.srcObject=null;status.textContent='Speaker test complete.';},900);
    }catch(error){try{oscillator?.stop();context?.close();}catch{}status.textContent=String(error?.message||'Speaker test unavailable.');}
  }
  async function testMicrophone(media,meter,status){
    let stream=null,context=null,raf=0;
    try{
      stream=await media.testMicrophoneStream();context=new AudioContext();const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=512;source.connect(analyser);
      const data=new Uint8Array(analyser.fftSize),started=performance.now();status.textContent='Speak normally — checking microphone input…';
      const tick=()=>{let sum=0;analyser.getByteTimeDomainData(data);for(const v of data){const n=(v-128)/128;sum+=n*n;}meter.value=Math.round(Math.min(1,Math.sqrt(sum/data.length)*4.5)*100);if(performance.now()-started<4000)raf=requestAnimationFrame(tick);else{status.textContent='Microphone test complete.';meter.value=0;for(const track of stream.getTracks())track.stop();context.close();}};
      tick();
    }catch(error){cancelAnimationFrame(raf);for(const track of stream?.getTracks?.()||[])track.stop();try{context?.close();}catch{}status.textContent=String(error?.message||'Microphone test unavailable.');meter.value=0;}
  }
  async function openAudioSettings(media){
    const dialog=$('#settingsDialog'),detail=ensureDetail(dialog);dialog.querySelector('.settings-list').hidden=true;dialog.querySelector('.settings-note').hidden=true;detail.hidden=false;detailHeader(detail,'Audio','Microphone, speaker, and audio-processing preferences.');
    const devices=avGroup(detail,'Devices','Choose and test the hardware DominionStar Meet uses.');
    const mic=addSelect(devices,'Microphone','data-av-microphone'),speaker=addSelect(devices,'Speaker','data-av-speaker');
    const testRow=document.createElement('div');testRow.className='av-audio-test-row';
    const micTest=document.createElement('button');micTest.type='button';micTest.className='secondary-button';micTest.textContent='Test Microphone';
    const speakerTest=document.createElement('button');speakerTest.type='button';speakerTest.className='secondary-button';speakerTest.textContent='Test Speaker';
    testRow.append(micTest,speakerTest);devices.append(testRow);
    const meter=document.createElement('progress');meter.className='av-mic-meter';meter.max=100;meter.value=0;devices.append(meter);
    const testStatus=document.createElement('p');testStatus.className='av-effects-note';testStatus.textContent='Use the tests to verify the selected devices.';devices.append(testStatus);

    const processing=avGroup(detail,'Audio processing','Controls that affect the live microphone track.');
    const snap=media.snapshot();
    const echo=addToggle(processing,'Echo cancellation',Boolean(snap.echoCancellation),value=>void media.setAudioProcessing({echoCancellation:value}));
    const suppress=addToggle(processing,'Noise suppression',Boolean(snap.noiseSuppression),value=>void media.setAudioProcessing({noiseSuppression:value}));
    const gain=addToggle(processing,'Automatically adjust microphone volume',Boolean(snap.autoGainControl),value=>void media.setAudioProcessing({autoGainControl:value}));
    const original=addToggle(processing,'Original sound for musicians',Boolean(snap.originalSound),async value=>{
      await media.setAudioProcessing({originalSound:value});
      const disabled=Boolean(value);echo.disabled=disabled;suppress.disabled=disabled;gain.disabled=disabled;
    });
    const originalOn=Boolean(snap.originalSound);echo.disabled=originalOn;suppress.disabled=originalOn;gain.disabled=originalOn;
    const note=document.createElement('p');note.className='av-effects-note';note.textContent='Original sound bypasses echo cancellation, noise suppression, and automatic gain so music and full-range audio are altered less.';processing.append(note);

    const privacy=document.createElement('button');privacy.type='button';privacy.className='secondary-button av-privacy';privacy.textContent='Open macOS Microphone Privacy';privacy.onclick=()=>media.openPrivacy?.('microphone');detail.append(privacy);
    await fillSelects(media,detail);
    mic.onchange=async()=>{await media.selectMicrophone(mic.value);};
    speaker.onchange=async()=>{await media.selectSpeaker(speaker.value,$('#localMeetingVideo'));};
    micTest.onclick=()=>void testMicrophone(media,meter,testStatus);
    speakerTest.onclick=()=>void testSpeaker(media,speaker.value,testStatus);
  }
  function avGroup(parent,title,copy=''){
    const section=document.createElement('section');section.className='av-zoom-group';
    const head=document.createElement('div');head.className='av-zoom-group-head';
    const strong=document.createElement('strong');strong.textContent=title;head.append(strong);
    if(copy){const small=document.createElement('small');small.textContent=copy;head.append(small);}
    section.append(head);parent.append(section);return section;
  }
  function avDivider(parent){const line=document.createElement('div');line.className='av-zoom-divider';parent.append(line);return line;}
  async function openVideoSettings(media){
    const dialog=$('#settingsDialog'),detail=ensureDetail(dialog);dialog.classList.add('av-video-settings-open');dialog.querySelector('.settings-list').hidden=true;dialog.querySelector('.settings-note').hidden=true;detail.hidden=false;detailHeader(detail,'Video','Preview your camera and tune the same core video behaviors users expect from Zoom.');

    const cameraGroup=avGroup(detail,'Camera','Select your camera and review the live preview.');
    const camera=addSelect(cameraGroup,'Camera','data-av-camera');
    const preview=document.createElement('div');preview.className='av-video-preview zoom-reference-preview';preview.innerHTML='<video id="settingsVideoPreview" autoplay playsinline muted></video><div class="av-preview-meta"><span>Camera preview</span><small class="av-preview-status">Starting camera…</small></div>';cameraGroup.append(preview);
    const video=preview.querySelector('video');

    const basic=avGroup(detail,'Video','Core camera behavior');
    const qualityRow=document.createElement('div');qualityRow.className='av-zoom-inline-options';basic.append(qualityRow);
    const qualityLabel=document.createElement('label');qualityLabel.className='av-field compact';qualityLabel.innerHTML='<span>Video quality</span><select data-av-quality><option value="720">HD · 720p</option><option value="540">Balanced · 540p</option><option value="360">Data saver · 360p</option></select>';qualityRow.append(qualityLabel);
    const quality=qualityLabel.querySelector('select');quality.value=state.quality;
    addToggle(basic,'Original ratio',state.originalRatio,value=>{state.originalRatio=value;applyOriginalRatio();});
    addToggle(basic,'Mirror my video',media.snapshot().mirror,value=>{media.setMirror(value);applyMirror(media);});

    const appearance=avGroup(detail,'Appearance','Match the familiar Zoom-style video controls.');
    const touch=addToggle(appearance,'Touch up my appearance',state.touchUp,value=>{state.touchUp=value;applyAppearance();});
    const touchRange=addRange(appearance,'Touch up intensity',state.touchUpLevel,0,100,value=>{state.touchUpLevel=value;applyAppearance();});touchRange.disabled=!touch.checked;touch.onchange=()=>{state.touchUp=touch.checked;touchRange.disabled=!touch.checked;applyAppearance();};
    const low=addToggle(appearance,'Adjust for low light',state.lowLight,value=>{state.lowLight=value;void applyLowLight(media);});
    const lowMode=addSelect(appearance,'Low light mode','data-av-low-light-mode');lowMode.append(new Option('Auto','auto'),new Option('Manual','manual'));lowMode.value=state.lowLightMode;lowMode.onchange=()=>{state.lowLightMode=lowMode.value;manualRange.disabled=lowMode.value!=='manual'||!low.checked;void applyLowLight(media);};
    const manualRange=addRange(appearance,'Manual low light',state.lowLightLevel,0,100,value=>{state.lowLightLevel=value;if(state.lowLight&&state.lowLightMode==='manual')void applyLowLight(media);});manualRange.disabled=state.lowLightMode!=='manual'||!state.lowLight;
    low.onchange=()=>{state.lowLight=low.checked;lowMode.disabled=!low.checked;manualRange.disabled=!low.checked||lowMode.value!=='manual';void applyLowLight(media);};lowMode.disabled=!state.lowLight;
    const portrait=addToggle(appearance,'Portrait lighting',state.portraitLight,value=>{state.portraitLight=value;applyAppearance();});
    const portraitRange=addRange(appearance,'Portrait lighting intensity',state.portraitLevel,0,100,value=>{state.portraitLevel=value;applyAppearance();});portraitRange.disabled=!portrait.checked;portrait.onchange=()=>{state.portraitLight=portrait.checked;portraitRange.disabled=!portrait.checked;applyAppearance();};

    const effectsGroup=avGroup(detail,'Background & Effects','Applied to the outgoing video participants receive.');
    const fx=effects(),fxSnap=fx?.snapshot?.()||{};
    if(fx){
      const autoFrame=addToggle(effectsGroup,'Auto framing',Boolean(fxSnap.autoFrame),async value=>{fx.setAutoFrame(Boolean(value));video.srcObject=await previewStream(media);void video.play().catch(()=>{});});
      autoFrame.disabled=!fxSnap.faceDetectionSupported;
      const strength=addRange(effectsGroup,'Auto framing strength',Number(fxSnap.strength)||55,0,100,value=>fx.setStrength(value));strength.disabled=!fxSnap.faceDetectionSupported||!fxSnap.autoFrame;
      autoFrame.onchange=async()=>{fx.setAutoFrame(autoFrame.checked);strength.disabled=!autoFrame.checked||!fx.snapshot().faceDetectionSupported;video.srcObject=await previewStream(media);void video.play().catch(()=>{});};

      const blur=addToggle(effectsGroup,'Blur my background',Boolean(fxSnap.backgroundBlur),async value=>{fx.setBackgroundBlur(Boolean(value));video.srcObject=await previewStream(media);void video.play().catch(()=>{});});
      blur.disabled=!fxSnap.faceDetectionSupported;
      const blurStrength=addRange(effectsGroup,'Background blur strength',Number(fxSnap.blurStrength)||55,0,100,value=>fx.setBlurStrength(value));blurStrength.disabled=!fxSnap.faceDetectionSupported||!fxSnap.backgroundBlur;
      blur.onchange=async()=>{fx.setBackgroundBlur(blur.checked);blurStrength.disabled=!blur.checked||!fx.snapshot().faceDetectionSupported;video.srcObject=await previewStream(media);void video.play().catch(()=>{});};

      addBackgroundPicker(effectsGroup,fx,video,media);
      if(!fxSnap.faceDetectionSupported){const note=document.createElement('p');note.className='av-effects-note';note.textContent='Auto framing and person-aware background effects require on-device face detection support on this desktop.';effectsGroup.append(note);}
    }

    const advanced=document.createElement('details');advanced.className='av-advanced-panel';const summary=document.createElement('summary');summary.textContent='Advanced';advanced.append(summary);detail.append(advanced);
    const advancedBody=document.createElement('div');advancedBody.className='av-advanced-body';advanced.append(advancedBody);
    if(fx){addToggle(advancedBody,'Optimize outgoing video with de-noise',Boolean(fxSnap.denoise),value=>fx.setDenoise(Boolean(value)));addRange(advancedBody,'Video de-noise strength',Number(fxSnap.denoiseStrength)||45,0,100,value=>fx.setDenoiseStrength(value));}
    const privacy=document.createElement('button');privacy.type='button';privacy.className='secondary-button av-privacy';privacy.textContent='Open macOS Camera Privacy';privacy.onclick=()=>media.openPrivacy?.('camera');advancedBody.append(privacy);

    await fillSelects(media,detail);
    await startSettingsPreview(media,video,camera.value);
    camera.onchange=async()=>{
      camera.disabled=true;
      try{
        await media.selectCamera(camera.value);
        await startSettingsPreview(media,video,camera.value);
        applyMirror(media);applyOriginalRatio();applyAppearance();await applyQuality(media);if(state.lowLight)await applyLowLight(media);
      } finally{camera.disabled=false;}
    };
    quality.onchange=async()=>{state.quality=quality.value;await applyQuality(media);};
    applyMirror(media);applyOriginalRatio();applyAppearance();
  }
  function installSettings(media){
    const dialog=$('#settingsDialog');if(!dialog||dialog.dataset.avInstalled)return;dialog.dataset.avInstalled='1';
    // One settings authority per category. A/V owns only Audio and Video.
    // All other categories are owned by preferences.js so no placeholder card
    // can overwrite a working settings page.
    for(const row of dialog.querySelectorAll('.settings-row')){
      const title=row.querySelector('strong')?.textContent?.trim();
      if(title==='Audio')row.onclick=()=>void openAudioSettings(media);
      else if(title==='Video')row.onclick=()=>void openVideoSettings(media);
    }
    dialog.addEventListener('close',showSettingsList);
  }

  async function openQuickMenu(media,kind,anchor){
    closeMenu();menu=document.createElement('div');menu.className='av-quick-menu';menu.dataset.kind=kind;document.body.append(menu);
    const heading=document.createElement('strong');heading.textContent=kind==='audio'?'Audio options':'Video options';menu.append(heading);
    const devices=await media.enumerate(),snapshot=media.snapshot(),items=kind==='audio'?devices.microphones:devices.cameras,current=kind==='audio'?snapshot.microphoneId:snapshot.cameraId;
    const label=document.createElement('small');label.textContent=kind==='audio'?'Microphone':'Camera';menu.append(label);
    for(const item of items){const button=document.createElement('button');button.type='button';button.className=item.id===current?'selected':'';button.textContent=safeLabel(item.label,'Device');button.onclick=async()=>{if(kind==='audio')await media.selectMicrophone(item.id);else await media.selectCamera(item.id);closeMenu();};menu.append(button);}
    if(kind==='audio'&&devices.speakers.length){const divider=document.createElement('hr');menu.append(divider);const speakerLabel=document.createElement('small');speakerLabel.textContent='Speaker';menu.append(speakerLabel);for(const item of devices.speakers){const button=document.createElement('button');button.type='button';button.className=item.id===snapshot.speakerId?'selected':'';button.textContent=safeLabel(item.label,'Speaker');button.onclick=async()=>{await media.selectSpeaker(item.id,$('#localMeetingVideo'));closeMenu();};menu.append(button);}}if(kind==='audio'){const test=document.createElement('button');test.type='button';test.textContent='Test Speaker & Microphone…';test.onclick=()=>{closeMenu();const dialog=$('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();void openAudioSettings(media);};menu.append(test);}
    if(kind==='video'){
      const divider=document.createElement('hr');menu.append(divider);
      const mirror=document.createElement('button');mirror.type='button';mirror.textContent=`${snapshot.mirror?'✓ ':''}Mirror my video`;mirror.onclick=()=>{media.setMirror(!media.snapshot().mirror);applyMirror(media);closeMenu();};menu.append(mirror);
      const original=document.createElement('button');original.type='button';original.textContent=`${state.originalRatio?'✓ ':''}Original ratio`;original.onclick=()=>{state.originalRatio=!state.originalRatio;applyOriginalRatio();closeMenu();};menu.append(original);
      const low=document.createElement('button');low.type='button';low.textContent=`${state.lowLight?'✓ ':''}Adjust for low light`;low.onclick=()=>{state.lowLight=!state.lowLight;void applyLowLight(media);closeMenu();};menu.append(low);
      const fx=effects(),fxSnap=fx?.snapshot?.()||{};
      if(fx&&fxSnap.faceDetectionSupported){
        const blur=document.createElement('button');blur.type='button';blur.textContent=`${fxSnap.backgroundBlur?'✓ ':''}Blur my background`;blur.onclick=()=>{fx.setBackgroundBlur(!fx.snapshot().backgroundBlur);closeMenu();};menu.append(blur);
        const backgrounds=document.createElement('button');backgrounds.type='button';backgrounds.textContent='Backgrounds & Effects…';backgrounds.onclick=()=>{closeMenu();const dialog=$('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();void openVideoSettings(media);};menu.append(backgrounds);
      }
      if(fx){
        const denoise=document.createElement('button');denoise.type='button';denoise.textContent=`${fxSnap.denoise?'✓ ':''}Optimize outgoing video with de-noise`;denoise.onclick=()=>{fx.setDenoise(!fx.snapshot().denoise);closeMenu();};menu.append(denoise);
      }
    }
    const divider=document.createElement('hr');menu.append(divider);const settings=document.createElement('button');settings.type='button';settings.textContent='Audio & Video Settings…';settings.onclick=()=>{closeMenu();const dialog=$('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();kind==='audio'?void openAudioSettings(media):void openVideoSettings(media);};menu.append(settings);
    const rect=anchor.getBoundingClientRect(),width=280,left=Math.min(window.innerWidth-width-12,Math.max(12,rect.left));menu.style.left=`${left}px`;menu.style.bottom=`${Math.max(74,window.innerHeight-rect.top+8)}px`;
  }

  function installMeetingQuickMenus(media){
    const mic=$('#roomMic'),camera=$('#roomCamera');if(!mic||!camera||mic.dataset.avQuickInstalled)return;mic.dataset.avQuickInstalled='1';
    for(const [button,kind] of [[mic,'audio'],[camera,'video']]){const caret=document.createElement('button');caret.type='button';caret.className='av-device-caret attached-device-caret';caret.setAttribute('aria-label',`${kind==='audio'?'Audio':'Video'} options`);caret.innerHTML='<span aria-hidden="true">⌃</span>';button.classList.add('has-device-caret');button.insertAdjacentElement('afterend',caret);caret.onclick=event=>{event.stopPropagation();void openQuickMenu(media,kind,caret);};}
  }

  waitForMedia().then(media=>{
    if(!media)return;installSettings(media);applyMirror(media);applyOriginalRatio();applyAppearance();
    media.onChange(()=>{applyMirror(media);applyOriginalRatio();applyAppearance();if(state.lowLight)void applyLowLight(media);});
    const observer=new MutationObserver(()=>installMeetingQuickMenus(media));observer.observe(document.body,{childList:true,subtree:true});installMeetingQuickMenus(media);
    document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target)&&!event.target.closest?.('.av-device-caret'))closeMenu();},true);
    window.addEventListener('resize',closeMenu);
    window.DominionAVSettings=Object.freeze({version:'1.0.0-clean-port',openAudio:()=>openAudioSettings(media),openVideo:()=>openVideoSettings(media),applyLowLight:()=>applyLowLight(media),applyQuality:()=>applyQuality(media),snapshot:()=>({...state,...media.snapshot()})});
  });
})();
