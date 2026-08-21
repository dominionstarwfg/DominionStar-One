(()=>{
  'use strict';
  if(window.DominionReceiverSideLayout)return;
  const stage=document.getElementById('stage');
  const shared=document.getElementById('stageVideo');
  const dock=document.getElementById('filmstrip');
  const menu=document.getElementById('deviceMenu');
  if(!stage||!shared||!dock)return;

  const KEY_MODE='ds_meet_receiver_share_layout';
  const KEY_RATIO='ds_meet_receiver_share_ratio';
  const MODES=new Set(['standard','speaker','gallery','dynamic','multi-speaker']);
  let mode='standard';
  let ratio=.72;
  let dragging=null;

  try{const saved=localStorage.getItem(KEY_MODE);if(MODES.has(saved))mode=saved;const r=Number(localStorage.getItem(KEY_RATIO));if(Number.isFinite(r)&&r>=.45&&r<=.86)ratio=r;}catch(_){ }

  const divider=document.createElement('div');
  divider.className='ds-share-splitter';
  divider.tabIndex=0;
  divider.setAttribute('role','separator');
  divider.setAttribute('aria-orientation','vertical');
  divider.setAttribute('aria-label','Resize shared content and participant video');
  divider.hidden=true;
  stage.append(divider);

  const style=document.createElement('style');
  style.textContent=`
    body.ds-receiver-side-by-side #stage{display:grid!important;grid-template-columns:minmax(0,var(--ds-share-content,72%)) 8px minmax(220px,1fr)!important;grid-template-rows:1fr!important;align-items:stretch!important;overflow:hidden!important;gap:0!important}
    body.ds-receiver-side-by-side #stageVideo{position:relative!important;inset:auto!important;width:100%!important;height:100%!important;min-width:0!important;grid-column:1!important;grid-row:1!important;object-fit:contain!important;transform:none!important;background:#05080d!important}
    body.ds-receiver-side-by-side #filmstrip{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;grid-column:3!important;grid-row:1!important;border-radius:0!important;margin:0!important;z-index:20!important}
    body.ds-receiver-side-by-side #filmstrip.ds-user-positioned{left:auto!important;top:auto!important}
    .ds-share-splitter{grid-column:2;grid-row:1;position:relative;z-index:60;cursor:col-resize;background:rgba(255,255,255,.08);transition:background .12s ease}
    .ds-share-splitter::after{content:'';position:absolute;left:2px;top:calc(50% - 28px);width:4px;height:56px;border-radius:4px;background:rgba(255,255,255,.34)}
    .ds-share-splitter:hover,.ds-share-splitter:focus-visible,.ds-share-splitter.is-dragging{background:rgba(232,188,73,.18);outline:none}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='speaker'] #filmstripTrack{display:flex!important;align-items:stretch!important;justify-content:stretch!important}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='speaker'] #filmstripTrack .remote-tile:not(:first-child){display:none!important}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='speaker'] #filmstripTrack .remote-tile:first-child{width:100%!important;height:100%!important;max-height:none!important}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='gallery'] #filmstripTrack,body.ds-receiver-side-by-side[data-ds-receiver-layout='multi-speaker'] #filmstripTrack{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(118px,1fr))!important;grid-auto-rows:minmax(92px,1fr)!important;align-content:stretch!important;gap:6px!important;padding:8px!important;overflow:auto!important}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='dynamic'] #filmstripTrack{display:flex!important;flex-direction:column!important;gap:6px!important;padding:8px!important;overflow:auto!important}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='dynamic'] #filmstripTrack .remote-tile{min-height:112px!important;flex:1 0 112px!important;transition:flex .16s ease,order .16s ease,transform .16s ease}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='dynamic'] #filmstripTrack .remote-tile.speaking{order:-1!important;flex:2 0 180px!important;transform:scale(1.01)}
    body.ds-receiver-side-by-side[data-ds-receiver-layout='multi-speaker'] #filmstripTrack .remote-tile.speaking{grid-column:span 2!important;grid-row:span 2!important;min-height:190px!important;box-shadow:0 0 0 2px rgba(46,212,119,.58),0 12px 36px rgba(0,0,0,.28)!important}
    @media(max-width:820px){body.ds-receiver-side-by-side #stage{grid-template-columns:1fr!important;grid-template-rows:minmax(0,1fr) 7px minmax(130px,32vh)!important}.ds-share-splitter{grid-column:1!important;grid-row:2!important;cursor:row-resize!important}body.ds-receiver-side-by-side #stageVideo{grid-column:1!important;grid-row:1!important}body.ds-receiver-side-by-side #filmstrip{grid-column:1!important;grid-row:3!important}body.ds-receiver-side-by-side[data-ds-receiver-layout='multi-speaker'] #filmstripTrack .remote-tile.speaking{grid-column:span 1!important;grid-row:span 1!important;min-height:128px!important}}
  `;
  document.head.append(style);

  const clickDockView=view=>dock.querySelector(`[data-dock-view="${view}"]`)?.click();
  const persist=()=>{try{localStorage.setItem(KEY_MODE,mode);localStorage.setItem(KEY_RATIO,String(ratio));}catch(_){ }};
  const activeRemoteShare=()=>document.body.classList.contains('presentation-active')&&!document.body.classList.contains('local-presentation-active');
  const setRatio=value=>{
    ratio=Math.max(.45,Math.min(.86,Number(value)||.72));
    stage.style.setProperty('--ds-share-content',`${Math.round(ratio*1000)/10}%`);
    divider.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
    persist();
  };
  const apply=next=>{
    mode=MODES.has(next)?next:'standard';
    const side=mode!=='standard'&&activeRemoteShare();
    document.body.classList.toggle('ds-receiver-side-by-side',side);
    document.body.dataset.dsReceiverLayout=mode;
    divider.hidden=!side;
    dock.classList.toggle('ds-receiver-side-panel',side);
    if(side){
      dock.hidden=false;
      dock.classList.remove('ds-user-positioned','is-dragging','ds-dock-horizontal','ds-dock-floating');
      if(mode==='speaker')clickDockView('speaker');
      else if(mode==='gallery'||mode==='multi-speaker')clickDockView('grid');
      else clickDockView('stack');
      setRatio(ratio);
    }
    persist();
    window.dispatchEvent(new CustomEvent('dominion:receiver-share-layout',{detail:{mode,ratio,sideBySide:side}}));
    return {mode,ratio,sideBySide:side};
  };

  const makeAction=(label,value)=>{
    const b=document.createElement('button');b.type='button';b.dataset.dsReceiverLayoutAction=value;
    b.textContent=`${mode===value?'✓ ':''}${label}`;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();apply(value);menu.hidden=true;};
    return b;
  };
  const enhanceMenu=()=>{
    if(!menu||menu.hidden||menu.querySelector('[data-ds-receiver-layout-section]'))return;
    const title=menu.querySelector('.menu-title')?.textContent?.trim()||menu.querySelector('strong')?.textContent?.trim()||'';
    if(title!=='Shared Screen')return;
    const body=menu.querySelector('.utility-menu-body')||menu;
    const wrap=document.createElement('div');wrap.dataset.dsReceiverLayoutSection='1';wrap.className='ds-receiver-layout-menu';
    const heading=document.createElement('div');heading.className='device-menu-section';heading.textContent='Shared content layout';wrap.append(heading);
    wrap.append(makeAction('Standard', 'standard'));
    wrap.append(makeAction('Side-by-side: Speaker','speaker'));
    wrap.append(makeAction('Side-by-side: Gallery','gallery'));
    wrap.append(makeAction('Side-by-side: Dynamic gallery','dynamic'));
    wrap.append(makeAction('Side-by-side: Multi-speaker','multi-speaker'));
    body.prepend(wrap);
  };

  divider.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging={id:e.pointerId};divider.setPointerCapture?.(e.pointerId);divider.classList.add('is-dragging');e.preventDefault();});
  divider.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.id)return;const rect=stage.getBoundingClientRect();if(innerWidth<=820){const y=(e.clientY-rect.top)/Math.max(1,rect.height);setRatio(Math.max(.45,Math.min(.86,y)));}else{setRatio((e.clientX-rect.left)/Math.max(1,rect.width));}e.preventDefault();});
  const end=e=>{if(!dragging||(e?.pointerId!=null&&e.pointerId!==dragging.id))return;try{divider.releasePointerCapture?.(dragging.id);}catch(_){ }dragging=null;divider.classList.remove('is-dragging');persist();};
  divider.addEventListener('pointerup',end);divider.addEventListener('pointercancel',end);
  divider.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();setRatio(ratio+(e.key==='ArrowRight'?.03:-.03));});

  new MutationObserver(()=>{enhanceMenu();if(!activeRemoteShare()&&document.body.classList.contains('ds-receiver-side-by-side'))apply('standard');else if(activeRemoteShare()&&mode!=='standard')apply(mode);}).observe(document.body,{attributes:true,attributeFilter:['class']});
  if(menu)new MutationObserver(enhanceMenu).observe(menu,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',()=>{if(mode!=='standard')setRatio(ratio)},{passive:true});
  setRatio(ratio);
  if(activeRemoteShare())apply(mode);

  window.DominionReceiverSideLayout=Object.freeze({version:'1.1.0',setMode:apply,setRatio,snapshot:()=>({mode,ratio,active:activeRemoteShare(),sideBySide:document.body.classList.contains('ds-receiver-side-by-side')})});
})();