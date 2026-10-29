const dashboardState={data:null,client:null,session:null};
const loginSection=document.getElementById('founderLogin');
const dashboardSection=document.getElementById('founderDashboard');
const loginError=document.getElementById('founderLoginError');
const statusBox=document.getElementById('founderStatus');

const escapeFounder=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const numberValue=value=>Number.isFinite(Number(value))?Number(value):0;

async function verifyFounder(){
  if(!window.DSAuth?.ready)throw new Error('DominionStar authentication is unavailable.');
  dashboardState.client=await DSAuth.init();
  const sessionResult=await dashboardState.client.auth.getSession();
  dashboardState.session=sessionResult.data?.session;
  if(!dashboardState.session){location.href='/member-login/';return false}
  const profile=await dashboardState.client.from('member_profiles')
    .select('is_founder,verification_status')
    .eq('id',dashboardState.session.user.id)
    .maybeSingle();
  if(profile.error)throw profile.error;
  if(profile.data?.is_founder!==true||profile.data?.verification_status!=='approved'){
    throw new Error('Founder access is required for this analytics console.');
  }
  return true;
}

async function loadFounderData(){
  statusBox.textContent='Refreshing DominionStar analytics…';
  statusBox.className='founder-status';
  const token=dashboardState.session?.access_token;
  if(!token)throw new Error('Founder session is unavailable.');
  const response=await fetch('/api/founder-data',{
    headers:{authorization:`Bearer ${token}`}
  });
  const payload=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403)throw new Error(payload.error||'Founder authorization was not accepted.');
  if(!response.ok)throw new Error(payload.error||'The analytics service returned an error.');
  dashboardState.data=payload;
  renderFounderDashboard(payload);
  statusBox.textContent=`Updated ${new Date(payload.generatedAt).toLocaleString()}`;
  statusBox.className='founder-status success';
}

function renderFounderDashboard(data){
  const analytics=data.analytics||{},submissions=data.submissions||[],summary=data.summary||{};
  document.getElementById('metricRealtime').textContent=numberValue(analytics.activeUsers);
  document.getElementById('metricLeads').textContent=numberValue(summary.totalSubmissions);
  document.getElementById('metricConversations').textContent=numberValue(summary.conversationRequests);
  document.getElementById('metricEvents').textContent=numberValue(summary.eventRegistrations);
  document.getElementById('metricAssessments').textContent=numberValue(analytics.assessmentEvents);
  document.getElementById('metricGuide').textContent=numberValue(analytics.guideEvents);

  const body=document.getElementById('founderLeadsBody'),empty=document.getElementById('founderEmptyLeads');
  body.replaceChildren();
  for(const item of submissions){
    const dataFields=item.data||{},row=document.createElement('tr');
    row.innerHTML=`<td>${escapeFounder(new Date(item.created_at||item.createdAt).toLocaleString())}</td><td>${escapeFounder(dataFields.name||dataFields.fullName||'')}</td><td>${escapeFounder(dataFields.email||'')}</td><td>${escapeFounder(dataFields.phone||'')}</td><td>${escapeFounder(dataFields.interest||item.form_name||item.formName||'')}</td><td>${escapeFounder(dataFields.state||dataFields.province||'')}</td>`;
    body.appendChild(row);
  }
  empty.hidden=submissions.length>0;
  renderFounderList('founderPages',analytics.topPages,'page','activeUsers');
  renderFounderList('founderEvents',analytics.topEvents,'event','eventCount');
  renderFounderList('founderCountries',analytics.topCountries,'country','activeUsers');

  const verificationSubmissions=submissions.filter(item=>/professional-verification/i.test(item.form_name||item.formName||''));
  const rankCounts={TA:0,Associate:0,SA:0,MD:0,SMD:0};
  verificationSubmissions.forEach(item=>{const rank=item.data?.rank||'';if(Object.hasOwn(rankCounts,rank))rankCounts[rank]+=1});
  for(const [key,id] of Object.entries({TA:'rankTA',Associate:'rankAssociate',SA:'rankSA',MD:'rankMD',SMD:'rankSMD'}))document.getElementById(id).textContent=rankCounts[key];

  const connections=document.getElementById('founderConnections');
  connections.innerHTML=Object.entries(data.connections||{}).map(([key,connected])=>`<div><span>${escapeFounder(key)}</span><strong class="${connected?'connected':'not-connected'}">${connected?'Connected':'Needs setup'}</strong></div>`).join('');
}

function renderFounderList(targetId,rows=[],labelKey,valueKey){
  const target=document.getElementById(targetId);
  if(!rows.length){target.innerHTML='<p class="founder-empty">No data returned.</p>';return}
  target.innerHTML=rows.map(row=>`<div class="founder-list-row"><span>${escapeFounder(row[labelKey]||'(not set)')}</span><strong>${numberValue(row[valueKey])}</strong></div>`).join('');
}

async function openDashboard(){
  loginSection.hidden=true;dashboardSection.hidden=false;
  try{await loadFounderData()}catch(error){
    statusBox.textContent=error.message;statusBox.className='founder-status error';
  }
}

document.getElementById('founderRefresh').addEventListener('click',()=>loadFounderData().catch(error=>{statusBox.textContent=error.message;statusBox.className='founder-status error'}));
document.getElementById('founderLogout').addEventListener('click',async()=>{
  await dashboardState.client?.auth.signOut({scope:'local'}).catch(()=>{});
  location.href='/member-login/';
});
document.getElementById('exportFounderCsv').addEventListener('click',()=>{
  const submissions=dashboardState.data?.submissions||[],headers=['created_at','form_name','name','email','phone','state','interest'],lines=[headers.join(',')];
  for(const item of submissions){
    const data=item.data||{};
    const values=[item.created_at||item.createdAt||'',item.form_name||item.formName||'',data.name||data.fullName||'',data.email||'',data.phone||'',data.state||data.province||'',data.interest||''];
    lines.push(values.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(','));
  }
  const blob=new Blob([lines.join('\n')],{type:'text/csv'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=`DominionStar-Founder-Analytics-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url);
});

(async()=>{
  try{
    if(await verifyFounder())await openDashboard();
  }catch(error){
    loginError.textContent=error.message;
  }
})();