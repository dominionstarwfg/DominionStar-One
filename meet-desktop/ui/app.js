(()=>{
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const sections={home:$('#homeSection'),meetings:$('#meetingsSection'),contacts:$('#contactsSection')};
  const dialogs={join:$('#joinDialog'),schedule:$('#scheduleDialog'),settings:$('#settingsDialog')};

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

  $$('[data-section]').forEach(button=>button.addEventListener('click',()=>showSection(button.dataset.section)));
  $$('[data-open]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.open==='profile')showFoundation('Profile is isolated','Account identity will be connected only after the new desktop authentication flow passes QA.');
    else openDialog(button.dataset.open);
  }));
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
})();
