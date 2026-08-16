(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const shell=$('#workspaceShell'),menu=$('#mobileMenu'),search=$('#globalSearch'),results=$('#searchResults'),toast=$('#toast');
const dialog=$('#workspaceProfileDialog'),form=$('#workspaceProfileForm'),fileInput=$('#workspaceAvatarInput'),preview=$('#workspaceAvatarPreview'),status=$('#workspaceProfileStatus');
const index=[['Dashboard','/workspace/'],['Meet','/meet/'],['Drive','/workspace/drive/'],['Chat','/workspace/chat/'],['Calendar','/workspace/calendar/'],['Tasks','/workspace/tasks/'],['Contacts','/workspace/contacts/'],['Aurora','/workspace/aurora/'],['Settings','/account-settings/']];
const profileState={client:null,session:null,profile:null,avatarPath:'',avatarUrl:'',previewUrl:''};
const showToast=t=>{toast.textContent=t;toast.hidden=false;clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.hidden=true,1400)};
const setStatus=(text='',kind='')=>{if(!status)return;status.textContent=text;status.className=`workspace-profile-status${kind?` ${kind}`:''}`};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=name=>String(name||'DominionStar Member').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'DM';
const setAvatar=(url,name)=>{const letters=initials(name||profileState.profile?.preferred_name||profileState.profile?.full_name);$$('[data-workspace-avatar]').forEach(img=>{img.hidden=!url;img.src=url||''});$$('[data-workspace-initials]').forEach(node=>{node.hidden=Boolean(url);node.textContent=letters});if(preview){preview.hidden=!url;preview.src=url||''}const pi=$('#workspaceAvatarPreviewInitials');if(pi){pi.hidden=Boolean(url);pi.textContent=letters}};
const resolveAvatar=async path=>{if(!path||!profileState.client)return '';try{const signed=await profileState.client.storage.from('member-avatars').createSignedUrl(path,60*60*24*7);return signed.data?.signedUrl||''}catch(_){return ''}};
const loadProfile=async()=>{
  try{
    profileState.client=await window.DSAuth?.init?.();
    profileState.session=profileState.client?(await profileState.client.auth.getSession()).data.session:null;
    if(!profileState.session)return null;
    const result=await profileState.client.from('member_profiles').select('full_name,preferred_name,avatar_path,rank,role,is_founder').eq('id',profileState.session.user.id).maybeSingle();
    if(result.error)throw result.error;
    profileState.profile=result.data||{}; profileState.avatarPath=profileState.profile.avatar_path||'';
    profileState.avatarUrl=await resolveAvatar(profileState.avatarPath);
    setAvatar(profileState.avatarUrl,profileState.profile.preferred_name||profileState.profile.full_name);
    const name=profileState.profile.preferred_name||profileState.profile.full_name||'DominionStar';
    if($('#workspaceProfileName'))$('#workspaceProfileName').textContent=name;
    if($('#workspaceProfileLevel'))$('#workspaceProfileLevel').textContent=(profileState.profile.is_founder||profileState.profile.role==='founder')?`Founder · ${profileState.profile.rank||'SMD'}`:(profileState.profile.rank||'Member');
    if($('#workspaceDialogLevel'))$('#workspaceDialogLevel').textContent=(profileState.profile.is_founder||profileState.profile.role==='founder')?`Founder · ${profileState.profile.rank||'SMD'}`:(profileState.profile.rank||'Member');
    if($('#workspaceGreetingName'))$('#workspaceGreetingName').textContent=name;
    return profileState.profile;
  }catch(error){console.warn('Workspace profile unavailable',error);return null;}
};
const loadWeather=()=>{
  const node=$('#workspaceWeather');if(!node)return;
  if(!navigator.geolocation){node.textContent='Weather unavailable';return;}
  navigator.geolocation.getCurrentPosition(async position=>{
    try{const q=new URLSearchParams({lat:String(position.coords.latitude),lon:String(position.coords.longitude)});const response=await fetch(`/.netlify/functions/workspace-weather?${q}`,{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();node.textContent=`${data.icon||'•'} ${Math.round(Number(data.temperature))}°F · ${data.label||'Current weather'}`;}catch(_){node.textContent='Weather unavailable';}
  },()=>{node.textContent='Weather unavailable';},{maximumAge:15*60*1000,timeout:5000});
};
const loadLiveOverview=async()=>{
  const hour=new Date().getHours();if($('#workspaceGreeting'))$('#workspaceGreeting').textContent=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  if(!profileState.client||!profileState.session){$('#workspaceOverviewStatus').textContent='Sign in to load live Workspace information.';return;}
  const userId=profileState.session.user.id,now=new Date().toISOString();
  const meetingsPromise=profileState.client.from('meet_scheduled_meetings').select('id,topic,starts_at,duration_minutes,join_url',{count:'exact'}).eq('user_id',userId).gte('starts_at',now).order('starts_at',{ascending:true}).limit(5);
  const unreadPromise=profileState.client.from('direct_messages').select('id',{count:'exact',head:true}).eq('recipient_id',userId).is('read_at',null).eq('is_deleted',false);
  const [meetingsResult,unreadResult]=await Promise.allSettled([meetingsPromise,unreadPromise]);
  const meetings=meetingsResult.status==='fulfilled'&&!meetingsResult.value.error?(meetingsResult.value.data||[]):null;
  const meetingCount=meetingsResult.status==='fulfilled'&&!meetingsResult.value.error?Number(meetingsResult.value.count??meetings.length):null;
  const unread=unreadResult.status==='fulfilled'&&!unreadResult.value.error?Number(unreadResult.value.count||0):null;
  $('#workspaceMeetingCount').textContent=meetingCount===null?'—':String(meetingCount);
  $('#workspaceUnreadCount').textContent=unread===null?'—':String(unread);
  const upcoming=$('#workspaceUpcoming');
  if(meetings===null)upcoming.innerHTML='<b>Schedule unavailable</b><small>Could not verify meetings right now.</small>';
  else if(!meetings.length)upcoming.innerHTML='<b>No upcoming meetings</b><small>Your live schedule is clear.</small>';
  else upcoming.innerHTML=meetings.map(item=>`<a class="workspace-live-meeting" href="${esc(item.join_url||'/meet/')}"><b>${esc(item.topic||'Meeting')}</b><small>${new Date(item.starts_at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}</small></a>`).join('');
  $('#workspaceOverviewStatus').textContent=[meetingCount===null?'Schedule unavailable':`${meetingCount} upcoming meeting${meetingCount===1?'':'s'}`,unread===null?'messages unavailable':`${unread} unread message${unread===1?'':'s'}`].join(' · ');
  $('#workspaceFileCount').textContent='—';$('#workspaceTaskCount').textContent='—';
  loadWeather();
};
const openProfile=async()=>{await loadProfile();if(dialog?.showModal)dialog.showModal();else dialog?.setAttribute('open','');setStatus(profileState.session?'Choose a JPG, PNG, or WebP image up to 5 MB.':'Sign in to change your profile picture.',profileState.session?'':'error')};
const closeProfile=()=>{if(profileState.previewUrl){URL.revokeObjectURL(profileState.previewUrl);profileState.previewUrl=''}fileInput&&(fileInput.value='');setAvatar(profileState.avatarUrl);if(dialog?.open)dialog.close();else dialog?.removeAttribute('open')};
menu?.addEventListener('click',()=>shell.classList.toggle('nav-open'));
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!a.target){const href=a.getAttribute('href');if(href&&href.startsWith('/'))showToast(`Opening ${a.textContent.trim().replace(/\s+/g,' ')}`)}if(innerWidth<721&&e.target.closest('.sidebar a'))shell.classList.remove('nav-open');if(!e.target.closest('.search'))results.hidden=true});
function render(q){q=q.trim().toLowerCase();if(!q){results.hidden=true;return}const hits=index.filter(x=>x[0].toLowerCase().includes(q));results.innerHTML=(hits.length?hits:[['No results','#']]).map(x=>`<a href="${x[1]}">${x[0]}</a>`).join('');results.hidden=false}
search?.addEventListener('input',e=>render(e.target.value));
$('.meetings-panel .panel-title button')?.addEventListener('click',loadLiveOverview);
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='/'){e.preventDefault();search.focus()}if(e.key==='Escape'){results.hidden=true;shell.classList.remove('nav-open');if(dialog?.open)closeProfile()}});
$('#customize')?.addEventListener('click',openProfile); $('#profileButton')?.addEventListener('click',openProfile); $('#workspaceAvatarButton')?.addEventListener('click',openProfile);
$('#closeWorkspaceProfile')?.addEventListener('click',closeProfile); $('#cancelWorkspaceProfile')?.addEventListener('click',closeProfile);
$('#chooseWorkspaceAvatar')?.addEventListener('click',()=>fileInput?.click());
fileInput?.addEventListener('change',()=>{const file=fileInput.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setStatus('Use a JPG, PNG, or WebP image.','error');fileInput.value='';return}if(file.size>5*1024*1024){setStatus('The picture must be 5 MB or smaller.','error');fileInput.value='';return}if(profileState.previewUrl)URL.revokeObjectURL(profileState.previewUrl);profileState.previewUrl=URL.createObjectURL(file);preview.hidden=false;preview.src=profileState.previewUrl;$('#workspaceAvatarPreviewInitials')?.setAttribute('hidden','');setStatus('Preview ready. Save changes to upload it.');});
form?.addEventListener('submit',async e=>{
  e.preventDefault(); const file=fileInput?.files?.[0]; if(!profileState.session||!profileState.client){setStatus('Sign in to update your picture.','error');return} if(!file){setStatus('Choose a picture first.','error');return}
  const save=form.querySelector('.workspace-profile-save');save.disabled=true;setStatus('Uploading picture…');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'; const newPath=`${profileState.session.user.id}/workspace-${Date.now()}.${ext}`; const previous=profileState.avatarPath;
  try{
    const uploaded=await profileState.client.storage.from('member-avatars').upload(newPath,file,{contentType:file.type,cacheControl:'3600',upsert:false}); if(uploaded.error)throw uploaded.error;
    const updated=await profileState.client.from('member_profiles').update({avatar_path:newPath,updated_at:new Date().toISOString()}).eq('id',profileState.session.user.id); if(updated.error){await profileState.client.storage.from('member-avatars').remove([newPath]).catch(()=>{});throw updated.error}
    profileState.avatarPath=newPath; profileState.avatarUrl=await resolveAvatar(newPath); setAvatar(profileState.avatarUrl);
    if(previous&&previous!==newPath)profileState.client.storage.from('member-avatars').remove([previous]).catch(()=>{});
    if(profileState.previewUrl){URL.revokeObjectURL(profileState.previewUrl);profileState.previewUrl=''} fileInput.value=''; setStatus('Profile picture updated.','success');showToast('Profile picture updated');setTimeout(()=>{if(dialog.open)dialog.close()},700);
  }catch(error){setStatus(`Upload failed: ${error?.message||'Please try again.'}`,'error');}
  finally{save.disabled=false;}
});
$('#notifications')?.addEventListener('click',()=>{const count=$('#workspaceUnreadCount')?.textContent;showToast(count==='0'?'No unread messages.':count&&count!=='—'?`${count} unread message${count==='1'?'':'s'}.`:'Notifications unavailable.');});
const d=new Date();$('#workspaceDate').textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
loadProfile().then(loadLiveOverview);
})();
