(()=>{
  'use strict';
  if(window.DominionQuickDeviceMenuParity)return;

  const $=id=>document.getElementById(id);
  const menu=$('deviceMenu');
  if(!menu)return;

  const dispatchChange=node=>node?.dispatchEvent(new Event('change',{bubbles:true}));
  const addDivider=()=>{const line=document.createElement('div');line.style.cssText='height:1px;background:#ffffff1f;margin:8px 0';menu.append(line);};
  const addButton=(label,onClick,{checked=false,note=''}={})=>{
    const button=document.createElement('button');
    button.type='button';
    button.dataset.dsQuickParity='1';
    button.innerHTML=`<span>${checked?'✓ ':''}${label}</span>${note?`<small>${note}</small>`:''}`;
    button.onclick=async()=>{try{await onClick();}catch(error){console.warn('Quick device action failed',error);}};
    menu.append(button);
    return button;
  };
  const openSettings=()=>{
    const dialog=$('settingsDialog');
    if(dialog?.showModal&&!dialog.open)dialog.showModal();
    menu.hidden=true;
  };

  const decorate=()=>{
    if(menu.hidden||menu.querySelector('[data-ds-quick-parity]'))return;
    const heading=menu.querySelector('strong')?.textContent||'';
    if(!/Audio options|Video options/i.test(heading))return;

    if(/Audio options/i.test(heading)){
      const speaker=$('speakerSelect');
      if(speaker?.options?.length){
        addDivider();
        const title=document.createElement('strong');title.dataset.dsQuickParity='1';title.textContent='Speaker';menu.append(title);
        [...speaker.options].forEach(option=>addButton(option.textContent,()=>{speaker.value=option.value;dispatchChange(speaker);menu.hidden=true;},{checked:option.value===speaker.value}));
      }
      addDivider();
      addButton('Audio & Video Settings…',openSettings,{note:'Advanced device controls'});
      return;
    }

    const mirror=$('mirrorToggle');
    const background=$('backgroundSelect');
    const quality=$('qualitySelect');
    const touch=$('touchAppearanceRange');
    addDivider();
    addButton('Mirror my video',()=>{if(!mirror)return;mirror.checked=!mirror.checked;dispatchChange(mirror);menu.hidden=true;},{checked:Boolean(mirror?.checked)});
    if(background){
      const labels={none:'No background',blur:'Blur background',portrait:'Portrait background'};
      [...background.options].forEach(option=>addButton(labels[option.value]||option.textContent,()=>{background.value=option.value;dispatchChange(background);menu.hidden=true;},{checked:option.value===background.value}));
    }
    if(quality){
      addDivider();
      [...quality.options].forEach(option=>addButton(option.textContent,()=>{quality.value=option.value;dispatchChange(quality);menu.hidden=true;},{checked:option.value===quality.value,note:'Video quality'}));
    }
    if(touch){
      addDivider();
      addButton('Touch Up Appearance',()=>{touch.value=Number(touch.value)>0?'0':'35';dispatchChange(touch);menu.hidden=true;},{checked:Number(touch.value)>0});
    }
    addDivider();
    addButton('Audio & Video Settings…',openSettings,{note:'Advanced camera controls'});
  };

  new MutationObserver(decorate).observe(menu,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  decorate();
  window.DominionQuickDeviceMenuParity=Object.freeze({version:'1.0.0',decorate,openSettings});
})();
