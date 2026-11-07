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
 // The email delivery destination is Supabase Auth's verified address on
 // file, never a member-entered email in profile fields or a post payload.
 const priorityEmailDestination=$('priorityNotificationEmail');
 if(priorityEmailDestination){
   db.auth.getUser().then(result=>{
     if(result.error||!result.data?.user||result.data.user.id!==session.user.id){
       throw new Error('Verified email could not be checked');
     }
     const account=result.data.user;
     priorityEmailDestination.textContent=
       account.email&&account.email_confirmed_at
       ? account.email+' (verified)'
       : 'No verified email. Verify your sign-in email to receive priority alerts.';
   }).catch(()=>{
     priorityEmailDestination.textContent=
       'Verification unavailable. Refresh to confirm your email destination.';
   });
 }
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
 // Under the approved data cutover, directory visibility is a database rule,
 // never a trust decision based on user-editable auth metadata.
 const publicDirectoryV2=window.DOMINIONSTAR_AGENT_DATA_FEATURES?.publicMemberProfilesV2===true;
 let serverDirectoryVisibilityReady=!publicDirectoryV2;
 let serverDirectoryVisibilityError='';
 if(publicDirectoryV2){
   try{
     const v=await db.from('member_profiles')
       .select('profile_visibility').eq('id',session.user.id).single();
     if(v.error)throw v.error;
     if(!['private','members'].includes(v.data?.profile_visibility))throw new Error('Unrecognized privacy setting');
     state.privacy.directoryVisible=v.data.profile_visibility==='members';
     serverDirectoryVisibilityReady=true;
   }catch(error){
     serverDirectoryVisibilityError=error.message||'Server privacy setting is unavailable';
   }
 }
 try{const r=await db.from('notification_preferences').select('email_enabled,announcements_email_enabled,messages_email_enabled,community_email_enabled,appointments_email_enabled').eq('user_id',session.user.id).maybeSingle();if(r.data)Object.assign(state.notifications,{emailEnabled:r.data.email_enabled,announcements:r.data.announcements_email_enabled,messages:r.data.messages_email_enabled,community:r.data.community_email_enabled,appointments:r.data.appointments_email_enabled})}catch(_){}
 state.notifications.browser=localStorage.getItem('ds_browser_notifications')==='on';state.notifications.sound=localStorage.getItem('ds_comm_sounds')!=='off';$('theme').value=state.appearance.theme;$('textSize').value=state.appearance.textSize;
 const status=(id,text,kind='')=>{const n=$(id);n.textContent=text;n.dataset.state=kind};
 const row=(root,key,label,note,checked,onchange)=>{const wrap=document.createElement('label');wrap.className='settings-switch-row';wrap.innerHTML=`<span><strong>${label}</strong><small>${note}</small></span><span class="settings-switch"><input type="checkbox" ${checked?'checked':''} aria-label="${label}"><i></i></span>`;const input=wrap.querySelector('input');input.onchange=()=>onchange(input,key);$(root).append(wrap);return input};
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
 const webPushReady=window.DOMINIONSTAR_NOTIFICATION_FEATURES?.webPush===true;
 const notificationRows=[
   ['emailEnabled','Selected email alerts','Deliver only eligible priority events to my verified account email.'],
   ['announcements','Founder & critical announcements','Email urgent official announcements; routine updates remain in-app.'],
   ['appointments','Appointments & schedule changes','Email confirmations, reschedules, and cancellations; not every calendar update.'],
   ['browser',webPushReady?'Push notifications':'Browser alerts',webPushReady?'Show DominionStar system notifications on this device, including when the dashboard is closed.':'Show system alerts on this device while DominionStar is open.'],
   ['sound','Notification sounds','Play a short DominionStar tone for live priority notifications.']
 ];
 notificationRows.forEach(x=>row('notificationSwitches',...x,state.notifications[x[0]],async(i,k)=>{
   const before=!i.checked;
   try{
     if(k==='browser'){
       if(i.checked){
         const permission=await window.CommunicationEngine?.requestPermission?.();
         if(permission!=='granted')throw new Error('Browser notification permission was not granted.');
         if(webPushReady){
           const push=await window.CommunicationEngine?.enablePushSubscription?.();
           if(push?.status!=='subscribed')throw new Error('This device could not register for push notifications.');
         }
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
 const savePrivacySwitch=async(input,key)=>{
   if(key!=='directoryVisible'||!publicDirectoryV2){
     toggle('privacy','securityResult')(input,key);
     return;
   }
   const desired=input.checked,prior=!desired;
   input.disabled=true;
   status('securityResult','Saving server-enforced member directory visibility…','saving');
   let accepted=false,confirmed=false;
   try{
     if(!serverDirectoryVisibilityReady)throw new Error('Server privacy setting is unavailable. Refresh before changing it.');
     const value=desired?'members':'private';
     const changed=await db.rpc('set_my_member_directory_visibility',{target_visibility:value});
     if(changed.error)throw changed.error;
     accepted=true;
     const verified=await db.from('member_profiles')
       .select('profile_visibility').eq('id',session.user.id).single();
     if(verified.error||verified.data?.profile_visibility!==value){
       throw new Error('Server did not confirm directory visibility. Refresh to verify.');
     }
     confirmed=true;
     state.privacy.directoryVisible=desired;
     if(!await saveMetadata('privacy',{...state.privacy},'securityResult')){
       status('securityResult','Server visibility saved; account preference synchronization needs a refresh.','warning');
     }else{
       status('securityResult',desired?'Visible only in the approved member directory.':'Removed from the approved member directory.','saved');
     }
   }catch(error){
     if(accepted){
       // Never claim a remote database change was rolled back without proof.
       state.privacy.directoryVisible=desired;
       status('securityResult','The server accepted the visibility change but verification failed. Refresh before changing it again.','warning');
     }else{
       input.checked=prior;
       state.privacy.directoryVisible=prior;
       status('securityResult',error?.message||'Could not change directory visibility.','error');
     }
   }finally{
     // Keep the control blocked when a server write cannot be verified.
     input.disabled=accepted&&!confirmed;
   }
 };
 const privacyRows=[
   ['directoryVisible','Member directory','Show my approved profile in the member directory.'],
   ['onlineVisible','Online presence','Let approved members see when I am online.'],
   ['allowMessages','Member messages','Allow approved members to message me.']
 ];
 privacyRows.forEach(x=>{
   const control=row('privacySwitches',...x,state.privacy[x[0]],savePrivacySwitch);
   if(x[0]==='directoryVisible'&&publicDirectoryV2&&!serverDirectoryVisibilityReady){
     control.disabled=true;
   }
 });
 if(publicDirectoryV2&&!serverDirectoryVisibilityReady){
   status('securityResult',serverDirectoryVisibilityError||'Server privacy setting unavailable; directory control disabled.','error');
 }
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
