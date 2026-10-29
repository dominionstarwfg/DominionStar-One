/* DominionStar Authenticated OS — shared Agent + Founder navigation shell.
   Review branch only. Preserves each page's existing auth and business logic. */
(() => {
  'use strict';

  const path=location.pathname.replace(/\/index\.html$/,'/').replace(/\/+$/,'')||'/';
  const founderRoutes=new Set([
    '/founder-control','/founder-dashboard','/founder-appointments','/founder-email','/qa-center',
    '/release-check','/founder-features','/founder-diagnostics'
  ]);
  const founderMode=[...founderRoutes].some(route=>path===route||path.startsWith(route+'/'));

  const rootSelectors=[
    '#communityApp','#chatApp','#appointmentApp','#directoryApp','#profileApp','#settingsApp',
    '#recognitionApp','#notificationApp','#dmApp','#communityCenterApp','#digitalCardApp','#mindsetApp',
    '#founderApp','#founderDashboard','#founderAppointmentApp','#emailAdminApp','#qaApp','#featureApp','#diagApp',
    '#releaseCheckApp','#agentJourneyApp','#agentLearningApp','#agentDriveApp','#agentTasksApp'
  ];
  const app=rootSelectors.map(selector=>document.querySelector(selector)).find(Boolean);
  if(!app || app.querySelector('[data-ds-agent-shell]')) return;

  document.body.classList.add('ds-auth-os-page');
  if(founderMode) document.body.classList.add('ds-founder-os-page');
  const syncShellVisibility=()=>{
    const visible=!app.classList.contains('member-hidden')&&!app.hidden&&!app.hasAttribute('hidden');
    document.body.classList.toggle('ds-auth-os-shell-active',visible);
    if(app.id==='dmApp') shell?.classList?.toggle('member-hidden',!visible);
  };
  const releaseFooter=document.querySelector('.platform-release-footer');
  if(releaseFooter) releaseFooter.textContent=founderMode?'DominionStar · Founder OS':'DominionStar · Executive OS';

  const agentItems=[
    ['Home','/member-dashboard/','home'],
    ['Messages','/direct-messages/','message'],
    ['Meet','/meet/','video'],
    ['Community','/community/','community'],
    ['Calendar','/appointments/','calendar'],
    ['Team Members','/member-directory/','users'],
    ['Recognition','/recognition/','trophy'],
    ['Learning','/agent-learning/','book'],
    ['My Journey','/agent-journey/','journey'],
    ['My Profile','/professional-profile/','user'],
    ['Settings','/account-settings/','settings']
  ];
  const founderItems=[
    ['Command Center','/founder-control/','crown'],
    ['Members','/member-directory/','users'],
    ['Appointments','/founder-appointments/','calendar'],
    ['Email Delivery','/founder-email/','mail'],
    ['QA Center','/qa-center/','check'],
    ['Feature Controls','/founder-features/','sliders'],
    ['Diagnostics','/founder-diagnostics/','pulse'],
    ['Release Check','/release-check/','shield'],
    ['Member View','/member-dashboard/','home']
  ];
  const items=founderMode?founderItems:agentItems;

  const shapes={
    home:'<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-7h6v7"/>',
    message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8Z"/>',
    video:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    community:'<path d="M7 9h10M7 13h7"/><path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 20.5 12Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    users:'<circle cx="8" cy="7" r="4"/><path d="M1 21v-2a7 7 0 0 1 14 0v2M16 3a4 4 0 0 1 0 8m2 5a6 6 0 0 1 5 5"/>',
    trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4M12 14v7M8 21h8"/>',
    book:'<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"/><path d="M4 18.5A3.5 3.5 0 0 1 7.5 15H20"/>',
    journey:'<path d="M5 19 19 5M8 5h11v11"/><circle cx="6" cy="18" r="2"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    settings:'<circle cx="12" cy="12" r="3.2"/><path d="M10 2h4l.5 2.4 2.1.9 2.1-1.3 2.8 2.8-1.3 2.1.9 2.1 2.4.5v4l-2.4.5-.9 2.1 1.3 2.1-2.8 2.8-2.1-1.3-2.1.9L14 22h-4l-.5-2.4-2.1-.9-2.1 1.3-2.8-2.8 1.3-2.1-.9-2.1L.5 14v-4l2.4-.5.9-2.1-1.3-2.1 2.8-2.8 2.1 1.3 2.1-.9L10 2Z"/>',
    crown:'<path d="m2 9 4 3 6-7 6 7 4-3-2 10H4L2 9ZM4 22h16"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    check:'<path d="m4 12 5 5L20 6"/><circle cx="12" cy="12" r="10"/>',
    sliders:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/>',
    pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    shield:'<path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'
  };
  const svg=key=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+shapes[key]+'</svg>';
  const normalized=url=>url.replace(/\/+$/,'')||'/';

  const shell=document.createElement('div');
  shell.className='ds-agent-shell';
  shell.dataset.dsAgentShell='true';

  const head=document.createElement('div');
  head.className='ds-agent-head';
  const brand=document.createElement('a');
  brand.href=founderMode?'/founder-control/':'/member-dashboard/';
  brand.className='ds-agent-brand';
  brand.innerHTML='<span class="ds-agent-brand-mark">✦</span><span class="ds-agent-brand-copy"><strong>DOMINIONSTAR</strong><small>'+(founderMode?'FOUNDER OS':'EXECUTIVE OS')+'</small></span>';

  const section=document.createElement('div');
  section.className='ds-agent-current';
  const auxiliaryLabels={'/workspace/drive':'Drive','/workspace/tasks':'Tasks'};
  section.textContent=(items.find(item=>normalized(item[1])===path)||[])[0] || auxiliaryLabels[path] || (founderMode?'Founder Operations':'My Space');

  const search=document.createElement('button');
  search.className='ds-agent-search-trigger';search.type='button';
  search.setAttribute('aria-label','Open quick navigation');
  search.innerHTML=svg('search')+'<span>Go to…</span><kbd>⌘ K</kbd>';
  head.append(brand,section,search);

  const nav=document.createElement('nav');
  nav.className='ds-agent-nav';
  nav.setAttribute('aria-label',founderMode?'Founder OS navigation':'Agent OS navigation');
  for(const [name,url,key] of items){
    const link=document.createElement('a');link.href=url;link.className='ds-agent-nav-item';
    if(normalized(url)===path){link.classList.add('active');link.setAttribute('aria-current','page');}
    link.innerHTML=svg(key)+'<span></span>';link.lastElementChild.textContent=name;nav.appendChild(link);
  }
  shell.append(head,nav);
  if(app.id==='dmApp') app.parentNode.insertBefore(shell,app);
  else app.prepend(shell);
  syncShellVisibility();
  new MutationObserver(syncShellVisibility).observe(app,{attributes:true,attributeFilter:['class','hidden']});

  const indicator=document.createElement('div');indicator.className='ds-agent-progress';indicator.setAttribute('aria-hidden','true');indicator.innerHTML='<span></span>';document.body.appendChild(indicator);
  const clear=()=>indicator.setAttribute('aria-hidden','true');window.addEventListener('pageshow',clear);window.addEventListener('pagehide',clear);
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=event.target.closest('a[href]');if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
    let to;try{to=new URL(anchor.href,location.href)}catch{return}
    if(to.origin!==location.origin||!['http:','https:'].includes(to.protocol)||(to.pathname===location.pathname&&to.search===location.search))return;
    indicator.setAttribute('aria-hidden','false');
  },{capture:true});

  const dialog=document.createElement('dialog');dialog.className='ds-agent-jump';dialog.setAttribute('aria-label','Go to a DominionStar area');
  dialog.innerHTML='<div class="ds-agent-jump-head"><strong>Jump to a DominionStar area</strong><button type="button" aria-label="Close navigation">×</button></div><label for="dsAgentJumpInput" class="ds-agent-sr">Search navigation destinations</label><input id="dsAgentJumpInput" type="search" autocomplete="off" placeholder="Search destinations…"><nav class="ds-agent-jump-results" aria-label="Destinations"></nav>';
  document.body.appendChild(dialog);
  const input=dialog.querySelector('input'),results=dialog.querySelector('.ds-agent-jump-results');
  let origin=null;
  const render=()=>{
    const query=input.value.trim().toLowerCase();results.replaceChildren();
    for(const [name,url,key] of items.filter(([name])=>name.toLowerCase().includes(query))){
      const anchor=document.createElement('a');anchor.href=url;anchor.innerHTML=svg(key)+'<span></span>';anchor.lastElementChild.textContent=name;results.appendChild(anchor);
    }
    if(!results.children.length){const empty=document.createElement('p');empty.textContent='No matching destination.';results.appendChild(empty);}
  };
  const open=source=>{if(app.classList.contains('member-hidden')||app.hidden||app.hasAttribute('hidden')||typeof dialog.showModal!=='function')return;origin=source||document.activeElement;input.value='';render();dialog.showModal();input.focus();};
  const close=()=>{if(dialog.open)dialog.close();origin?.focus?.();};
  search.addEventListener('click',()=>open(search));
  dialog.querySelector('button').addEventListener('click',close);
  input.addEventListener('input',render);
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();dialog.open?close():open(search);}});
})();
