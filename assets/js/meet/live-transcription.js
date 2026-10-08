(() => {
  'use strict';
  if (window.DominionStarLiveTranscription) return;

  const engine = window.DominionStarMeetingEngine;
  const button = document.getElementById('transcribeBtn');
  const meeting = document.getElementById('meeting');
  if (!engine || !button || !meeting) return;

  const LANGUAGES = [
    {code:'original', label:'Keep each speaker’s original language'},
    {code:'en', label:'English'},
    {code:'fr', label:'French'},
    {code:'es', label:'Spanish'},
    {code:'zh', label:'Mandarin Chinese'}
  ];
  const SPOKEN = [
    {code:'auto', label:`Use my device language (${(navigator.language||'en-US').startsWith('fr')?'French':(navigator.language||'en-US').startsWith('es')?'Spanish':(navigator.language||'en-US').startsWith('zh')?'Mandarin Chinese':'English'})`},
    {code:'en-US', label:'English'},
    {code:'fr-CA', label:'French'},
    {code:'es-ES', label:'Spanish'},
    {code:'zh-CN', label:'Mandarin Chinese'}
  ];
  const STORAGE_TARGET='ds_meet_caption_target_v1';
  const STORAGE_SPOKEN='ds_meet_spoken_language_v1';
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  const state = {
    roomActive:Boolean(engine.snapshot?.().transcriptionActive),
    captionsTarget:localStorage.getItem(STORAGE_TARGET)||'original',
    spokenLanguage:localStorage.getItem(STORAGE_SPOKEN)||'auto',
    recognition:null,
    recognitionRunning:false,
    recognitionWanted:false,
    restartTimer:null,
    captionTimer:null,
    captionSeq:0,
    translatorCache:new Map(),
    providerReady:new Map(),
    translationGeneration:0,
    interimTranslationTimer:null,
    lastInterimBroadcastAt:0,
    interimText:'',
    lastFinalAt:0
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeLang = value => {
    const v=String(value||'').toLowerCase();
    if(v.startsWith('fr'))return 'fr';
    if(v.startsWith('es'))return 'es';
    if(v.startsWith('zh')||v.startsWith('cmn'))return 'zh';
    return 'en';
  };
  const localRecognitionLanguage = () => state.spokenLanguage==='auto' ? (navigator.language||'en-US') : state.spokenLanguage;

  const indicator=document.createElement('span');
  indicator.className='meet-transcription-indicator';
  indicator.hidden=true;
  indicator.innerHTML='<i></i><span>Live transcription</span>';
  document.querySelector('.meeting-meta')?.append(indicator);

  const tray=document.createElement('div');
  tray.className='meet-caption-tray';
  tray.hidden=true;
  tray.setAttribute('aria-live','polite');
  tray.setAttribute('aria-atomic','true');
  tray.innerHTML='<div class="meet-caption-speaker"></div><div class="meet-caption-text"></div><div class="meet-caption-language"></div>';
  document.getElementById('stage')?.append(tray);

  const dialog=document.createElement('dialog');
  dialog.className='settings-dialog transcription-dialog';
  dialog.innerHTML=`
    <header><div><strong>Live Captions</strong><small>Choose what you speak and what you want to read.</small></div><button type="button" data-close aria-label="Close">×</button></header>
    <div class="settings-body transcription-settings-body">
      <div class="caption-simple-step"><b>1</b><label><span>I am speaking</span><select data-spoken>${SPOKEN.map(x=>`<option value="${x.code}">${x.label}</option>`).join('')}</select><small>This controls how your microphone is recognized.</small></label></div>
      <div class="caption-simple-step"><b>2</b><label><span>I want to read captions in</span><select data-target>${LANGUAGES.map(x=>`<option value="${x.code}">${x.label}</option>`).join('')}</select><small>This changes only the captions you see.</small></label></div>
      <div class="caption-audience-note"><strong>What will other people see?</strong><p>Your words are shared as captions. Each person chooses their own reading language, so changing this setting does not change anyone else’s screen.</p></div>
      <div class="caption-choice-summary" data-summary></div>
      <div class="transcription-status" data-status></div>
    </div>
    <footer><button type="button" class="secondary" data-off>Hide My Captions</button><button type="button" class="secondary" data-stop hidden>Stop Captions for Everyone</button><button type="button" class="primary" data-start>Turn On My Captions</button></footer>`;
  document.body.append(dialog);

  const spokenSelect=dialog.querySelector('[data-spoken]');
  const targetSelect=dialog.querySelector('[data-target]');
  const statusNode=dialog.querySelector('[data-status]');
  const summaryNode=dialog.querySelector('[data-summary]');
  const stopButton=dialog.querySelector('[data-stop]');
  spokenSelect.value=state.spokenLanguage;
  targetSelect.value=state.captionsTarget;

  const updateUi = () => {
    const snap=engine.snapshot?.()||{};
    indicator.hidden=!state.roomActive;
    button.classList.toggle('active',state.captionsTarget!=='off');
    button.setAttribute('aria-pressed',String(state.captionsTarget!=='off'));
    button.querySelector('.tool-label').textContent=state.captionsTarget==='off'?'Transcribe':'Captions';
    statusNode.innerHTML=state.roomActive
      ? '<strong>Captions are available in this meeting</strong><small>Your personal captions will appear over the video.</small>'
      : '<strong>Captions are currently off</strong><small>Turn them on to read what people say.</small>';
    const spoken=SPOKEN.find(x=>x.code===spokenSelect.value)?.label||'your selected language';const target=LANGUAGES.find(x=>x.code===targetSelect.value)?.label||'the selected language';
    summaryNode.innerHTML=`<span>Your microphone: <strong>${escapeHtml(spoken)}</strong></span><span>Your screen: <strong>${escapeHtml(target)}</strong></span>`;
    stopButton.hidden=!(state.roomActive && snap.isHost);
    if(state.captionsTarget==='off')tray.hidden=true;
  };

  const notify = (message,type='info') => {
    const layer=document.getElementById('toastLayer');
    if(!layer)return;
    const node=document.createElement('div');node.className=`toast${type==='error'?' toast-error':''}`;node.textContent=message;layer.append(node);setTimeout(()=>node.remove(),3200);
  };

  async function getBrowserTranslator(source,target){
    if(source===target)return {translate:async text=>text};
    const key=`${source}:${target}`;
    if(state.translatorCache.has(key))return state.translatorCache.get(key);
    let translator=null;
    try{
      if(globalThis.Translator?.create){
        const availability=await globalThis.Translator.availability?.({sourceLanguage:source,targetLanguage:target});
        if(availability!=='unavailable')translator=await globalThis.Translator.create({sourceLanguage:source,targetLanguage:target});
      }else if(globalThis.ai?.translator?.create){
        translator=await globalThis.ai.translator.create({sourceLanguage:source,targetLanguage:target});
      }
    }catch(_){translator=null;}
    state.translatorCache.set(key,translator);
    return translator;
  }

  async function serverTranslate(text,source,target){
    try{
      const response=await fetch('/.netlify/functions/meet-translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,source,target})});
      if(!response.ok)return null;
      const data=await response.json();
      return String(data.translation||'').trim()||null;
    }catch(_){return null;}
  }

  async function translationAvailable(source,target){
    if(target==='original'||normalizeLang(source)===target)return true;
    const key=`${normalizeLang(source)}:${target}`;
    if(state.providerReady.has(key))return state.providerReady.get(key);
    let ready=false;
    try{
      const translator=await getBrowserTranslator(normalizeLang(source),target);
      if(translator?.translate)ready=true;
    }catch(_){ }
    if(!ready){
      try{
        const response=await fetch('/.netlify/functions/meet-translate',{method:'GET',headers:{accept:'application/json'}});
        if(response.ok){const data=await response.json();ready=Boolean(data?.available);}
      }catch(_){ }
    }
    state.providerReady.set(key,ready);
    return ready;
  }

  async function translateText(text,sourceLanguage,target){
    if(!text||target==='original')return {text,translated:false};
    const source=normalizeLang(sourceLanguage);
    if(source===target)return {text,translated:false};
    try{
      const translator=await getBrowserTranslator(source,target);
      if(translator?.translate){
        const translated=await translator.translate(text);
        if(translated)return {text:String(translated),translated:true,provider:'browser'};
      }
    }catch(_){/* server fallback */}
    const translated=await serverTranslate(text,source,target);
    if(translated)return {text:translated,translated:true,provider:'server'};
    return {text,translated:false,unavailable:true};
  }

  async function showCaption({text,displayName='Speaker',sourceLanguage='en',final=true,local=false}={}){
    const target=state.captionsTarget;
    if(target==='off'||!text)return;
    const seq=++state.captionSeq;
    const needsTranslation=target!=='original'&&normalizeLang(sourceLanguage)!==target;
    const speakerNode=tray.querySelector('.meet-caption-speaker');
    const textNode=tray.querySelector('.meet-caption-text');
    const languageNode=tray.querySelector('.meet-caption-language');
    const lang=target==='original'?'Original':LANGUAGES.find(x=>x.code===target)?.label||target;
    speakerNode.textContent=displayName+(local?' · You':'');
    if(needsTranslation&&!final){
      textNode.textContent='Listening…';
      languageNode.textContent=`${lang} · translating live speech`;
      tray.hidden=false;
      clearTimeout(state.interimTranslationTimer);
      const generation=state.translationGeneration;
      state.interimTranslationTimer=setTimeout(async()=>{
        const result=await translateText(text,sourceLanguage,target);
        if(generation!==state.translationGeneration||seq!==state.captionSeq||target!==state.captionsTarget)return;
        if(result.translated){textNode.textContent=result.text;languageNode.textContent=`${lang} · live`;}
      },280);
      return;
    }
    clearTimeout(state.interimTranslationTimer);
    if(needsTranslation){
      textNode.textContent='Translating…';
      languageNode.textContent=lang;
      tray.hidden=false;
    }
    const generation=state.translationGeneration;
    const result=final ? await translateText(text,sourceLanguage,target) : {text,translated:false};
    if(generation!==state.translationGeneration||seq!==state.captionSeq)return;
    if(result.unavailable&&needsTranslation){
      textNode.textContent=`${lang} translation is unavailable.`;
      languageNode.textContent='The original English text was not shown as a translated caption.';
    }else{
      textNode.textContent=result.text;
      languageNode.textContent=result.translated?lang:'';
    }
    tray.hidden=false;
    clearTimeout(state.captionTimer);
    if(final)state.captionTimer=setTimeout(()=>{tray.hidden=true;},6500);
  }

  function stopRecognition(){
    state.recognitionWanted=false;
    clearTimeout(state.restartTimer);
    clearTimeout(state.interimTranslationTimer);
    try{state.recognition?.stop?.();}catch(_){}
  }

  function scheduleRestart(){
    clearTimeout(state.restartTimer);
    if(!state.recognitionWanted||document.hidden)return;
    state.restartTimer=setTimeout(()=>startRecognition(),450);
  }

  function createRecognition(){
    if(!SpeechRecognition)return null;
    const recognition=new SpeechRecognition();
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;
    recognition.lang=localRecognitionLanguage();
    recognition.onstart=()=>{state.recognitionRunning=true;};
    recognition.onend=()=>{state.recognitionRunning=false;scheduleRestart();};
    recognition.onerror=event=>{
      state.recognitionRunning=false;
      const hard=['not-allowed','service-not-allowed','audio-capture'];
      if(hard.includes(event.error)){state.recognitionWanted=false;notify(`Live transcription unavailable: ${event.error}`,'error');}
    };
    recognition.onresult=event=>{
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const item=event.results[i];
        const text=String(item[0]?.transcript||'').trim();
        if(!text)continue;
        if(item.isFinal){
          state.lastFinalAt=Date.now();
          const source=normalizeLang(recognition.lang);
          showCaption({text,displayName:engine.snapshot?.().displayName||'You',sourceLanguage:source,final:true,local:true});
          window.dispatchEvent(new CustomEvent('ds:local-transcript',{detail:{text,final:true,sourceLanguage:source,displayName:engine.snapshot?.().displayName||'You',from:engine.snapshot?.().participantId||'local',startedAt:Date.now(),endedAt:Date.now()}}));
          engine.transcript?.({text,final:true,sourceLanguage:source,startedAt:Date.now(),endedAt:Date.now()}).catch(()=>{});
        }else interim+=`${text} `;
      }
      interim=interim.trim();
      if(interim && state.captionsTarget!=='off'){
        const source=normalizeLang(recognition.lang),now=Date.now();
        showCaption({text:interim,displayName:engine.snapshot?.().displayName||'You',sourceLanguage:source,final:false,local:true});
        // Share only the newest interim phrase at a controlled cadence. Each
        // viewer translates it into their own selected language; final phrases
        // remain the durable transcript used for notes and summaries.
        if(now-state.lastInterimBroadcastAt>=500){
          state.lastInterimBroadcastAt=now;
          engine.transcript?.({text:interim,final:false,sourceLanguage:source,startedAt:now,endedAt:now}).catch(()=>{});
        }
      }
    };
    return recognition;
  }

  function startRecognition(){
    if(!state.roomActive||!SpeechRecognition||document.hidden)return;
    state.recognitionWanted=true;
    if(state.recognitionRunning)return;
    if(!state.recognition||state.recognition.lang!==localRecognitionLanguage()){
      try{state.recognition?.abort?.();}catch(_){}
      state.recognition=createRecognition();
    }
    try{state.recognition?.start?.();}catch(_){scheduleRestart();}
  }

  async function startCaptions(){
    state.spokenLanguage=spokenSelect.value||'auto';
    state.captionsTarget=targetSelect.value||'original';
    state.translationGeneration++;
    if(state.captionsTarget!=='original'){
      const ready=await translationAvailable(localRecognitionLanguage(),state.captionsTarget);
      if(!ready){
        const label=LANGUAGES.find(x=>x.code===state.captionsTarget)?.label||state.captionsTarget;
        statusNode.innerHTML=`<strong>${escapeHtml(label)} translation is not connected.</strong><small>Configure the meeting translation service before selecting this language. Captions will not pretend English is translated ${escapeHtml(label)}.</small>`;
        notify(`${label} translation is not connected`,'error');
        return;
      }
    }
    localStorage.setItem(STORAGE_SPOKEN,state.spokenLanguage);
    localStorage.setItem(STORAGE_TARGET,state.captionsTarget);
    if(!state.roomActive){
      state.roomActive=true;
      await engine.setTranscriptionActive?.(true,{language:normalizeLang(localRecognitionLanguage())}).catch(()=>{});
      notify('Live transcription started');
    }
    startRecognition();
    updateUi();
    dialog.close();
  }

  button.addEventListener('click',()=>{
    spokenSelect.value=state.spokenLanguage;
    targetSelect.value=state.captionsTarget==='off'?'original':state.captionsTarget;
    updateUi();
    dialog.showModal();
  });
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.querySelector('[data-start]').addEventListener('click',startCaptions);
  dialog.querySelector('[data-off]').addEventListener('click',()=>{state.captionsTarget='off';localStorage.setItem(STORAGE_TARGET,'off');tray.hidden=true;updateUi();dialog.close();});
  stopButton.addEventListener('click',async()=>{state.roomActive=false;stopRecognition();await engine.setTranscriptionActive?.(false,{language:normalizeLang(localRecognitionLanguage())}).catch(()=>{});tray.hidden=true;updateUi();dialog.close();notify('Live transcription stopped');});
  spokenSelect.addEventListener('change',()=>{state.spokenLanguage=spokenSelect.value;localStorage.setItem(STORAGE_SPOKEN,state.spokenLanguage);if(state.recognitionWanted){stopRecognition();state.recognitionWanted=true;setTimeout(startRecognition,120);}});
  targetSelect.addEventListener('change',()=>{state.translationGeneration++;updateUi();});

  engine.on?.('transcript',payload=>{
    if(payload?.from===engine.snapshot?.().participantId)return;
    showCaption({text:payload?.text,displayName:payload?.displayName||'Speaker',sourceLanguage:payload?.sourceLanguage||'en',final:payload?.final!==false,local:false});
  });
  engine.on?.('transcription-state',payload=>{
    state.roomActive=Boolean(payload?.active);
    if(state.roomActive){startRecognition();if(!payload?.local)notify('Live transcription is active in this meeting');}
    else {stopRecognition();tray.hidden=true;}
    updateUi();
  });
  engine.on?.('meeting-ended',()=>{stopRecognition();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){try{state.recognition?.stop?.();}catch(_){}}else if(state.roomActive)startRecognition();});

  if(!SpeechRecognition){
    statusNode.innerHTML='<strong>Speech recognition is not available in this browser.</strong><small>Use a current Chromium-based browser for live microphone transcription.</small>';
  }
  updateUi();
  if(state.roomActive)startRecognition();

  window.DominionStarLiveTranscription={open:()=>button.click(),start:startCaptions,stop:stopRecognition,state:()=>({...state,recognition:null,translatorCache:undefined})};
})();
