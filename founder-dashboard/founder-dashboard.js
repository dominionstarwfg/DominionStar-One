
const dashboardState = {
  data: null,
  key: sessionStorage.getItem('ds_founder_key') || ''
};

const loginSection = document.getElementById('founderLogin');
const dashboardSection = document.getElementById('founderDashboard');
const loginForm = document.getElementById('founderLoginForm');
const loginError = document.getElementById('founderLoginError');
const statusBox = document.getElementById('founderStatus');

function escapeFounder(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function loadFounderData() {
  statusBox.textContent = 'Refreshing DominionStar data…';
  statusBox.className = 'founder-status';

  const response = await fetch('/api/founder-data', {
    headers: {'x-founder-key': dashboardState.key}
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error('The founder dashboard key was not accepted.');
  }
  if (!response.ok) {
    throw new Error(payload.error || 'The dashboard data service returned an error.');
  }

  dashboardState.data = payload;
  renderFounderDashboard(payload);
  statusBox.textContent = `Updated ${new Date(payload.generatedAt).toLocaleString()}`;
  statusBox.className = 'founder-status success';
}

function renderFounderDashboard(data) {
  const analytics = data.analytics || {};
  const submissions = data.submissions || [];
  const summary = data.summary || {};

  document.getElementById('metricRealtime').textContent = numberValue(analytics.activeUsers);
  document.getElementById('metricLeads').textContent = numberValue(summary.totalSubmissions);
  document.getElementById('metricConversations').textContent = numberValue(summary.conversationRequests);
  document.getElementById('metricEvents').textContent = numberValue(summary.eventRegistrations);
  document.getElementById('metricAssessments').textContent = numberValue(analytics.assessmentEvents);
  document.getElementById('metricGuide').textContent = numberValue(analytics.guideEvents);

  const body = document.getElementById('founderLeadsBody');
  const empty = document.getElementById('founderEmptyLeads');
  body.innerHTML = '';

  submissions.forEach(item => {
    const dataFields = item.data || {};
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeFounder(new Date(item.created_at || item.createdAt).toLocaleString())}</td>
      <td>${escapeFounder(dataFields.name || dataFields.fullName || '')}</td>
      <td>${escapeFounder(dataFields.email || '')}</td>
      <td>${escapeFounder(dataFields.phone || '')}</td>
      <td>${escapeFounder(dataFields.interest || item.form_name || item.formName || '')}</td>
      <td>${escapeFounder(dataFields.state || dataFields.province || '')}</td>
    `;
    body.appendChild(row);
  });
  empty.hidden = submissions.length > 0;

  renderFounderList('founderPages', analytics.topPages, 'page', 'activeUsers');
  renderFounderList('founderEvents', analytics.topEvents, 'event', 'eventCount');
  renderFounderList('founderCountries', analytics.topCountries, 'country', 'activeUsers');

  const verificationSubmissions=submissions.filter(item=>/professional-verification/i.test(item.form_name||item.formName||''));const rankCounts={TA:0,Associate:0,SA:0,MD:0,SMD:0};verificationSubmissions.forEach(item=>{const rank=item.data?.rank||'';if(Object.prototype.hasOwnProperty.call(rankCounts,rank))rankCounts[rank]+=1});document.getElementById('rankTA').textContent=rankCounts.TA;document.getElementById('rankAssociate').textContent=rankCounts.Associate;document.getElementById('rankSA').textContent=rankCounts.SA;document.getElementById('rankMD').textContent=rankCounts.MD;document.getElementById('rankSMD').textContent=rankCounts.SMD;
  const connections = document.getElementById('founderConnections');
  connections.innerHTML = Object.entries(data.connections || {}).map(([key, connected]) => `
    <div><span>${escapeFounder(key)}</span><strong class="${connected ? 'connected' : 'not-connected'}">${connected ? 'Connected' : 'Needs setup'}</strong></div>
  `).join('');
}

function renderFounderList(targetId, rows = [], labelKey, valueKey) {
  const target = document.getElementById(targetId);
  if (!rows.length) {
    target.innerHTML = '<p class="founder-empty">No data returned.</p>';
    return;
  }
  target.innerHTML = rows.map(row => `
    <div class="founder-list-row">
      <span>${escapeFounder(row[labelKey] || '(not set)')}</span>
      <strong>${numberValue(row[valueKey])}</strong>
    </div>
  `).join('');
}

function openDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  loadFounderData().catch(error => {
    statusBox.textContent = error.message;
    statusBox.className = 'founder-status error';
    if (error.message.includes('key')) {
      dashboardState.key = '';
      sessionStorage.removeItem('ds_founder_key');
      dashboardSection.hidden = true;
      loginSection.hidden = false;
      loginError.textContent = error.message;
    }
  });
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  dashboardState.key = document.getElementById('founderKey').value.trim();
  sessionStorage.setItem('ds_founder_key', dashboardState.key);
  loginError.textContent = '';
  openDashboard();
});

document.getElementById('founderRefresh').addEventListener('click', () => {
  loadFounderData().catch(error => {
    statusBox.textContent = error.message;
    statusBox.className = 'founder-status error';
  });
});

document.getElementById('founderLogout').addEventListener('click', () => {
  sessionStorage.removeItem('ds_founder_key');
  dashboardState.key = '';
  dashboardSection.hidden = true;
  loginSection.hidden = false;
  document.getElementById('founderKey').value = '';
});

document.getElementById('exportFounderCsv').addEventListener('click', () => {
  const submissions = dashboardState.data?.submissions || [];
  const headers = ['created_at','form_name','name','email','phone','state','interest'];
  const lines = [headers.join(',')];

  submissions.forEach(item => {
    const data = item.data || {};
    const values = [
      item.created_at || item.createdAt || '',
      item.form_name || item.formName || '',
      data.name || data.fullName || '',
      data.email || '',
      data.phone || '',
      data.state || data.province || '',
      data.interest || ''
    ];
    lines.push(values.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
  });

  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `DominionStar-Founder-Export-${new Date().toISOString().slice(0,10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
});

if (dashboardState.key) openDashboard();
