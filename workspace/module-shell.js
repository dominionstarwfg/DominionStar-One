(()=>{
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const path=location.pathname.replace(/\/+$/,'/') || '/';
  const params=new URLSearchParams(location.search);
  const modules=[
    {name:'Dashboard',hint:'Workspace home and daily overview',href:'/workspace/',icon:'⌂',keys:'home dashboard overview'},
    {name:'Chat',hint:'Messages, teams, and conversations',href:'/workspace/chat/',icon:'◫',keys:'chat message conversation team'},
    {name:'Meet',hint:'Start or join a meeting',href:'/meet/',icon:'◉',keys:'meet meeting call video audio'},
    {name:'Calendar',hint:'Events and scheduling',href:'/workspace/calendar/',icon:'▦',keys:'calendar schedule event appointment'},
    {name:'Drive',hint:'Files, folders, and sharing',href:'/workspace/drive/',icon:'▱',keys:'drive file folder document upload'},
    {name:'Tasks',hint:'Priorities and assignments',href:'/workspace/tasks/',icon:'✓',keys:'tasks todo assignment priority'},
    {name:'Contacts',hint:'People and directory',href:'/workspace/contacts/',icon:'◎',keys:'contacts people directory team'},
    {name:'Aurora',hint:'Workspace intelligence',href:'/workspace/aurora/',icon:'✦',keys:'aurora ai assistant intelligence'}
  ];

  qa('.nav a').forEach(a=>{
    const p=new URL(a.href,location.origin).pathname.replace(/\/+$/,'/') || '/';
    const active=p==='/workspace/' ? path==='/workspace/' : path.startsWith(p);
    a.classList.toggle('active',active);
    if(active)a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
  sessionStorage.setItem('ds:lastModule',path+location.search);

  const toast=(message,type='info')=>{
    let host=q('#dsToastHost');
    if(!host){host=document.createElement('div');host.id='dsToastHost';host.className='toast-host';document.body.append(host)}
    const n=document.createElement('div');n.className=`toast ${type}`;n.innerHTML=`<span>${type==='success'?'✓':'•'}</span><b>${message}</b>`;host.append(n);
    requestAnimationFrame(()=>n.classList.add('show'));
    setTimeout(()=>{n.classList.remove('show');setTimeout(()=>n.remove(),220)},2200);
  };

  const top=q('.top');
  if(top){
    const search=q('#globalModuleSearch');
    if(search){
      search.setAttribute('autocomplete','off');
      search.setAttribute('aria-expanded','false');
      search.insertAdjacentHTML('afterend','<div class="module-search-results" id="moduleSearchResults" hidden></div>');
      const results=q('#moduleSearchResults');
      const render=(term='')=>{
        const t=term.trim().toLowerCase();
        const found=modules.filter(m=>!t||`${m.name} ${m.hint} ${m.keys}`.toLowerCase().includes(t));
        results.innerHTML=found.slice(0,8).map((m,i)=>`<a href="${m.href}" ${i===0?'data-selected="true"':''}><span>${m.icon}</span><span><b>${m.name}</b><small>${m.hint}</small></span><kbd>↵</kbd></a>`).join('');
        results.hidden=false;search.setAttribute('aria-expanded','true');
      };
      search.addEventListener('focus',()=>render(search.value));
      search.addEventListener('input',()=>render(search.value));
      search.addEventListener('keydown',e=>{
        const links=qa('a',results);let idx=links.findIndex(a=>a.dataset.selected==='true');
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();links[idx]?.removeAttribute('data-selected');idx=e.key==='ArrowDown'?Math.min(idx+1,links.length-1):Math.max(idx-1,0);links[idx]?.setAttribute('data-selected','true');links[idx]?.scrollIntoView({block:'nearest'});
        } else if(e.key==='Enter'){
          e.preventDefault();const selected=links[idx]||links[0];if(selected)location.href=selected.href;
        } else if(e.key==='Escape'){results.hidden=true;search.setAttribute('aria-expanded','false');search.blur()}
      });
      document.addEventListener('click',e=>{if(!e.target.closest('.top')){results.hidden=true;search.setAttribute('aria-expanded','false')}});
    }

    const actions=q('.top-actions');
    if(actions){
      actions.insertAdjacentHTML('beforeend',`<button class="btn icon-only" id="workspaceNotices" aria-label="Notifications" aria-expanded="false">♢<i></i></button><button class="profile-chip" id="workspaceProfile" aria-expanded="false"><span>LA</span><b>Levismous</b><em>⌄</em></button>`);
      top.insertAdjacentHTML('beforeend',`<div class="module-popover notice-popover" id="moduleNotices" hidden><div class="popover-head"><b>Notifications</b><button id="clearNotices">Mark all read</button></div><div class="popover-empty">No new notifications.</div></div><div class="module-popover profile-popover" id="moduleProfile" hidden><b>Levismous</b><small>Founder · DominionStar</small><hr><a href="/account-settings/">Account settings</a><a href="/workspace/">Workspace home</a></div>`);
      const toggle=(button,panel)=>{const open=panel.hidden;qa('.module-popover').forEach(p=>p.hidden=true);qa('.top [aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false'));panel.hidden=!open;button.setAttribute('aria-expanded',String(open))};
      q('#workspaceNotices').onclick=e=>{e.stopPropagation();toggle(q('#workspaceNotices'),q('#moduleNotices'))};
      q('#workspaceProfile').onclick=e=>{e.stopPropagation();toggle(q('#workspaceProfile'),q('#moduleProfile'))};
      q('#clearNotices').onclick=()=>{q('#moduleNotices').innerHTML='<div class="popover-empty">You’re all caught up.</div>';q('#workspaceNotices i')?.remove();toast('Notifications marked as read','success')};
      document.addEventListener('click',e=>{if(!e.target.closest('.module-popover')&&!e.target.closest('#workspaceNotices')&&!e.target.closest('#workspaceProfile')){qa('.module-popover').forEach(p=>p.hidden=true);q('#workspaceNotices')?.setAttribute('aria-expanded','false');q('#workspaceProfile')?.setAttribute('aria-expanded','false')}});
    }
  }

  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();q('#globalModuleSearch')?.focus()}
  });
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-toast]');if(t)toast(t.dataset.toast,'success');
  });

  // Cross-module handoff messages.
  const contact=params.get('contact');
  if(path.startsWith('/workspace/chat/')&&contact){
    q('.panel-head b') && (q('.panel-head b').textContent=contact);
    q('.row.active .grow b') && (q('.row.active .grow b').textContent=contact);
    toast(`Conversation opened with ${contact}`,'success');
  }
  if(path.startsWith('/workspace/calendar/')&&params.get('action')==='new'){
    setTimeout(()=>toast('New event creator is ready','success'),250);
  }
  if(path.startsWith('/workspace/tasks/')&&params.get('task')){
    const name=params.get('task');const list=q('#tasksList');
    if(list&&name){const l=document.createElement('label');l.className='task';l.innerHTML='<input type="checkbox"><span><b></b><small class="muted">Created from Workspace</small></span>';q('b',l).textContent=name;list.prepend(l);toast('Task created from another module','success')}
  }
})();
