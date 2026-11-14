(async()=>{
 const gate=document.getElementById('notificationGate'),app=document.getElementById('notificationApp'),list=document.getElementById('notificationList');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 // A stalled Auth, database, realtime, or read-state call must not leave the
 // executive inbox frozen. The original promise is observed even if late.
 const bounded=(operation,ms=10000)=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('The notification request timed out.')),ms);
   Promise.resolve(operation).then(
     value=>{clearTimeout(timer);resolve(value);},
     error=>{clearTimeout(timer);reject(error);}
   );
 });
 if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication unavailable.</h1>';return}
 let client,session;
 try {
   client=await bounded(window.DSAuth.init());
   if(!client)throw new Error('Authentication service unavailable');
   const auth=await bounded(client.auth.getSession());
   if(auth.error)throw auth.error;
   session=auth.data?.session||null;
 }catch(_error){
   gate.innerHTML='<h1>Unable to load your notifications</h1><p>Check your connection and refresh to verify your session.</p>';
   return;
 }
 if(!session){location.href='/member-login/';return}
 try{
   const approval=await bounded(client.from('member_profiles').select('verification_status')
     .eq('id',session.user.id).maybeSingle());
   if(approval.error)throw approval.error;
   if(approval.data?.verification_status!=='approved'){
     gate.innerHTML='<h1>Founder approval required</h1><p>Executive notifications become available after your agent account is approved.</p>';
     return;
   }
 }catch(_error){
   gate.innerHTML='<h1>Unable to verify agent access</h1><p>Check your connection and refresh the page.</p>';
   return;
 }
 // Sound/toast service is best-effort. Inbox rendering and read state must
 // remain usable if browser media, push registration, or audio is unavailable.
 try{await bounded(window.CommunicationEngine?.init?.({client,session}),3000);}
 catch(_error){console.warn('Notification sound initialization unavailable.');}
 gate.classList.add('member-hidden');app.classList.remove('member-hidden');
 const PAGE_SIZE=100;
 let events=[],filter='all',hasMore=false,loadingOlder=false;
 let stats={unread:null,missed:null,today:null};
 const more=document.getElementById('notificationLoadMore');
 const pageInfo=document.getElementById('notificationPageInfo');
 const category=e=>e.event_type?.startsWith('connection.')?'connections':e.event_type?.startsWith('call.')?'calls':e.event_type?.startsWith('message.')?'communications':e.event_type?.startsWith('community.')?'community':(e.event_type?.startsWith('meeting.')||e.event_type?.startsWith('appointment.'))?'meetings':e.event_type?.startsWith('journey.')?'journey':e.event_type?.startsWith('recognition.')?'recognition':'communications';
 const notificationPaths={
  calls:'<path d="M6.6 2.5 9 7.2 6.9 9.3c1.1 2.3 2.9 4.1 5.2 5.2l2.1-2.1 4.7 2.4c.4.2.6.6.5 1-.4 2.4-2.5 4.2-5 4.2C8.6 20 4 15.4 4 9.6c0-2.5 1.8-4.6 4.2-5 .4-.1.8.1 1 .5Z"/>',
  communications:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8Z"/>',
  community:'<circle cx="12" cy="12" r="9"/><path d="M16 8v5a4 4 0 1 1-4-4h4v4c0 2 3 2 3-.5V12"/>',
  connections:'<circle cx="8" cy="8" r="3"/><circle cx="18" cy="9" r="2"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M15 17l2 2 4-5"/>',
  meetings:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  journey:'<path d="M5 19 19 5M8 5h11v11"/><circle cx="6" cy="18" r="2"/>',
  recognition:'<path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 0 4-4M12 14v7M8 21h8"/>'
 };
 const icon=e=>'<svg class="dsx-notice-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+notificationPaths[category(e)]+'</svg>';
 const safeActionUrl=candidate=>{
   if(window.CommunicationEngine?.safeActionUrl)
     return window.CommunicationEngine.safeActionUrl(candidate);
   try{
     const origin=window.location?.origin;
     if(!origin)return '/notifications/';
     const url=new URL(String(candidate||'/notifications/'),origin);
     if(url.origin!==origin || !['http:','https:'].includes(url.protocol))
       return '/notifications/';
     return url.pathname+url.search+url.hash;
   }catch{return '/notifications/'}
 };
 const render=()=>{const shown=events.filter(e=>filter==='all'||category(e)===filter); list.innerHTML=shown.length?shown.map(e=>`<a class="notification-item notification-${category(e)} ${e.event_type==='call.missed'?'notification-missed ':''}${e.read_at?'':'unread'}" data-event-id="${esc(e.id)}" href="${esc(safeActionUrl(e.payload?.action_url||'/member-dashboard/'))}"><span class="notification-item-icon">${icon(e)}</span><div><strong>${esc(e.title)}</strong><p>${esc(e.description||'')}</p><small>${new Date(e.created_at).toLocaleString()}</small></div>${e.read_at?'':'<b>New</b>'}</a>`).join(''):'<div class="member-empty-state"><h2>All clear.</h2><p>No matching alerts in the loaded results. Load earlier notifications if available.</p></div>'; const unread=events.filter(e=>!e.read_at).length;
   const missed=events.filter(e=>e.event_type==='call.missed').length;
   const today=events.filter(e=>
     new Date(e.created_at).getTime()>=new Date().setHours(0,0,0,0)).length;
   const display=(total,minimum)=>total===null?(hasMore?'≥'+minimum:minimum):total;
   document.getElementById('notificationUnread').textContent=display(stats.unread,unread);
   document.getElementById('notificationMissed').textContent=display(stats.missed,missed);
   document.getElementById('notificationToday').textContent=display(stats.today,today);
   // The badge uses a verified server count when available, not the 100-row
   // preview count. On count failure only a partial minimum is available.
   window.CommunicationEngine?.setBadge?.(stats.unread??unread);
   if(more){more.hidden=!hasMore;more.disabled=loadingOlder;
     more.textContent=loadingOlder?'Loading earlier…':'Load earlier notifications';}
   if(pageInfo)pageInfo.textContent=events.length
     ?'Showing '+events.length+' most recent notifications'+(hasMore?' (more available).':'.')
     :'';
 };
 const actionStatus=document.getElementById('notificationActionStatus');
 const setStatus=message=>{if(actionStatus)actionStatus.textContent=message||'';};
 let loadVersion=0;
 // The first page is a preview, not the entire private notification history.
 // Use owner-scoped PostgREST HEAD counts; never infer totals from 100 rows.
 const loadStats=async version=>{
   const countQuery=filterQuery=>{
     const base=client.from('executive_events')
       .select('id',{count:'exact',head:true})
       .eq('member_id',session.user.id);
     return bounded(filterQuery(base),8000);
   };
   const results=await Promise.allSettled([
     countQuery(q=>q.is('read_at',null)),
     countQuery(q=>q.eq('event_type','call.missed')),
     countQuery(q=>q.gte('created_at',
       new Date(new Date().setHours(0,0,0,0)).toISOString()))
   ]);
   if(version!==loadVersion)return;
   const countAt=i=>results[i].status==='fulfilled'
      &&!results[i].value.error
      &&Number.isInteger(results[i].value.count)
      ?results[i].value.count:null;
   stats={unread:countAt(0),missed:countAt(1),today:countAt(2)};
   render();
 };
 const load=async()=>{
   const version=++loadVersion;
   try{
     const r=await bounded(client.from('executive_events').select('*').eq('member_id',session.user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(PAGE_SIZE+1),12000);
     if(r.error)throw r.error;
     if(version!==loadVersion)return false;
     // Fetch one extra row: exactly 100 notifications is NOT proof there
     // are older records. Avoid a dead-end Load earlier button.
     const firstPage=r.data||[];
     events=firstPage.slice(0,PAGE_SIZE);
     hasMore=firstPage.length>PAGE_SIZE;
     stats={unread:null,missed:null,today:null};
     render();
     void loadStats(version);
     return true;
   }catch(error){
     if(version!==loadVersion)return false;
     list.innerHTML=`<div class="dashboard-load-error" role="alert"><strong>Inbox unavailable.</strong><p>${esc(error?.message||'Unable to load notifications.')}</p><button type="button" id="notificationRetry">Retry</button></div>`;
     document.getElementById('notificationRetry')?.addEventListener('click',()=>void load(),{once:true});
     return false;
   }
 };
 if(more)more.onclick=async()=>{
   if(loadingOlder||!hasMore)return;
   const version=loadVersion;
   loadingOlder=true;
   render();
   try{
     const offset=events.length;
     const r=await bounded(client.from('executive_events')
       .select('*').eq('member_id',session.user.id)
       .order('created_at',{ascending:false}).order('id',{ascending:false})
       .range(offset,offset+PAGE_SIZE),12000);
     if(r.error)throw r.error;
     if(version!==loadVersion)return; // Realtime fresh-page load superseded this.
     const page=r.data||[];
     const seen=new Set(events.map(e=>e.id));
     for(const event of page.slice(0,PAGE_SIZE)){
       if(!seen.has(event.id)){events.push(event);seen.add(event.id);}
     }
     hasMore=page.length>PAGE_SIZE;
     setStatus('');
   }catch(_error){
     if(version===loadVersion)
       setStatus('Earlier notifications could not load. Retry Load earlier.');
   }finally{
     loadingOlder=false;
     render();
   }
 };
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()});
 const markAll=document.getElementById('markAllNotifications');
 markAll.onclick=async()=>{
   if(markAll.disabled)return;
   markAll.disabled=true;
   setStatus('Marking notifications read…');
   try{
     const result=await bounded(client.rpc('mark_my_executive_notifications_read',{target_event_id:null}),8000);
     if(result.error)throw result.error;
     const confirmed=await load();
     setStatus(confirmed
       ?'Notifications marked read.'
       :'Read update submitted, but the inbox could not refresh. Retry to confirm its status.');
   }catch(_error){
     // A timed-out RPC can still have committed on the server. Do not claim
     // it definitively failed or tell the agent to write the same change again.
     setStatus('Could not confirm the read update. Refresh the inbox to check its status.');
   }finally{markAll.disabled=false;}
 };
 list.addEventListener('click',async event=>{
   const item=event.target.closest('[data-event-id]');
   if(!item)return;
   event.preventDefault();
   const destination=item.href;
   // Opening a notification must continue to work even if the read-state
   // migration is unavailable. Never falsely update the unread counter.
   try{
     const result=await bounded(client.rpc('mark_my_executive_notifications_read',{
       target_event_id:item.dataset.eventId
     }),2500);
     if(result.error)throw result.error;
   }catch(_error){
     setStatus('Notification could not be marked read; opening its destination.');
   }
   location.href=destination;
 });
 const sound=document.getElementById('notificationSoundSetting'),browser=document.getElementById('notificationBrowserSetting');if(sound&&browser){sound.closest('.member-panel').innerHTML='<p class="eyebrow">Preferences</p><h2>Notification settings</h2><p>Manage sound, browser, email, message, and meeting alerts in one place.</p><a class="btn btn-outline" href="/account-settings/#notifications">Open Settings</a>'}document.getElementById('enableNotifications').onclick=()=>location.href='/account-settings/#notifications';
 // Realtime is an enhancement, not a prerequisite for an initial inbox.
 // Database RLS remains the authority for every displayed event.
 try{
   client.channel(`notification-center-${session.user.id}`)
     .on('postgres_changes',{
       event:'*',schema:'public',table:'executive_events',
       filter:`member_id=eq.${session.user.id}`
     },()=>void load())
     .subscribe();
 }catch(_error){console.warn('Notification live refresh unavailable.');}
 await load();
})();
