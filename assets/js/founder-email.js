(async()=>{
  const gate=document.getElementById('emailAdminGate'),app=document.getElementById('emailAdminApp');
  const form=document.getElementById('emailSettingsForm'),result=document.getElementById('emailSettingsResult');
  const queue=document.getElementById('emailQueueList'),processButton=document.getElementById('processEmailQueue');
  const refreshButton=document.getElementById('refreshEmailQueue');
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const show=(text,type='info')=>{result.textContent=text;result.className=`member-message show ${type}`;};
  const busy=(button,label)=>{button.dataset.label||=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent=label;};
  const ready=button=>{button.disabled=false;button.removeAttribute('aria-busy');button.textContent=button.dataset.label||button.textContent;};

  if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return;}
  const client=await window.DSAuth.init();
  const session=(await client.auth.getSession()).data.session;
  if(!session){location.href='/member-login/';return;}
  const profile=await client.from('member_profiles').select('role,is_founder').eq('id',session.user.id).single();
  if(profile.error||!(profile.data.role==='founder'||profile.data.is_founder===true)){gate.innerHTML='<h1>Founder access required.</h1>';return;}
  gate.classList.add('member-hidden');app.classList.remove('member-hidden');

  async function loadSettings(){
    const response=await client.from('email_delivery_settings').select('*').eq('id',true).single();
    if(response.error)throw response.error;
    form.is_enabled.checked=response.data.is_enabled;
    form.from_name.value=response.data.from_name||'DominionStar';
    form.from_email.value=response.data.from_email||'';
    form.reply_to_email.value=response.data.reply_to_email||'';
    return response.data;
  }

  async function loadQueue(){
    const response=await client.from('email_notification_outbox').select('*').order('created_at',{ascending:false}).limit(100);
    if(response.error)throw response.error;
    const rows=response.data||[];
    document.getElementById('emailPendingCount').textContent=rows.filter(item=>['pending','processing'].includes(item.status)).length;
    document.getElementById('emailSentCount').textContent=rows.filter(item=>item.status==='sent').length;
    document.getElementById('emailFailedCount').textContent=rows.filter(item=>item.status==='failed').length;
    queue.innerHTML=rows.length?rows.map(item=>`<article class="email-queue-item ${esc(item.status)}"><div><strong>${esc(item.subject)}</strong><p>${esc(item.recipient_email)} · ${esc(item.event_type)}</p><small>${new Date(item.created_at).toLocaleString()} · Attempts ${item.attempts||0}</small>${item.last_error?`<code>${esc(item.last_error)}</code>`:''}</div><span>${esc(item.status)}</span></article>`).join(''):'<div class="member-empty-state"><h2>No queued email.</h2></div>';
    return rows;
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('[type="submit"]');
    busy(button,'Saving…');show('Saving email settings…');
    try{
      const expected={id:true,provider:'resend',is_enabled:form.is_enabled.checked,from_name:form.from_name.value.trim(),from_email:form.from_email.value.trim()||null,reply_to_email:form.reply_to_email.value.trim()||null,updated_by:session.user.id,updated_at:new Date().toISOString()};
      const saved=await client.from('email_delivery_settings').upsert(expected).select('*').single();
      if(saved.error)throw saved.error;
      const verified=await loadSettings();
      if(Boolean(verified.is_enabled)!==expected.is_enabled||String(verified.from_name||'')!==expected.from_name)throw new Error('The server did not retain the saved settings.');
      show('Settings verified and refreshed.','success');
      setTimeout(()=>location.reload(),700);
    }catch(error){show(error.message||String(error),'error');ready(button);}
  });

  processButton.addEventListener('click',async()=>{
    busy(processButton,'Processing…');refreshButton.disabled=true;show('Processing the email queue…');
    try{
      const response=await fetch('/.netlify/functions/process-email-outbox',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:'{}'});
      const raw=await response.text();let payload={};try{payload=raw?JSON.parse(raw):{};}catch{payload={error:raw};}
      if(!response.ok)throw new Error(payload.error||raw||`Queue processor returned ${response.status}.`);
      await loadQueue();
      if(payload.failed)throw new Error(`Processed ${payload.processed||0}: sent ${payload.sent||0}, failed ${payload.failed}. ${payload.errors?.[0]||'Review the queue error shown below.'}`);
      show(`Queue verified: ${payload.sent||0} sent, 0 failed. Refreshing…`,'success');
      setTimeout(()=>location.reload(),900);
    }catch(error){await loadQueue().catch(()=>{});show(error.message||String(error),'error');ready(processButton);refreshButton.disabled=false;}
  });

  refreshButton.addEventListener('click',async()=>{
    busy(refreshButton,'Refreshing…');
    try{await loadQueue();show('Queue refreshed from the server.','success');}catch(error){show(error.message||String(error),'error');}finally{ready(refreshButton);}
  });

  try{await Promise.all([loadSettings(),loadQueue()]);}catch(error){show(error.message||String(error),'error');}
})();
