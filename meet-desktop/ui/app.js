(()=>{
  const authStyle=document.createElement('link');authStyle.rel='stylesheet';authStyle.href='./auth.css';document.head.append(authStyle);
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const sections={home:$('#homeSection'),meetings:$('#meetingsSection'),contacts:$('#contactsSection')};
  const dialogs={join:$('#joinDialog'),schedule:$('#scheduleDialog'),settings:$('#settingsDialog'),profile:$('#profileDialog')};
  const desktopAuth=window.dominionDesktop?.auth||null;
  let authState={ready:!desktopAuth,signedIn:!desktopAuth,user:null};

  function showSection(name){
    Object.entries(sections).forEach(([key,node])=>{if(node)node.hidden=key!==name;});
    $$('.nav-button[data-section]').forEach(button=>button.classList.toggle('active',button.dataset.section===name));
  }

  function openDialog(name){
    const dialog=dialogs[name];
    if(dialog&&!dialog.open)dialog.showModal();
  }

  function showFoundation(title,copy){
    $('#foundationTitle').textContent=title;
    $('#foundationCopy').textContent=copy;
    const dialog=$('#foundationDialog');
    if(!dialog.open)dialog.showModal();
  }

  const initials=name=>String(name||'DominionStar Member').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DS';
  function applyIdentity(user){
    const name=String(user?.name||'DominionStar Member');
    const email=String(user?.email||'');
    const short=initials(name);
    $('#profileName').textContent=name;
    $('#profileAvatar').textContent=short;
    $('#profileDialogName').textContent=name;
    $('#profileDialogEmail').textContent=email||'DominionStar account';
    $('#profileDialogAvatar').textContent=short;
    const first=name.split(/\s+/).filter(Boolean)[0];
    if(first)$('#welcomeHeading').textContent=`Good evening, ${first}`;
  }

  function showHome(state){
    authState=state||authState;
    $('#bootScreen').hidden=true;
    $('#authGate').hidden=true;
    $('#appShell').hidden=false;
    applyIdentity(authState.user);
  }

  function showAuth(message='',kind=''){
    $('#bootScreen').hidden=true;
    $('#appShell').hidden=true;
    $('#authGate').hidden=false;
    const status=$('#authStatus');
    if(message)status.textContent=message;
    status.classList.toggle('error',kind==='error');
    status.classList.toggle('success',kind==='success');
    $('#googleSignIn').disabled=false;
  }

  async function bootAuthentication(){
    if(!desktopAuth){
      showHome({ready:true,signedIn:true,user:{name:'DominionStar Preview',email:'visual-preview@local'}});
      const pill=$('.status-pill');if(pill)pill.textContent='Visual preview';
      return;
    }
    try{
      const state=await desktopAuth.getState();
      if(state?.signedIn)showHome(state);
      else showAuth();
    }catch(error){showAuth(error?.message||'Desktop authentication could not be initialized.','error');}
  }

  $('#googleSignIn').addEventListener('click',async()=>{
    const button=$('#googleSignIn');
    const status=$('#authStatus');
    button.disabled=true;
    status.classList.remove('error','success');
    status.textContent='Opening Google in your browser. DominionStar Meet will stay open and wait for the secure return.';
    try{
      await desktopAuth.startGoogle();
      status.textContent='Complete Google verification in your browser. This window will unlock automatically when authentication returns.';
    }catch(error){
      button.disabled=false;
      status.classList.add('error');
      status.textContent=error?.message||'Google sign-in could not be started.';
    }
  });

  desktopAuth?.onChanged?.(state=>{
    if(state?.signedIn){
      showHome(state);
      const status=$('#authStatus');status.classList.remove('error');status.classList.add('success');
    }else showAuth('You are signed out. Sign in to reopen your DominionStar Meet workspace.');
  });
  desktopAuth?.onError?.(error=>showAuth(error?.message||'Google sign-in could not be completed.','error'));

  $('#signOutButton').addEventListener('click',async()=>{
    $('#signOutButton').disabled=true;
    try{await desktopAuth?.signOut?.();$('#profileDialog').close();if(!desktopAuth)showHome(authState);}
    catch(error){showFoundation('Sign out could not complete',error?.message||'Try again.');}
    finally{$('#signOutButton').disabled=false;}
  });

  $$('[data-section]').forEach(button=>button.addEventListener('click',()=>showSection(button.dataset.section)));
  $$('[data-open]').forEach(button=>button.addEventListener('click',()=>openDialog(button.dataset.open)));
  $$('[data-action]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.action==='new-meeting')showFoundation('New Meeting control is responsive','Meeting creation is the next foundation. This Home button is intentionally not connected to legacy meeting code.');
    if(button.dataset.action==='share-screen')showFoundation('Share control released correctly','Screen capture is not attached yet. The rebuild will add it behind a non-blocking picker with explicit liveness tests before physical QA.');
  }));

  function updateClock(){
    const now=new Date();
    $('#clockTime').textContent=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(now);
    $('#clockDate').textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(now);
  }
  updateClock();setInterval(updateClock,30000);

  window.dominionDesktop?.environment?.().then(info=>{
    const pill=$('.status-pill');
    if(pill)pill.textContent=info?.surface==='local-desktop-home'?'Local desktop':'Visual preview';
  }).catch(()=>{});

  void bootAuthentication();
})();
