(async()=>{
  const gate=document.getElementById('agentJourneyGate');
  const app=document.getElementById('agentJourneyApp');
  if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return}
  let db;
  try{db=await DSAuth.init()}catch(_error){gate.innerHTML='<h1>Unable to verify your session.</h1>';return}
  const sessionResult=await db.auth.getSession();
  const session=sessionResult.data?.session;
  if(!session?.user?.id){location.href='/member-login/';return}
  const profile=await db.from('member_profiles').select('verification_status,preferred_name,full_name,rank').eq('id',session.user.id).maybeSingle();
  if(profile.error||profile.data?.verification_status!=='approved'){
    gate.innerHTML='<p class="eyebrow">Member Journey</p><h1>Journey is available after Founder approval.</h1>';
    return;
  }
  gate.classList.add('member-hidden');app.classList.remove('member-hidden');

  const routes={
    leadership_path:'/leadership/',
    academy:'/academy/',
    financial_services:'/financial-services/',
    mindset_center:'/mindset-center/',
    team_directory:'/member-directory/',
    beta_feedback:'/member-dashboard/#memberFeedbackForm'
  };
  const descriptions={
    leadership_path:'Review the leadership path and expectations for your current stage.',
    academy:'Continue learning through DominionStar education and training resources.',
    financial_services:'Review the financial-services education ecosystem and client-development resources.',
    mindset_center:'Build discipline, service, leadership, and long-term professional habits.',
    team_directory:'Connect with approved DominionStar team members.',
    beta_feedback:'Help improve the platform by submitting practical feedback.'
  };
  const list=document.getElementById('agentJourneyList');
  const refresh=document.getElementById('agentJourneyRefresh');

  const load=async()=>{
    refresh.disabled=true;
    await db.rpc('ensure_default_milestones',{target_user_id:session.user.id});
    const result=await db.from('member_milestones')
      .select('id,milestone_key,title,completed,completed_at')
      .eq('user_id',session.user.id).order('title');
    refresh.disabled=false;
    if(result.error){list.innerHTML='<p>Journey could not load. '+String(result.error.message||'')+'</p>';return}
    const items=result.data||[];
    const completed=items.filter(item=>item.completed).length;
    const percent=items.length?Math.round(completed/items.length*100):0;
    document.getElementById('agentJourneyPercent').textContent=percent+'%';
    document.getElementById('agentJourneyBar').style.width=percent+'%';
    document.getElementById('agentJourneyCount').textContent=completed+' of '+items.length+' milestones completed';

    const next=items.find(item=>!item.completed);
    document.getElementById('agentJourneyNext').textContent=next?.title||'Current Journey complete';
    document.getElementById('agentJourneyNextNote').textContent=next?descriptions[next.milestone_key]||'Continue your professional development.':'All current platform milestones are complete.';
    const nextAction=document.getElementById('agentJourneyNextAction');
    nextAction.href=next?routes[next.milestone_key]||'/member-dashboard/':'/member-dashboard/';
    nextAction.textContent=next?'Open Next Step':'Return to Dashboard';

    list.replaceChildren();
    for(const item of items){
      const row=document.createElement('article');
      row.className='agent-journey-item'+(item.completed?' completed':'');
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=Boolean(item.completed);checkbox.setAttribute('aria-label','Mark '+(item.title||item.milestone_key)+' complete');
      const copy=document.createElement('div');
      const title=document.createElement('strong');title.textContent=item.title||item.milestone_key;
      const note=document.createElement('span');note.textContent=descriptions[item.milestone_key]||'DominionStar professional milestone.';
      copy.append(title,note);
      const action=document.createElement('a');action.href=routes[item.milestone_key]||'/member-dashboard/';action.textContent='Open →';
      checkbox.addEventListener('change',async()=>{
        checkbox.disabled=true;
        const update=await db.from('member_milestones').update({
          completed:checkbox.checked,
          completed_at:checkbox.checked?new Date().toISOString():null,
          updated_at:new Date().toISOString()
        }).eq('id',item.id).eq('user_id',session.user.id);
        checkbox.disabled=false;
        if(update.error){checkbox.checked=!checkbox.checked;return}
        await load();
      });
      row.append(checkbox,copy,action);list.appendChild(row);
    }
  };
  refresh.addEventListener('click',load);
  await load();
})();