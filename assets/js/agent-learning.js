(async()=>{
  const gate=document.getElementById('agentLearningGate'),app=document.getElementById('agentLearningApp');
  if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return}
  let db;try{db=await DSAuth.init()}catch(_error){gate.innerHTML='<h1>Unable to verify your session.</h1>';return}
  const session=(await db.auth.getSession()).data.session;
  if(!session?.user?.id){location.href='/member-login/';return}
  const profile=await db.from('member_profiles').select('verification_status').eq('id',session.user.id).maybeSingle();
  if(profile.error||profile.data?.verification_status!=='approved'){
    gate.innerHTML='<p class="eyebrow">Learning & Development</p><h1>Available after Founder approval.</h1>';return
  }
  gate.classList.add('member-hidden');app.classList.remove('member-hidden');
})();