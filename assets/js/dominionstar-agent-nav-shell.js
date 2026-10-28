/* DominionStar Agent OS — compact shared navigation, review branch only.
   Mounts INSIDE the existing approved-member page. No auth or role changes.
   All links remain native so session handling and existing page logic are preserved.
*/
(() => {
  'use strict';
  const app = document.querySelector(
    '#communityApp, #appointmentApp, #directoryApp, #profileApp, #settingsApp'
  );
  if (!app || app.querySelector('[data-ds-agent-shell]')) return;

  const items = [
    ['Home','/member-dashboard/','home'],
    ['Messages','/direct-messages/','message'],
    ['Meet','/meet/','video'],
    ['Community','/community/','community'],
    ['Calendar','/appointments/','calendar'],
    ['Team Members','/member-directory/','users'],
    ['Recognition','/recognition/','trophy'],
    ['My Profile','/professional-profile/','user'],
    ['Settings','/account-settings/','settings']
  ];
  const shapes = {
    home:'<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-7h6v7"/>',
    message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8Z"/>',
    video:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    community:'<path d="M7 9h10M7 13h7"/><path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 20.5 12Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    users:'<circle cx="8" cy="7" r="4"/><path d="M1 21v-2a7 7 0 0 1 14 0v2M16 3a4 4 0 0 1 0 8m2 5a6 6 0 0 1 5 5"/>',
    trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4M12 14v7M8 21h8"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    settings:'<circle cx="12" cy="12" r="3.2"/><path d="M10 2h4l.5 2.4 2.1.9 2.1-1.3 2.8 2.8-1.3 2.1.9 2.1 2.4.5v4l-2.4.5-.9 2.1 1.3 2.1-2.8 2.8-2.1-1.3-2.1.9L14 22h-4l-.5-2.4-2.1-.9-2.1 1.3-2.8-2.8 1.3-2.1-.9-2.1L.5 14v-4l2.4-.5.9-2.1-1.3-2.1 2.8-2.8 2.1 1.3 2.1-.9L10 2Z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'
  };
  const svg = key => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+shapes[key]+'</svg>';

  const current=location.pathname.replace(/\/index\.html$/,'/').replace(/\/+$/,'')||'/';
  const shell=document.createElement('div');
  shell.className='ds-agent-shell';
  shell.dataset.dsAgentShell='true';

  const head=document.createElement('div');
  head.className='ds-agent-head';
  const brand=document.createElement('a');
  brand.href='/member-dashboard/';
  brand.className='ds-agent-brand';
  const identity=document.createElement('span');
  identity.className='ds-agent-brand-mark';
  identity.textContent='✦';
  const copy=document.createElement('span');
  copy.className='ds-agent-brand-copy';
  const strong=document.createElement('strong');
  strong.textContent='DOMINIONSTAR';
  const small=document.createElement('small');
  small.textContent='EXECUTIVE OS 2030';
  copy.append(strong,small);
  brand.append(identity,copy);

  const section=document.createElement('div');
  section.className='ds-agent-current';
  const active=items.find(item=>item[1].replace(/\/+$/,'')===current);
  section.textContent=active ? active[0] : 'My Space';
  const search=document.createElement('button');
  search.className='ds-agent-search-trigger';
  search.type='button';
  search.setAttribute('aria-label','Open quick navigation');
  search.innerHTML=svg('search')+'<span>Go to…</span><kbd>⌘ K</kbd>';
  head.append(brand,section,search);

  const nav=document.createElement('nav');
  nav.className='ds-agent-nav';
  nav.setAttribute('aria-label','Agent OS navigation');
  for(const [name,url,key] of items){
    const link=document.createElement('a');
    link.href=url;
    link.className='ds-agent-nav-item';
    if(url.replace(/\/+$/,'')===current) {
      link.classList.add('active');link.setAttribute('aria-current','page');
    }
    link.innerHTML=svg(key);
    const label=document.createElement('span');label.textContent=name;
    link.appendChild(label);
    nav.appendChild(link);
  }
  shell.append(head,nav);
  app.prepend(shell);

  // A native same-origin navigation indicator — no timers or artificial waiting.
  const indicator=document.createElement('div');
  indicator.className='ds-agent-progress';
  indicator.setAttribute('aria-hidden','true');
  indicator.innerHTML='<span></span>';
  document.body.appendChild(indicator);
  const clear=()=>indicator.setAttribute('aria-hidden','true');
  window.addEventListener('pageshow',clear);
  window.addEventListener('pagehide',clear);
  document.addEventListener('click',event=>{
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey ||
       event.shiftKey || event.altKey)return;
    const anchor=event.target.closest('a[href]');
    if(!anchor || anchor.hasAttribute('download') ||
       (anchor.target && anchor.target!=='_self'))return;
    let to;
    try{to=new URL(anchor.href,location.href);}catch{return;}
    if(to.origin!==location.origin || !['http:','https:'].includes(to.protocol) ||
       (to.pathname===location.pathname && to.search===location.search))return;
    indicator.setAttribute('aria-hidden','false');
  },{capture:true});

  const dialog=document.createElement('dialog');
  dialog.className='ds-agent-jump';
  dialog.setAttribute('aria-label','Go to an agent area');
  dialog.innerHTML='<div class="ds-agent-jump-head"><strong>Jump to an agent area</strong><button type="button" aria-label="Close navigation">×</button></div>'+
    '<label for="dsAgentJumpInput" class="ds-agent-sr">Search navigation destinations</label><input id="dsAgentJumpInput" type="search" autocomplete="off" placeholder="Search messages, calendar, team members…">'+
    '<nav class="ds-agent-jump-results" aria-label="Agent destinations"></nav>';
  document.body.appendChild(dialog);
  const input=dialog.querySelector('input');
  const results=dialog.querySelector('.ds-agent-jump-results');
  let origin=null;
  const render=()=>{
    const query=input.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    for(const [name,url,key] of items.filter(([name])=>name.toLocaleLowerCase().includes(query))){
      const anchor=document.createElement('a');anchor.href=url;
      anchor.innerHTML=svg(key);
      const label=document.createElement('span');label.textContent=name;
      anchor.appendChild(label);results.appendChild(anchor);
    }
    if(!results.children.length){
      const empty=document.createElement('p');empty.textContent='No matching destination.';results.appendChild(empty);
    }
  };
  const open=source=>{
    // App visibility is controlled by the existing member approval workflow.
    // Never surface the global launcher while that approved-area gate is shut.
    if(app.classList.contains('member-hidden') ||
       typeof dialog.showModal!=='function')return;
    origin=source||document.activeElement;input.value='';render();dialog.showModal();input.focus();
  };
  search.addEventListener('click',()=>open(search));
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>origin?.focus?.());
  input.addEventListener('input',render);
  input.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    const link=results.querySelector('a');
    if(link){event.preventDefault();link.click();}
  });
  document.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      if(dialog.open)dialog.close();else open(document.activeElement);
    }
  });
})();
