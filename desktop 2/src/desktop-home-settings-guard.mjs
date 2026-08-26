import { app } from 'electron';

const PRODUCTION_HOSTS=new Set(['dominionstarld.com','www.dominionstarld.com']);
const QA_PREVIEW_HOST=/^deploy-preview-\d+--melodious-buttercream-a99450\.netlify\.app$/i;
function isDesktopHost(hostname=''){const host=String(hostname||'').toLowerCase();return PRODUCTION_HOSTS.has(host)||QA_PREVIEW_HOST.test(host);}

function installSettingsGuard(contents){
  if(!contents||contents.isDestroyed?.())return;
  const apply=()=>{
    let current;try{current=new URL(String(contents.getURL?.()||''));}catch{return;}
    if(!isDesktopHost(current.hostname)||current.pathname.replace(/\/+$/,'')!=='/meet-home'||current.searchParams.get('desktop')!=='1')return;
    const script=`(()=>{
      if(window.__dsDesktopSettingsIndependenceV1)return;
      window.__dsDesktopSettingsIndependenceV1=true;
      const $=id=>document.getElementById(id);
      const readJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
      const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
      const save=$('saveSettings');if(!save)return;
      save.addEventListener('click',async event=>{
        const roomValue=String($('personalRoomId')?.value||'').replace(/\\D/g,'');
        const usePersonal=Boolean($('settingsUsePersonal')?.checked);
        if(roomValue.length===10||usePersonal)return;
        event.preventDefault();event.stopImmediatePropagation();
        const status=$('settingsStatus');save.disabled=true;if(status)status.textContent='Saving…';
        try{
          const client=await window.DSAuth?.init?.();
          const session=client?(await client.auth.getSession()).data.session:null;
          const mediaKey='ds_meet_preferences:'+(session?.user?.id||'anonymous');
          const previous=readJson(mediaKey,{})||{};
          const next={...previous,
            joinMuted:$('defaultMic')?.value!=='on',joinCameraOff:$('defaultCamera')?.value!=='on',mirror:Boolean($('desktopMirrorVideo')?.checked),
            quality:String($('desktopVideoQuality')?.value||previous.quality||'720'),background:String($('desktopBackground')?.value||previous.background||'none'),
            brightness:Number($('desktopBrightness')?.value??previous.brightness??100),touchAppearance:Number($('desktopAppearance')?.value??previous.touchAppearance??0),
            cameraId:String($('desktopCameraSelect')?.value||''),microphoneId:String($('desktopMicrophoneSelect')?.value||''),speakerId:String($('desktopSpeakerSelect')?.value||''),
            shareSound:Boolean($('desktopShareSound')?.checked),shareOptimize:Boolean($('desktopShareOptimize')?.checked),shareOwnWindows:Boolean($('desktopShareOwnWindows')?.checked),updatedAt:new Date().toISOString()
          };
          writeJson(mediaKey,next);
          const identity={...(readJson('ds_meet_identity_preferences_v1',{})||{}),usePersonalForInstant:false,defaultScheduleIdentity:$('defaultScheduleIdentity')?.value==='generated'?'generated':'personal'};
          writeJson('ds_meet_identity_preferences_v1',identity);
          if(client&&session?.user){
            try{await client.from('meet_user_preferences').upsert({user_id:session.user.id,join_muted:Boolean(next.joinMuted),join_camera_off:Boolean(next.joinCameraOff),mirror_video:next.mirror!==false,background_mode:String(next.background||'none'),brightness:Number(next.brightness??100),touch_appearance:Number(next.touchAppearance??0),video_quality:String(next.quality||'720'),camera_id:String(next.cameraId||''),microphone_id:String(next.microphoneId||''),speaker_id:String(next.speakerId||''),updated_at:next.updatedAt},{onConflict:'user_id'});}catch(error){console.warn('Meet preference sync deferred',error);}
          }
          if(status)status.textContent='Settings saved.';
          setTimeout(()=>$('settingsDialog')?.close?.(),300);
        }catch(error){if(status)status.textContent=error?.message||'Could not save settings.';}
        finally{save.disabled=false;}
      },true);
    })();`;
    void contents.executeJavaScript(script,true).catch(()=>{});
  };
  contents.on('dom-ready',apply);
}

app.on('web-contents-created',(_event,contents)=>installSettingsGuard(contents));

export const DominionDesktopHomeSettingsGuard=Object.freeze({installSettingsGuard});
