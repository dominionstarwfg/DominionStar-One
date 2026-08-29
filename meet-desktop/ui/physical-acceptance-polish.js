(()=>{
  if(window.DominionPhysicalAcceptancePolish)return;
  const QUALITY_KEY='ds_meet_video_quality';
  const q=s=>document.querySelector(s);
  let mediaBound=false,qualityBusy=false;

  const storedQuality=()=>{try{return localStorage.getItem(QUALITY_KEY)||'';}catch{return '';}};
  const saveQuality=value=>{try{localStorage.setItem(QUALITY_KEY,String(value));}catch{}};
  const uniqueTracks=()=>{
    const tracks=[];
    const add=stream=>{for(const track of stream?.getVideoTracks?.()||[]){if(track?.readyState==='live'&&!tracks.some(item=>item.id===track.id))tracks.push(track);}};
    try{add(window.DominionMediaController?.stream?.());}catch{}
    add(q('#settingsVideoPreview')?.srcObject);
    return tracks;
  };
  function qualityStatus(){
    const select=q('[data-av-quality]');if(!select)return null;const field=select.closest('.av-field');if(!field)return null;
    let node=field.querySelector('.av-quality-status');if(!node){node=document.createElement('small');node.className='av-quality-status';field.append(node);}return node;
  }
  async function applyFullHD(){
    if(qualityBusy)return false;qualityBusy=true;
    const status=qualityStatus();if(status){status.className='av-quality-status';status.textContent='Requesting 1920 × 1080 at 30 fps…';}
    try{
      const tracks=uniqueTracks();if(!tracks.length){if(status)status.textContent='Full HD will be requested when the camera starts.';return false;}
      const results=await Promise.allSettled(tracks.map(track=>track.applyConstraints?.({width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30}})));
      const primary=tracks[0],settings=primary?.getSettings?.()||{},width=Number(settings.width)||0,height=Number(settings.height)||0;
      const success=results.some(item=>item.status==='fulfilled')&&width>=1900&&height>=1000;
      if(status){
        status.className=`av-quality-status ${success?'success':'limited'}`;
        status.textContent=success?`Full HD active · ${width} × ${height}`:(width&&height?`Camera currently delivering ${width} × ${height}. Full HD was requested but this device/connection limited the stream.`:'Full HD was requested. The camera will use the highest supported resolution available.');
      }
      return success;
    }finally{qualityBusy=false;}
  }
  function enhanceQualityControl(){
    const select=q('[data-av-quality]');if(!select)return false;
    if(!select.querySelector('option[value="1080"]')){
      const option=document.createElement('option');option.value='1080';option.textContent='Full HD · 1080p';select.prepend(option);
    }
    if(!select.dataset.fullHdBound){
      select.dataset.fullHdBound='1';
      select.addEventListener('change',event=>{
        if(select.value!=='1080')return;
        event.stopImmediatePropagation();saveQuality('1080');void applyFullHD();
      },true);
    }
    if(storedQuality()==='1080'&&select.value!=='1080')select.value='1080';
    qualityStatus();
    if(storedQuality()==='1080')setTimeout(()=>void applyFullHD(),80);
    return true;
  }
  function bindMedia(){
    const media=window.DominionMediaController;if(!media?.onChange||mediaBound)return;mediaBound=true;
    media.onChange(()=>{if(storedQuality()==='1080')setTimeout(()=>void applyFullHD(),60);});
  }
  function sync(){enhanceQualityControl();bindMedia();}
  const observer=new MutationObserver(sync);observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('dominion:meeting-ui-ready',sync);
  setTimeout(sync,0);setTimeout(sync,500);
  window.DominionPhysicalAcceptancePolish=Object.freeze({version:'1.0.0-physical-mac-acceptance',applyFullHD,enhanceQualityControl});
})();
