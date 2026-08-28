(()=>{
  if(window.DominionAVSettings)return;
  const $=selector=>document.querySelector(selector);
  const STORAGE=Object.freeze({quality:'ds_meet_video_quality',lowLight:'ds_meet_adjust_low_light',lowLightMode:'ds_meet_low_light_mode',lowLightLevel:'ds_meet_low_light_level',originalRatio:'ds_meet_original_ratio',touchUp:'ds_meet_touch_up',touchUpLevel:'ds_meet_touch_up_level',portraitLight:'ds_meet_portrait_light',portraitLevel:'ds_meet_portrait_level'});
  const read=(key,fallback='')=>{try{const value=localStorage.getItem(STORAGE[key]);return value===null?fallback:value;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(STORAGE[key],String(value));}catch{}};
  const state={quality:read('quality','720'),lowLight:read('lowLight','0')==='1',lowLightMode:read('lowLightMode','auto'),lowLightLevel:Number(read('lowLightLevel','65'))||65,originalRatio:read('originalRatio','0')==='1',touchUp:read('touchUp','0')==='1',touchUpLevel:Number(read('touchUpLevel','25'))||25,portraitLight:read('portraitLight','0')==='1',portraitLevel:Number(read('portraitLevel','35'))||35};
  let menu=null;

  const waitForMedia=()=>new Promise(resolve=>{let tries=0;const tick=()=>{if(window.DominionMediaController)return resolve(window.DominionMediaController);if(++tries>160)return resolve(null);setTimeout(tick,50);};tick();});
  const localVideos=()=>['prejoinVideo','localMeetingVideo','presenterCameraTile','settingsVideoPreview'].map(id=>document.getElementById(id)).filter(Boolean);
  const currentVideoTrack=media=>media?.stream?.()?.getVideoTracks?.().find(track=>track.readyState==='live')||null;
  const safeLabel=(value,fallback)=>String(value||'').trim()||fallback;

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
  function showSettingsList(){const dialog=$('#settingsDialog');if(!dialog)return;dialog.querySelector('.settings-list').hidden=false;dialog.querySelector('.settings-note').hidden=false;const detail=dialog.querySelector('#avSettingsDetail');if(detail)detail.hidden=true;}
  function addSelect(detail,labelText,attr){const label=document.createElement('label');label.className='av-field';const span=document.createElement('span');span.textContent=labelText;const select=document.createElement('select');select.setAttribute(attr,'1');label.append(span,select);detail.append(label);return select;}
  function addToggle(detail,labelText,checked,onChange){const label=document.createElement('label');label.className='av-toggle-row';const span=document.createElement('span');span.textContent=labelText;const input=document.createElement('input');input.type='checkbox';input.checked=Boolean(checked);input.onchange=()=>onChange(input.checked);label.append(span,input);detail.append(label);return input;}

  async function openAudioSettings(media){
    const dialog=$('#settingsDialog'),detail=ensureDetail(dialog);dialog.querySelector('.settings-list').hidden=true;dialog.querySelector('.settings-note').hidden=true;detail.hidden=false;detailHeader(detail,'Audio','Choose the microphone and speaker used by DominionStar Meet.');
    const mic=addSelect(detail,'Microphone','data-av-microphone'),speaker=addSelect(detail,'Speaker','data-av-speaker');
    const privacy=document.createElement('button');privacy.type='button';privacy.className='secondary-button av-privacy';privacy.textContent='Open macOS Microphone Privacy';privacy.onclick=()=>media.openPrivacy?.('microphone');detail.append(privacy);
    await fillSelects(media,detail);mic.onchange=async()=>{await media.selectMicrophone(mic.value);};speaker.onchange=async()=>{await media.selectSpeaker(speaker.value,$('#localMeetingVideo'));};
  }
  async function openVideoSettings(media){
    const dialog=$('#settingsDialog'),detail=ensureDetail(dialog);dialog.querySelector('.settings-list').hidden=true;dialog.querySelector('.settings-note').hidden=true;detail.hidden=false;detailHeader(detail,'Video','Camera, framing, and image preferences.');
    const preview=document.createElement('div');preview.className='av-video-preview';preview.innerHTML='<video id="settingsVideoPreview" autoplay playsinline muted></video><span>Camera preview</span>';detail.append(preview);const video=preview.querySelector('video');video.srcObject=media.stream();void video.play().catch(()=>{});
    const camera=addSelect(detail,'Camera','data-av-camera');
    const qualityLabel=document.createElement('label');qualityLabel.className='av-field';qualityLabel.innerHTML='<span>Video quality</span><select data-av-quality><option value="720">HD · 720p</option><option value="540">Balanced · 540p</option><option value="360">Data saver · 360p</option></select>';detail.append(qualityLabel);const quality=qualityLabel.querySelector('select');quality.value=state.quality;
    addToggle(detail,'Mirror my video',media.snapshot().mirror,value=>{media.setMirror(value);applyMirror(media);});
    addToggle(detail,'Original ratio',state.originalRatio,value=>{state.originalRatio=value;applyOriginalRatio();});
    addToggle(detail,'Adjust for low light',state.lowLight,value=>{state.lowLight=value;void applyLowLight(media);});
    const lowMode=addSelect(detail,'Low light mode','data-av-low-light-mode');lowMode.append(new Option('Auto','auto'),new Option('Manual','manual'));lowMode.value=state.lowLightMode;lowMode.onchange=()=>{state.lowLightMode=lowMode.value;void applyLowLight(media);};
    addRange(detail,'Manual low light',state.lowLightLevel,0,100,value=>{state.lowLightLevel=value;if(state.lowLight&&state.lowLightMode==='manual')void applyLowLight(media);});
    addToggle(detail,'Touch up my appearance',state.touchUp,value=>{state.touchUp=value;applyAppearance();});
    addRange(detail,'Touch up intensity',state.touchUpLevel,0,100,value=>{state.touchUpLevel=value;applyAppearance();});
    addToggle(detail,'Portrait lighting',state.portraitLight,value=>{state.portraitLight=value;applyAppearance();});
    addRange(detail,'Portrait lighting intensity',state.portraitLevel,0,100,value=>{state.portraitLevel=value;applyAppearance();});
    const privacy=document.createElement('button');privacy.type='button';privacy.className='secondary-button av-privacy';privacy.textContent='Open macOS Camera Privacy';privacy.onclick=()=>media.openPrivacy?.('camera');detail.append(privacy);
    await fillSelects(media,detail);camera.onchange=async()=>{await media.selectCamera(camera.value);video.srcObject=media.stream();applyMirror(media);applyOriginalRatio();applyAppearance();await applyQuality(media);if(state.lowLight)await applyLowLight(media);};quality.onchange=async()=>{state.quality=quality.value;await applyQuality(media);};applyMirror(media);applyOriginalRatio();
  }
  function openInfoSettings(title,copy){const dialog=$('#settingsDialog'),detail=ensureDetail(dialog);dialog.querySelector('.settings-list').hidden=true;dialog.querySelector('.settings-note').hidden=true;detail.hidden=false;detailHeader(detail,title,copy);const note=document.createElement('div');note.className='av-info-card';note.textContent=title==='Meetings'?'Join, waiting-room, host, and notification defaults will be added only after the core meeting path is physically approved.':'Screen sharing remains owned by the isolated nonblocking share subsystem. Share defaults will be exposed here after macOS Screen Recording permission passes physical QA.';detail.append(note);}

  function installSettings(media){
    const dialog=$('#settingsDialog');if(!dialog||dialog.dataset.avInstalled)return;dialog.dataset.avInstalled='1';
    for(const row of dialog.querySelectorAll('.settings-row')){const title=row.querySelector('strong')?.textContent?.trim();if(title==='Audio')row.onclick=()=>void openAudioSettings(media);else if(title==='Video')row.onclick=()=>void openVideoSettings(media);else if(title==='Meetings')row.onclick=()=>openInfoSettings('Meetings','Meeting defaults');else if(title==='Sharing')row.onclick=()=>openInfoSettings('Sharing','Screen-share defaults');}
    dialog.addEventListener('close',showSettingsList);
  }

  async function openQuickMenu(media,kind,anchor){
    closeMenu();menu=document.createElement('div');menu.className='av-quick-menu';menu.dataset.kind=kind;document.body.append(menu);
    const heading=document.createElement('strong');heading.textContent=kind==='audio'?'Audio options':'Video options';menu.append(heading);
    const devices=await media.enumerate(),snapshot=media.snapshot(),items=kind==='audio'?devices.microphones:devices.cameras,current=kind==='audio'?snapshot.microphoneId:snapshot.cameraId;
    const label=document.createElement('small');label.textContent=kind==='audio'?'Microphone':'Camera';menu.append(label);
    for(const item of items){const button=document.createElement('button');button.type='button';button.className=item.id===current?'selected':'';button.textContent=safeLabel(item.label,'Device');button.onclick=async()=>{if(kind==='audio')await media.selectMicrophone(item.id);else await media.selectCamera(item.id);closeMenu();};menu.append(button);}
    if(kind==='audio'&&devices.speakers.length){const divider=document.createElement('hr');menu.append(divider);const speakerLabel=document.createElement('small');speakerLabel.textContent='Speaker';menu.append(speakerLabel);for(const item of devices.speakers){const button=document.createElement('button');button.type='button';button.className=item.id===snapshot.speakerId?'selected':'';button.textContent=safeLabel(item.label,'Speaker');button.onclick=async()=>{await media.selectSpeaker(item.id,$('#localMeetingVideo'));closeMenu();};menu.append(button);}}
    if(kind==='video'){
      const divider=document.createElement('hr');menu.append(divider);
      const mirror=document.createElement('button');mirror.type='button';mirror.textContent=`${snapshot.mirror?'✓ ':''}Mirror my video`;mirror.onclick=()=>{media.setMirror(!media.snapshot().mirror);applyMirror(media);closeMenu();};menu.append(mirror);
      const original=document.createElement('button');original.type='button';original.textContent=`${state.originalRatio?'✓ ':''}Original ratio`;original.onclick=()=>{state.originalRatio=!state.originalRatio;applyOriginalRatio();closeMenu();};menu.append(original);
      const low=document.createElement('button');low.type='button';low.textContent=`${state.lowLight?'✓ ':''}Adjust for low light`;low.onclick=()=>{state.lowLight=!state.lowLight;void applyLowLight(media);closeMenu();};menu.append(low);
    }
    const divider=document.createElement('hr');menu.append(divider);const settings=document.createElement('button');settings.type='button';settings.textContent='Audio & Video Settings…';settings.onclick=()=>{closeMenu();const dialog=$('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();kind==='audio'?void openAudioSettings(media):void openVideoSettings(media);};menu.append(settings);
    const rect=anchor.getBoundingClientRect(),width=280,left=Math.min(window.innerWidth-width-12,Math.max(12,rect.left));menu.style.left=`${left}px`;menu.style.bottom=`${Math.max(74,window.innerHeight-rect.top+8)}px`;
  }

  function installMeetingQuickMenus(media){
    const mic=$('#roomMic'),camera=$('#roomCamera');if(!mic||!camera||mic.dataset.avQuickInstalled)return;mic.dataset.avQuickInstalled='1';
    for(const [button,kind] of [[mic,'audio'],[camera,'video']]){const caret=document.createElement('button');caret.type='button';caret.className='meeting-control av-device-caret';caret.setAttribute('aria-label',`${kind==='audio'?'Audio':'Video'} options`);caret.textContent='⌃';button.insertAdjacentElement('afterend',caret);caret.onclick=event=>{event.stopPropagation();void openQuickMenu(media,kind,caret);};}
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
