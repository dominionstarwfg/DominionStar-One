(async()=>{
 const gate=document.getElementById('notificationGate'),app=document.getElementById('notificationApp'),list=document.getElementById('notificationList');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication unavailable.</h1>';return}
 const client=await DSAuth.init(),session=(await client.auth.getSession()).data.session;if(!session){location.href='/member-login/';return}
 await CommunicationEngine.init({client,session}); gate.classList.add('member-hidden');app.classList.remove('member-hidden');
 let events=[],filter='all';
 const category=e=>e.event_type?.startsWith('call.')?'calls':e.event_type?.startsWith('message.')?'communications':(e.event_type?.startsWith('meeting.')||e.event_type?.startsWith('appointment.'))?'meetings':e.event_type?.startsWith('journey.')?'journey':e.event_type?.startsWith('recognition.')?'recognition':'communications';
 const notificationPaths={
  calls:'<path d="M6.6 2.5 9 7.2 6.9 9.3c1.1 2.3 2.9 4.1 5.2 5.2l2.1-2.1 4.7 2.4c.4.2.6.6.5 1-.4 2.4-2.5 4.2-5 4.2C8.6 20 4 15.4 4 9.6c0-2.5 1.8-4.6 4.2-5 .4-.1.8.1 1 .5Z"/>',
  communications:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8Z"/>',
  meetings:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  journey:'<path d="M5 19 19 5M8 5h11v11"/><circle cx="6" cy="18" r="2"/>',
  recognition:'<path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 0 4-4M12 14v7M8 21h8"/>'
 };
 const icon=e=>'<svg class="dsx-notice-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+notificationPaths[category(e)]+'</svg>';
 const render=()=>{const shown=events.filter(e=>filter==='all'||category(e)===filter); list.innerHTML=shown.length?shown.map(e=>`<a class="notification-item notification-${category(e)} ${e.event_type==='call.missed'?'notification-missed ':''}${e.read_at?'':'unread'}" data-event-id="${esc(e.id)}" href="${esc(CommunicationEngine.safeActionUrl?.(e.payload?.action_url||'/member-dashboard/')||'/member-dashboard/')}"><span class="notification-item-icon">${icon(e)}</span><div><strong>${esc(e.title)}</strong><p>${esc(e.description||'')}</p><small>${new Date(e.created_at).toLocaleString()}</small></div>${e.read_at?'':'<b>New</b>'}</a>`).join(''):'<div class="member-empty-state"><h2>All clear.</h2><p>No notifications in this category.</p></div>'; const unread=events.filter(e=>!e.read_at).length;document.getElementById('notificationUnread').textContent=unread;document.getElementById('notificationMissed').textContent=events.filter(e=>e.event_type==='call.missed').length;document.getElementById('notificationToday').textContent=events.filter(e=>Date.now()-new Date(e.created_at)<86400000).length;CommunicationEngine.setBadge(unread)};
 const load=async()=>{const r=await client.from('executive_events').select('*').eq('member_id',session.user.id).order('created_at',{ascending:false}).limit(100);if(r.error){list.innerHTML=`<div class="dashboard-load-error"><strong>Inbox unavailable.</strong><p>${esc(r.error.message)}</p></div>`;return}events=r.data||[];render()};
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()});
 document.getElementById('markAllNotifications').onclick=async()=>{await client.rpc('mark_my_executive_notifications_read',{target_event_id:null});await load()};
 list.addEventListener('click',async event=>{const item=event.target.closest('[data-event-id]');if(!item)return;event.preventDefault();await client.rpc('mark_my_executive_notifications_read',{target_event_id:item.dataset.eventId});location.href=item.href});
 const sound=document.getElementById('notificationSoundSetting'),browser=document.getElementById('notificationBrowserSetting');if(sound&&browser){sound.closest('.member-panel').innerHTML='<p class="eyebrow">Preferences</p><h2>Notification settings</h2><p>Manage sound, browser, email, message, and meeting alerts in one place.</p><a class="btn btn-outline" href="/account-settings/#notifications">Open Settings</a>'}document.getElementById('enableNotifications').onclick=()=>location.href='/account-settings/#notifications';
 client.channel(`notification-center-${session.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'executive_events',filter:`member_id=eq.${session.user.id}`},load).subscribe();await load();
})();
