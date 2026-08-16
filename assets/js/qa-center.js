(async()=>{
  const gate=document.getElementById('qaGate');
  const app=document.getElementById('qaApp');
  const results=document.getElementById('qaResults');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  if(!window.DSAuth?.ready){
    gate.innerHTML='<h1>Authentication configuration is missing.</h1>';
    return;
  }

  const client=await window.DSAuth.init();
  const session=(await client.auth.getSession()).data.session;
  if(!session){location.href='/member-login/';return;}

  const founder=await client.rpc('is_dominionstar_founder');
  if(founder.error||!founder.data){
    gate.innerHTML='<h1>Founder access required.</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  async function runChecks(){
    const button=document.getElementById('runQaChecks');
    button.disabled=true;
    button.textContent='Checking…';

    const checks=[];

    const health=await client.rpc('dominionstar_release_health');
    if(health.error){
      checks.push({name:'Database health',ok:false,detail:health.error.message});
    }else{
      const data=health.data||{};
      const booleans=[
        ['Member profiles',data.member_profiles],
        ['Community posts',data.community_messages],
        ['Community comments',data.community_comments],
        ['Community chat',data.community_chat_messages],
        ['Appointments',data.member_appointments],
        ['Notifications',data.member_notifications],
        ['Feature flags',data.feature_flags],
        ['Email outbox',data.email_outbox],
        ['Email settings',data.email_settings]
      ];
      for(const [name,ok] of booleans){
        checks.push({name,ok:Boolean(ok),detail:ok?'Available':'Missing'});
      }

      checks.push({
        name:'Feature flag records',
        ok:Number(data.feature_flag_count)>0,
        detail:`${data.feature_flag_count||0} records`
      });

      checks.push({
        name:'Realtime publication',
        ok:Number(data.realtime_table_count)>=7,
        detail:`${data.realtime_table_count||0} tables`
      });

      checks.push({
        name:'Failed email deliveries',
        ok:Number(data.failed_email_count)===0,
        detail:`${data.failed_email_count||0} failed`
      });

      document.getElementById('qaEmailFailed').textContent=String(data.failed_email_count||0);
      document.getElementById('qaRealtime').textContent=String(data.realtime_table_count||0);
    }

    const relationships=await client.rpc('dominionstar_relationship_health');
    if(relationships.error){
      checks.push({
        name:'Database relationships',
        ok:false,
        detail:relationships.error.message
      });
    }else{
      const relationshipValues=Object.values(relationships.data||{});
      const relationshipCount=relationshipValues.filter(Boolean).length;
      checks.push({
        name:'Database relationships',
        ok:relationshipCount===relationshipValues.length && relationshipValues.length>0,
        detail:`${relationshipCount}/${relationshipValues.length} verified`
      });
    }

    const v65=await client.rpc('dominionstar_v65_health');
    if(v65.error){
      checks.push({
        name:'V6.5 stable data layer',
        ok:false,
        detail:v65.error.message
      });
    }else{
      const values=Object.values(v65.data||{});
      const passing=values.filter(Boolean).length;
      checks.push({
        name:'V6.5 stable data layer',
        ok:passing===values.length && values.length>0,
        detail:`${passing}/${values.length} architecture checks`
      });
    }

    const configOk=Boolean(
      window.DOMINIONSTAR_SUPABASE?.url
      && window.DOMINIONSTAR_SUPABASE?.anonKey
    );
    checks.push({
      name:'Browser Supabase configuration',
      ok:configOk,
      detail:configOk?'Configured':'Missing'
    });

    const runtimeErrors=Array.isArray(window.__DOMINIONSTAR_RUNTIME_ERRORS__)
      ? window.__DOMINIONSTAR_RUNTIME_ERRORS__.length
      : 0;

    checks.push({
      name:'Current browser session',
      ok:runtimeErrors===0,
      detail:`${runtimeErrors} runtime errors`
    });

    document.getElementById('qaRuntimeCount').textContent=String(runtimeErrors);

    const pass=checks.filter(item=>item.ok).length;
    document.getElementById('qaScore').textContent=`${pass}/${checks.length}`;

    results.innerHTML=checks.map(item=>`
      <article class="qa-result ${item.ok?'pass':'fail'}">
        <span>${item.ok?'✓':'✕'}</span>
        <div><strong>${esc(item.name)}</strong><p>${esc(item.detail)}</p></div>
      </article>
    `).join('');

    const verification=document.getElementById('founderVerification');
    const evidence=[
      {name:'Identity and access',items:['Member profiles','Browser Supabase configuration','Current browser session']},
      {name:'Community and communication',items:['Community posts','Community comments','Community chat']},
      {name:'Appointments and notifications',items:['Appointments','Notifications','Realtime publication']},
      {name:'Email delivery',items:['Email outbox','Email settings','Failed email deliveries']},
      {name:'Data integrity',items:['Database relationships','V6.5 stable data layer']}
    ];
    verification.innerHTML=evidence.map(group=>{
      const related=checks.filter(check=>group.items.includes(check.name));
      const ok=related.length===group.items.length&&related.every(check=>check.ok);
      const detail=related.map(check=>`${check.name}: ${check.detail}`).join(' · ');
      return `<article class="qa-verification-row ${ok?'pass':'fail'}"><span class="qa-verification-icon">${ok?'✓':'!'}</span><div><strong>${esc(group.name)}</strong><p>${esc(detail||'No evidence returned.')}</p></div></article>`;
    }).join('');

    button.disabled=false;
    button.textContent='Run All Checks';
  }

  document.getElementById('runQaChecks').addEventListener('click',runChecks);

  document.getElementById('testNotification').addEventListener('click',async()=>{
    const r=await client.rpc('dominionstar_test_notification');
    alert(r.error?r.error.message:'Test notification created. Open Notification Center to confirm it.');
  });

  await runChecks();
})();
