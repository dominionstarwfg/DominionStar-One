(()=>{
  'use strict';
  if(window.DominionZoomProductionPolish)return;
  const q=s=>document.querySelector(s);
  let chatPolicyMenu=null;

  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);

  function positionAbove(menu,anchor,width=228){
    if(!menu||!anchor)return;
    const r=anchor.getBoundingClientRect();
    menu.style.position='fixed';
    menu.style.width=`${width}px`;
    menu.style.left=`${Math.max(10,Math.min(innerWidth-width-10,r.right-width))}px`;
    menu.style.bottom=`${Math.max(72,innerHeight-r.top+8)}px`;
    menu.style.zIndex='3800';
  }

  function closeChatPolicyMenu(){
    chatPolicyMenu?.remove();
    chatPolicyMenu=null;
  }

  function openChatPolicyMenu(anchor){
    closeChatPolicyMenu();
    const select=q('#meetingChatPolicy');
    if(!select)return false;
    const menu=document.createElement('div');
    menu.className='zoom-chat-policy-menu';
    chatPolicyMenu=menu;

    if(select.disabled){
      const close=document.createElement('button');
      close.type='button';
      close.textContent='Close chat';
      close.onclick=()=>{closeChatPolicyMenu();q('[data-chat-close]')?.click();};
      menu.append(close);
      document.body.append(menu);
      positionAbove(menu,anchor,210);
      return true;
    }

    const heading=document.createElement('button');
    heading.type='button';
    heading.disabled=true;
    heading.textContent='Participant can chat with';
    menu.append(heading);

    for(const option of [...select.options]){
      const button=document.createElement('button');
      button.type='button';
      button.textContent=String(option.textContent||option.value).replace(/^Participants (can|cannot) chat:\s*/i,'');
      button.classList.toggle('selected',option.value===select.value);
      button.onclick=()=>{
        select.value=option.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        closeChatPolicyMenu();
      };
      menu.append(button);
    }

    document.body.append(menu);
    positionAbove(menu,anchor,265);
    return true;
  }

  function normalizeChatPanel(){
    const panel=q('#meetingChatPanel');
    if(!panel||panel.hidden)return false;
    panel.dataset.dsRuntimePanel='chat';
    panel.dataset.zoomPanelMode='runtime';
    window.DominionRuntimeStability?.layoutSideSurface?.();
    return true;
  }

  function ensureChatChrome(){
    const panel=q('#meetingChatPanel');
    const header=panel?.querySelector('header');
    const close=header?.querySelector('[data-chat-close]');
    const select=q('#meetingChatPolicy');
    if(!panel||!header||!close||!select)return false;

    let actions=header.querySelector('.zoom-chat-header-actions');
    if(!actions){
      actions=document.createElement('div');
      actions.className='zoom-chat-header-actions';
      const more=document.createElement('button');
      more.type='button';
      more.className='zoom-chat-more';
      more.textContent='•••';
      more.setAttribute('aria-label','Chat options');
      more.onclick=event=>{event.stopPropagation();openChatPolicyMenu(more);};
      actions.append(more);
      header.insertBefore(actions,close);
      actions.append(close);
    }
    actions.hidden=false;
    return true;
  }

  function cleanMoreMenu(){
    for(const menu of document.querySelectorAll('.meeting-more-menu')){
      for(const button of [...menu.querySelectorAll('button')]){
        if(/^host\s+tools$/i.test(String(button.textContent||'').trim()))button.remove();
      }
    }
  }

  function sync(){
    if(!meetingOpen()){closeChatPolicyMenu();return false;}
    normalizeChatPanel();
    ensureChatChrome();
    cleanMoreMenu();
    return true;
  }

  const onPointerDown=event=>{
    if(chatPolicyMenu&&!chatPolicyMenu.contains(event.target)&&!event.target.closest?.('.zoom-chat-more'))closeChatPolicyMenu();
  };
  const onMeetingEnded=()=>closeChatPolicyMenu();

  document.addEventListener('pointerdown',onPointerDown,true);
  window.addEventListener('dominion:meeting-ended',onMeetingEnded,true);

  window.DominionZoomProductionPolish=Object.freeze({
    version:'2.0.54-chat-helper',
    sync,
    normalizeChatPanel,
    ensureChatChrome,
    closeChatPolicyMenu,
    dispose:()=>{
      document.removeEventListener('pointerdown',onPointerDown,true);
      window.removeEventListener('dominion:meeting-ended',onMeetingEnded,true);
      closeChatPolicyMenu();
    }
  });
})();
