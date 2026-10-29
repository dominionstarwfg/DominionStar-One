(async()=>{
 const $=id=>document.getElementById(id),gate=$('settingsGate'),app=$('settingsApp');
 if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return}
 let db,sessionResult;
 try{
   db=await DSAuth.init();
   if(!db)throw new Error('Authentication initialization failed.');
   sessionResult=await db.auth.getSession();
 }catch(_error){
   gate.textContent='Unable to verify your account session. Check your connection and refresh.';
   return;
 }
 if(sessionResult.error){
   gate.textContent='The secure session could not be verified. Refresh and sign in again if needed.';
   return;
 }
 const session=sessionResult.data?.session;
 if(!session?.user?.id){location.href='/member-login/';return}
 // A valid Auth session is not proof of Founder-approved membership.
 // Keep the agent controls hidden until an authoritative profile read succeeds.
 let membership;
 try{
   membership=await db.from('member_profiles')
     .select('verification_status').eq('id',session.user.id).maybeSingle();
 }catch(_error){membership={error:new Error('Membership lookup unavailable.')}};
 if(membership.error||membership.data?.verification_status!=='approved'){
   gate.textContent=membership.error
     ? 'Unable to verify membership. Refresh or sign in again.'
     : 'Agent Settings is available after Founder approval. Your account is not yet approved.';
   return;
 }
 gate.classList.add('member-hidden');app.classList.remove('member-hidden');$('currentSessionEmail').textContent=session.user.email||'Signed-in member';
 await window.CommunicationEngine?.init?.({client:db,session}).catch(()=>{});
 const tabs=[...document.querySelectorAll('[data-settings-tab]')];
 tabs.forEach(b=>b.onclick=()=>{
   tabs.forEach(x=>x.classList.toggle('active',x===b));
   document.querySelectorAll('[data-settings-panel]').forEach(x=>x.classList.toggle('active',x.dataset.settingsPanel===b.dataset.settingsTab));
   history.replaceState(null,'','#'+b.dataset.settingsTab);
 });
 // Avoid constructing a CSS selector from untrusted URL hash content.
 const initialTab=location.hash.slice(1);
 tabs.find(t=>t.dataset.settingsTab===initialTab)?.click();
 let settings=session.user.user_metadata?.dominionstar_settings||{};
 const defaults={appearance:{theme:'system',textSize:'standard',reduceMotion:false},privacy:{directoryVisible:true,onlineVisible:true,allowMessages:true},notifications:{emailEnabled:true,announcements:true,messages:false,community:false,appointments:true,browser:false,sound:true}};
 const state={appearance:{...defaults.appearance,...settings.appearance},privacy:{...defaults.privacy,...settings.privacy},notifications:{...defaults.notifications,...settings.notifications}};
 try{const r=await db.from('notification_preferences').select('email_enabled,announcements_email_enabled,messages_email_enabled,community_email_enabled,appointments_email_enabled').eq('user_id',session.user.id).maybeSingle();if(r.data)Object.assign(state.notifications,{emailEnabled:r.data.email_enabled,announcements:r.data.announcements_email_enabled,messages:r.data.messages_email_enabled,community:r.data.community_email_enabled,appointments:r.data.appointments_email_enabled})}catch(_){}
 state.notifications.browser=localStorage.getItem('ds_browser_notifications')==='on';state.notifications.sound=localStorage.getItem('ds_comm_sounds')!=='off';$('theme').value=state.appearance.theme;$('textSize').value=state.appearance.textSize;
 const status=(id,text,kind='')=>{const n=$(id);n.textContent=text;n.dataset.state=kind};
 const row=(root,key,label,note,checked,onchange)=>{const wrap=document.createElement('label');wrap.className='settings-switch-row';wrap.innerHTML=`<span><strong>${label}</strong><small>${note}</small></span><span class="settings-switch"><input type="checkbox" ${checked?'checked':''} aria-label="${label}"><i></i></span>`;const input=wrap.querySelector('input');input.onchange=()=>onchange(input,key);$(root).append(wrap)};
 const lock=value=>{app.setAttribute('aria-busy',String(value));document.querySelectorAll('.settings-switch input,.settings-field select').forEach(x=>x.disabled=value)};
 const confirms=(actual,expected)=>actual&&Object.entries(expected).every(([key,value])=>typeof value==='object'&&value!==null?confirms(actual[key],value):actual[key]===value);
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const saveMetadata=async(section,value,result)=>{status(result,'Saving and checking…','saving');lock(true);try{const current=await db.auth.getUser();if(current.error)throw current.error;const prior=current.data.user.user_metadata?.dominionstar_settings||{};const merged={...prior,[section]:section==='notifications'?{...(prior.notifications||{}),...value}:value};const update=await db.auth.updateUser({data:{dominionstar_settings:merged}});if(update.error)throw update.error;let fresh,verified;for(let attempt=0;attempt<3;attempt++){if(attempt)await pause(250*(attempt+1));fresh=await db.auth.getUser();if(fresh.error)throw fresh.error;verified=fresh.data.user.user_metadata?.dominionstar_settings?.[section];if(confirms(verified,value))break}if(!confirms(verified,value))throw new Error('The saved value could not be verified. Your previous setting was restored.');session.user.user_metadata=fresh.data.user.user_metadata;settings=fresh.data.user.user_metadata?.dominionstar_settings||merged;status(result,'Saved and verified ✓','saved');return true}catch(e){status(result,e.message||'Could not save. Your previous setting was restored.','error');return false}finally{lock(false)}};
 const saveNotification=async(resultId='notificationsResult')=>{
   status(resultId,'Saving and verifying agent notifications…','saving');
   lock(true);
   let writeAccepted=false, serverVerified=false;
   try{
     const n=state.notifications;
     // Agent settings must not update Meet's meeting_room_email_enabled column.
     // Existing rows are updated selectively; new rows use the server's default
     // for Meet notifications. Fail closed if the database cannot accept that.
     const payload={
       email_enabled:n.emailEnabled,
       announcements_email_enabled:n.announcements,
       messages_email_enabled:n.messages,
       community_email_enabled:n.community,
       appointments_email_enabled:n.appointments,
       updated_at:new Date().toISOString()
     };
     const existing=await db.from('notification_preferences')
       .select('user_id').eq('user_id',session.user.id).maybeSingle();
     if(existing.error)throw existing.error;
     const written=existing.data
       ? await db.from('notification_preferences')
           .update(payload).eq('user_id',session.user.id).select('user_id').maybeSingle()
       : await db.from('notification_preferences')
           .insert({user_id:session.user.id,...payload}).select('user_id').maybeSingle();
     if(written.error)throw written.error;
     if(!written.data?.user_id)throw new Error('The server did not confirm the notification update.');
     writeAccepted=true;
     const r=await db.from('notification_preferences')
       .select('email_enabled,announcements_email_enabled,messages_email_enabled,community_email_enabled,appointments_email_enabled')
       .eq('user_id',session.user.id).single();
     if(r.error)throw r.error;
     for(const [a,b] of [
       ['emailEnabled','email_enabled'],['announcements','announcements_email_enabled'],
       ['messages','messages_email_enabled'],['community','community_email_enabled'],
       ['appointments','appointments_email_enabled']
     ])if(Boolean(r.data[b])!==Boolean(n[a]))
       throw new Error('The server did not confirm every agent notification preference.');
     serverVerified=true;
     localStorage.setItem('ds_comm_sounds',n.sound?'on':'off');
     localStorage.setItem('ds_browser_notifications',n.browser?'on':'off');
     const ok=await saveMetadata('notifications',{...n},resultId);
     if(!ok)throw new Error('Agent notification metadata verification failed.');
     status(resultId,'Agent notifications saved and verified ✓','saved');
     return true;
   }catch(e){
     if(serverVerified){
       status(resultId,'Agent notifications saved in the database, but account preference sync needs attention. Refresh to verify.','warning');
       return true; // Keep the controls in sync with the verified database update.
     }
     if(writeAccepted){
       status(resultId,'The server accepted the notification change, but confirmation failed. Refresh to check the latest values.','warning');
       return true; // Do not claim the previous selection was restored.
     }
     status(resultId,e.message||'Could not save agent notifications.','error');
     return false;
   }finally{lock(false);}
 };
 const toggle=(section,result)=>(input,key)=>{const before=!input.checked;state[section][key]=input.checked;saveMetadata(section,{...state[section]},result).then(ok=>{if(!ok){input.checked=before;state[section][key]=before}})};
 row('systemSwitches','reduceMotion','Reduce motion','Limit non-essential animation.',state.appearance.reduceMotion,toggle('appearance','systemResult'));
 row('messageSwitches','messages','Private-message email alerts','Email me when an approved member sends a message.',state.notifications.messages,async(i,k)=>{const before=!i.checked;state.notifications[k]=i.checked;if(!await saveNotification('messagesResult')){i.checked=before;state.notifications[k]=before}});row('messageSwitches','community','Community replies and mentions','Email me for replies and mentions.',state.notifications.community,async(i,k)=>{const before=!i.checked;state.notifications[k]=i.checked;if(!await saveNotification('messagesResult')){i.checked=before;state.notifications[k]=before}});
 const notificationRows=[
   ['emailEnabled','Selected email alerts','Use my verified email only for the alert categories enabled below.'],
   ['announcements','Founder & critical announcements','Email important official platform announcements.'],
   ['appointments','Appointments & schedule changes','Email appointment confirmations, changes, and cancellations.'],
   ['browser','Push notifications','Show DominionStar system notifications on this device, including when the dashboard is closed.'],
   ['sound','Notification sounds','Play a short DominionStar tone for live priority notifications.']
 ];
 notificationRows.forEach(x=>row('notificationSwitches',...x,state.notifications[x[0]],async(i,k)=>{
   const before=!i.checked;
   try{
     if(k==='browser'){
       if(i.checked){
         const permission=await window.CommunicationEngine?.requestPermission?.();
         if(permission!=='granted')throw new Error('Browser notification permission was not granted.');
         const push=await window.CommunicationEngine?.enablePushSubscription?.();
         if(push?.status!=='subscribed')throw new Error('This device could not register for push notifications.');
       }else{
         await window.CommunicationEngine?.disablePushSubscription?.();
       }
     }
     state.notifications[k]=i.checked;
     if(!await saveNotification())throw new Error('Notification preference verification failed.');
   }catch(error){
     i.checked=before;
     state.notifications[k]=before;
     if(k==='browser'&&before)await window.CommunicationEngine?.enablePushSubscription?.().catch(()=>{});
     if(k==='browser'&&!before)await window.CommunicationEngine?.disablePushSubscription?.().catch(()=>{});
     status('notificationsResult',error?.message||'Could not update notifications.','error');
   }
 }));
 [['directoryVisible','Member directory','Show my approved profile in the member directory.'],['onlineVisible','Online presence','Let approved members see when I am online.'],['allowMessages','Member messages','Allow approved members to message me.']].forEach(x=>row('privacySwitches',...x,state.privacy[x[0]],toggle('privacy','securityResult')));
 const saveAppearance=async()=>{
   const before={...state.appearance};
   const requested={...state.appearance,theme:$('theme').value,textSize:$('textSize').value};
   const verified=await saveMetadata('appearance',requested,'systemResult');
   if(verified){
     Object.assign(state.appearance,requested);
     localStorage.setItem('ds.theme',requested.theme);
     localStorage.setItem('ds.textSize',requested.textSize);
   }else{
     Object.assign(state.appearance,before);
     $('theme').value=before.theme;
     $('textSize').value=before.textSize;
   }
 };
 $('theme').onchange=saveAppearance;
 $('textSize').onchange=saveAppearance;
 $('testSound').onclick=()=>window.CommunicationEngine?.play?.('priority');$('passwordForm').onsubmit=async e=>{e.preventDefault();if($('newPassword').value!==$('confirmPassword').value){status('securityResult','Passwords do not match.','error');return}status('securityResult','Updating password…','saving');const r=await db.auth.updateUser({password:$('newPassword').value});status('securityResult',r.error?r.error.message:'Password updated ✓',r.error?'error':'saved');if(!r.error)e.target.reset()};$('signOutOtherSessions').onclick=async()=>{status('sessionsResult','Signing out…','saving');await window.CommunicationEngine?.disablePushSubscription?.().catch(()=>{});const r=await db.auth.signOut({scope:'global'});if(r.error)status('sessionsResult',r.error.message,'error');else location.href='/member-login/'};
})();
