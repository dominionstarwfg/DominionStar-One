
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
}

const readinessForm = document.getElementById('readinessForm');
const assessmentResult = document.getElementById('assessmentResult');
if (readinessForm) {
  readinessForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(readinessForm);
    const license = data.get('license');
    const timing = data.get('timing');
    let message = 'Your best next step is a short discovery conversation with a DominionStar leader.';
    if (license === 'Not at this time') {
      message = 'Start with DominionStar Academy and a no-pressure information session before deciding whether licensing fits your goals.';
    } else if (timing === 'Immediately' || timing === 'Within 30 days') {
      message = 'You appear ready for an opportunity conversation. Use the appointment form below and select “Career opportunity.”';
    }
    assessmentResult.hidden = false;
    assessmentResult.textContent = message;
  });
}

const guide = document.getElementById('guide');
const guideLaunch = document.getElementById('guideLaunch');
const guideClose = document.getElementById('guideClose');
const guideBody = document.getElementById('guideBody');
const guideForm = document.getElementById('guideForm');
const guideInput = document.getElementById('guideInput');

function openGuide() {
  guide.classList.add('open');
  guide.setAttribute('aria-hidden', 'false');
}
function closeGuide() {
  guide.classList.remove('open');
  guide.setAttribute('aria-hidden', 'true');
}
guideLaunch?.addEventListener('click', openGuide);
guideClose?.addEventListener('click', closeGuide);

const faq = [
  { keys:['experience','need experience'], answer:'Prior financial-services experience is not always required. The process may include education, licensing, onboarding, mentorship, and ongoing development. Requirements vary by role and jurisdiction.' },
  { keys:['part-time','part time','evening'], answer:'Some people explore the opportunity part-time while maintaining other responsibilities. Suitability depends on your availability, licensing status, goals, and local requirements.' },
  { keys:['license','licensing'], answer:'Insurance activity generally requires appropriate state or provincial licensing and appointments. A DominionStar leader can explain the typical steps, costs, timelines, and study expectations for your location.' },
  { keys:['schedule','appointment','book'], answer:'Use the “Schedule a conversation” form on this page, call (346) 204-2641, or email DominionStarwfg@gmail.com.' },
  { keys:['income','earn','salary','commission'], answer:'Compensation and results vary. DominionStar does not guarantee income or success. A leader can explain the business model, expectations, and factors that affect outcomes.' },
  { keys:['canada','united states','usa'], answer:'The broader platform operates across the United States and Canada. Licensing, product availability, and opportunity details vary by jurisdiction.' },
  { keys:['wfg','world financial group'], answer:'DominionStar is the leadership and development brand. Opportunity participants may work through a broader financial-services platform. Specific affiliations, contracts, and provider access should be explained during a formal conversation.' },
  { keys:['products','companies','carriers'], answer:'Properly licensed and appointed professionals may have access to solutions from multiple providers. Availability depends on jurisdiction, appointments, client suitability, and current platform relationships.' },
  { keys:['passed my exam','passed the exam','what next after exam','what is next'], answer:'Congratulations. The next steps depend on your state or province. DominionStar helps identify fingerprinting requirements where applicable, complete the license application, review non-resident licensing when appropriate, and move into onboarding, compliance, appointments, and training. You are not expected to figure it out alone.' },
  { keys:['fingerprint','fingerprinting'], answer:'Fingerprinting requirements vary by jurisdiction. Some states require fingerprints as part of licensing, while others use different background-review procedures. DominionStar helps recruits identify the current requirement for their location.' },
  { keys:['training after license','post license training','after licensed'], answer:'After licensing and onboarding, DominionStar begins structured training—often one-on-one or through Zoom. Training includes business setup, company systems, products, illustrations, client communication, compliance, prospecting, and leadership development.' },
  { keys:['xcel','excel solutions','kaplan','course provider'], answer:'Pre-licensing courses must be approved for the applicable jurisdiction. XCEL Solutions may be available with a DominionStar-related discount, and other approved providers such as Kaplan may also be considered. Current approval should always be verified before enrolling.' },
  { keys:['e&o','errors and omissions','aml','anti money laundering'], answer:'Errors & Omissions coverage and Anti-Money Laundering training may be required before certain activities, appointments, or compensation. Requirements vary by jurisdiction, provider, and platform.' }
];

function answerQuestion(question) {
  const q = question.toLowerCase();
  const found = faq.find(item => item.keys.some(k => q.includes(k)));
  return found ? found.answer : 'I can help with careers, licensing, appointments, locations, compensation disclosures, and financial-services questions. For anything specific, please use the appointment form or contact DominionStar directly.';
}

function addMessage(text, cls) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  guideBody.appendChild(div);
  guideBody.scrollTop = guideBody.scrollHeight;
}
document.querySelectorAll('[data-question]').forEach(btn => {
  btn.addEventListener('click', () => {
    openGuide();
    const q = btn.dataset.question;
    addMessage(q, 'user-message');
    setTimeout(() => addMessage(answerQuestion(q), 'bot-message'), 250);
  });
});
guideForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = guideInput.value.trim();
  if (!q) return;
  addMessage(q, 'user-message');
  guideInput.value = '';
  setTimeout(() => addMessage(answerQuestion(q), 'bot-message'), 250);
});

document.querySelectorAll('.faq-question').forEach(button=>button.addEventListener('click',()=>button.closest('.faq-item').classList.toggle('open')));
const assessment=document.getElementById('fullAssessment');if(assessment){const steps=[...assessment.querySelectorAll('.assessment-step')],progress=document.getElementById('assessmentProgress'),answers={};let current=0;function show(i){steps.forEach((s,n)=>s.classList.toggle('active',n===i));progress.style.width=`${(i/(steps.length-1))*100}%`;}assessment.querySelectorAll('[data-answer]').forEach(btn=>btn.addEventListener('click',()=>{answers[btn.dataset.question]=Number(btn.dataset.answer);current++;if(current<steps.length-1){show(current)}else{const score=Object.values(answers).reduce((a,b)=>a+b,0);let title,text;if(score>=18){title='Strong Potential Fit';text='Your answers suggest you may be ready for a focused opportunity conversation.'}else if(score>=12){title='Promising Fit — More Information Recommended';text='You show several traits that may align with the opportunity. Start with a discovery conversation.'}else{title='Start With Education';text='Begin with DominionStar Academy and a no-pressure information session.'}document.getElementById('resultTitle').textContent=title;document.getElementById('resultText').textContent=text;steps.forEach(s=>s.classList.remove('active'));document.getElementById('fullAssessmentResult').hidden=false;progress.style.width='100%';}}));show(0);}


// v0.3: reveal motion, UTM capture, conversion tracking hooks, and guided concierge.
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('revealed'); revealObserver.unobserve(entry.target); } });
}, { threshold: .12 }) : null;
document.querySelectorAll('[data-reveal]').forEach(el => revealObserver ? revealObserver.observe(el) : el.classList.add('revealed'));

const params = new URLSearchParams(location.search);
const attributionKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref'];
attributionKeys.forEach(key => {
  const value = params.get(key) || sessionStorage.getItem(`ds_${key}`) || '';
  if (value) sessionStorage.setItem(`ds_${key}`, value);
  document.querySelectorAll(`input[name="${key}"]`).forEach(input => input.value = value);
});
document.querySelectorAll('input[name="landing_page"]').forEach(input => input.value = location.href);

document.querySelectorAll('[data-track]').forEach(el => el.addEventListener('click', () => {
  const eventName = el.dataset.track;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, page_path: location.pathname });
}));

const concierge = document.getElementById('conciergeStage');
if (concierge) {
  const render = html => concierge.innerHTML = html;
  const start = () => render(`
    <div class="concierge-intro"><span class="guide-badge">✦ Guided experience</span><strong style="display:block;margin-top:8px">What brings you to DominionStar today?</strong></div>
    <div class="concierge-options">
      <button data-concierge="career">I am exploring a career opportunity</button>
      <button data-concierge="license">I want to understand licensing</button>
      <button data-concierge="financial">I need financial information</button>
      <button data-concierge="appointment">I want to schedule a conversation</button>
    </div>`);
  const next = (type) => {
    const content = {
      career: ['Career Opportunity','DominionStar offers a leadership-driven path with mentorship, licensing guidance, and flexible exploration. The best next step is the 2-minute assessment.','/opportunity/#assessment','Take the assessment'],
      license: ['Licensing Guidance','Licensing requirements vary by state or province. Review the licensing roadmap and then schedule a conversation for your location.','/academy/becoming-licensed.html','Review licensing'],
      financial: ['Financial Information','DominionStar emphasizes education before solutions. A properly licensed professional can discuss your needs and available options.','/#conversation','Request a consultation'],
      appointment: ['Schedule a Conversation','Share your contact information and the DominionStar team will follow up.','/#conversation','Open appointment form']
    }[type];
    render(`<div class="concierge-intro"><span class="guide-badge">Recommended next step</span><strong style="display:block;margin-top:8px">${content[0]}</strong><p>${content[1]}</p></div><a class="btn btn-gold" style="width:100%" href="${content[2]}" data-track="concierge_recommendation">${content[3]}</a><button id="conciergeRestart" style="width:100%;margin-top:10px;border:0;background:none;cursor:pointer">Start over</button>`);
    document.getElementById('conciergeRestart')?.addEventListener('click', start);
  };
  concierge.addEventListener('click', e => { const btn=e.target.closest('[data-concierge]'); if(btn) next(btn.dataset.concierge); });
  start();
}

// Preserve assessment result in the lead form when available.
const resultObserverTarget = document.getElementById('fullAssessmentResult');
if (resultObserverTarget && 'MutationObserver' in window) {
  new MutationObserver(() => {
    if (!resultObserverTarget.hidden) {
      const title = document.getElementById('resultTitle')?.textContent || '';
      sessionStorage.setItem('ds_assessment_result', title);
      document.querySelectorAll('input[name="assessment_result"]').forEach(i => i.value = title);
    }
  }).observe(resultObserverTarget, { attributes:true, attributeFilter:['hidden'] });
}
const savedAssessment = sessionStorage.getItem('ds_assessment_result');
if(savedAssessment) document.querySelectorAll('input[name="assessment_result"]').forEach(i=>i.value=savedAssessment);


/* DominionStar One v0.4 */

const copyLinkButtons = document.querySelectorAll('[data-copy-link]');
copyLinkButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copyLink || window.location.href);
      const original = button.textContent;
      button.textContent = 'Link copied';
      setTimeout(() => button.textContent = original, 1600);
    } catch {
      window.prompt('Copy this link:', button.dataset.copyLink || window.location.href);
    }
  });
});

document.querySelectorAll('[data-event-register]').forEach(button => {
  button.addEventListener('click', () => {
    const select = document.querySelector('select[name="event"]');
    if (select) select.value = button.dataset.eventRegister;
  });
});

function appendGuideLeadCapture() {
  if (!guideBody || document.getElementById('guideLeadBox')) return;
  const wrap = document.createElement('div');
  wrap.className = 'guide-lead-box';
  wrap.id = 'guideLeadBox';
  wrap.innerHTML = `
    <strong>Send your question to DominionStar</strong>
    <input id="guideLeadName" placeholder="Your name" autocomplete="name" required />
    <input id="guideLeadEmail" type="email" placeholder="Email" autocomplete="email" required />
    <select id="guideLeadInterest" required>
      <option value="">Choose an interest</option>
      <option>Career opportunity</option>
      <option>Licensing information</option>
      <option>Financial consultation</option>
      <option>Event information</option>
    </select>
    <button type="button" id="guideLeadSubmit">Continue</button>
  `;
  guideBody.appendChild(wrap);
  document.getElementById('guideLeadSubmit').addEventListener('click', () => {
    const name = document.getElementById('guideLeadName').value.trim();
    const email = document.getElementById('guideLeadEmail').value.trim();
    const interest = document.getElementById('guideLeadInterest').value;
    if (!name || !email || !interest) {
      addMessage('Please complete your name, email, and interest.', 'bot-message');
      return;
    }
    const guideParams = new URLSearchParams({
      name,
      email,
      interest,
      source: 'DominionStar Guide'
    });

    const continueButton = document.getElementById('guideLeadSubmit');
    continueButton.disabled = true;
    continueButton.textContent = 'Opening your form...';

    sessionStorage.setItem('ds_guide_handoff', '1');
    window.location.assign(`/?${guideParams.toString()}#conversation`);
  });
}

document.querySelectorAll('[data-open-guide-lead]').forEach(button => {
  button.addEventListener('click', () => {
    openGuide();
    appendGuideLeadCapture();
    guideBody.scrollTop = guideBody.scrollHeight;
  });
});

const leadPrefillParams = new URLSearchParams(window.location.search);
const leadForm = document.querySelector('form[name="dominionstar-lead"]');
if (leadForm) {
  ['name','email','interest'].forEach(key => {
    const field = leadForm.querySelector(`[name="${key}"]`);
    if (field && leadPrefillParams.get(key)) field.value = leadPrefillParams.get(key);
  });
}

/* v0.5 */
window.DSAnalytics={track(n,p={}){try{if(typeof gtag==='function')gtag('event',n,p);const k='ds_analytics_events',a=JSON.parse(localStorage.getItem(k)||'[]');a.push({eventName:n,payload:p,ts:new Date().toISOString()});localStorage.setItem(k,JSON.stringify(a.slice(-200)))}catch(e){}}};
document.querySelectorAll('a,button').forEach(el=>{const label=(el.textContent||'').trim().slice(0,80);if(label)el.addEventListener('click',()=>DSAnalytics.track('interaction',{label,href:el.getAttribute('href')||'',page:location.pathname}),{passive:true})});
const routes={career:['Explore a career with purpose','Start by understanding licensing, time expectations, mentorship, compensation disclosures, and the independent nature of the opportunity.','/opportunity/','Explore the Opportunity','Then take the 2-minute career assessment.'],income:['Evaluate an additional-income path responsibly','There are no guaranteed earnings. A discovery conversation should explain licensing, expenses, compensation, chargebacks, and required work.','/join/','Request a Discovery Call','Use the shareable join page to submit your goals.'],licensing:['Understand licensing before committing','Requirements vary by state or province. Review the licensing roadmap and request a jurisdiction-specific conversation.','/academy/becoming-licensed.html','Read the Licensing Guide','Then register for a licensing information session.'],financial:['Explore financial education and solutions','DominionStar emphasizes education first. Product availability and recommendations depend on licensing, jurisdiction, eligibility, and suitability.','/#families','See How We Help Families','Schedule a consultation for individualized discussion.'],events:['Attend a DominionStar event','Choose an opportunity overview, licensing session, leadership session, or financial education event.','/events/','View Events','Registration details are sent after submission.']};
document.querySelectorAll('[data-concierge-route]').forEach(b=>b.addEventListener('click',()=>{const r=routes[b.dataset.conciergeRoute];if(!r)return;document.querySelectorAll('[data-concierge-route]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('conciergeTitle').textContent=r[0];document.getElementById('conciergeText').textContent=r[1];const a=document.getElementById('conciergeLink');a.href=r[2];a.textContent=r[3];document.getElementById('conciergeNext').textContent=r[4];DSAnalytics.track('concierge_route_selected',{route:b.dataset.conciergeRoute})}));
const dash=document.getElementById('localAnalyticsDashboard');if(dash){const e=JSON.parse(localStorage.getItem('ds_analytics_events')||'[]'),set=(i,v)=>{const x=document.getElementById(i);if(x)x.textContent=v};set('metricInteractions',e.filter(x=>x.eventName==='interaction').length);set('metricConcierge',e.filter(x=>x.eventName==='concierge_route_selected').length);set('metricPages',[...new Set(e.map(x=>x.payload&&x.payload.page).filter(Boolean))].length);set('metricEvents',e.length)}


/* DominionStar One v0.6 — Operations */

function dsSafeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

const dsCRM = {
  key: 'dominionstar_crm_leads_v1',
  get() { return dsSafeParse(localStorage.getItem(this.key), []); },
  save(leads) { localStorage.setItem(this.key, JSON.stringify(leads)); },
  add(lead) {
    const leads = this.get();
    leads.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      status: 'New',
      owner: '',
      nextFollowUp: '',
      notes: '',
      ...lead
    });
    this.save(leads);
    return leads;
  },
  update(id, patch) {
    const leads = this.get().map(lead => lead.id === id ? {...lead, ...patch} : lead);
    this.save(leads);
    return leads;
  },
  remove(id) {
    const leads = this.get().filter(lead => lead.id !== id);
    this.save(leads);
    return leads;
  }
};

const crmForm = document.getElementById('crmLeadForm');
const crmBody = document.getElementById('crmBody');
const crmEmpty = document.getElementById('crmEmpty');
const crmCount = document.getElementById('crmCount');

function renderCRM() {
  if (!crmBody) return;
  const leads = dsCRM.get();
  crmBody.innerHTML = '';
  if (crmCount) crmCount.textContent = String(leads.length);
  if (crmEmpty) crmEmpty.hidden = leads.length !== 0;

  leads.forEach(lead => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(lead.createdAt).toLocaleDateString()}</td>
      <td>${escapeHTML(lead.name || '')}</td>
      <td>${escapeHTML(lead.email || '')}</td>
      <td>${escapeHTML(lead.phone || '')}</td>
      <td>${escapeHTML(lead.interest || '')}</td>
      <td>
        <select data-field="status" data-id="${lead.id}">
          ${['New','Contacted','Scheduled','Follow-Up','Qualified','Closed','Not a Fit'].map(s => `<option ${lead.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input data-field="owner" data-id="${lead.id}" value="${escapeHTML(lead.owner || '')}" placeholder="Leader"></td>
      <td><input type="date" data-field="nextFollowUp" data-id="${lead.id}" value="${escapeHTML(lead.nextFollowUp || '')}"></td>
      <td><input data-field="notes" data-id="${lead.id}" value="${escapeHTML(lead.notes || '')}" placeholder="Notes"></td>
      <td><button class="btn btn-outline" type="button" data-delete-lead="${lead.id}">Delete</button></td>
    `;
    crmBody.appendChild(row);
  });

  crmBody.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('change', () => {
      dsCRM.update(input.dataset.id, {[input.dataset.field]: input.value});
      window.DSAnalytics?.track('crm_lead_updated', {field: input.dataset.field});
    });
  });

  crmBody.querySelectorAll('[data-delete-lead]').forEach(button => {
    button.addEventListener('click', () => {
      if (confirm('Delete this lead from this browser?')) {
        dsCRM.remove(button.dataset.deleteLead);
        renderCRM();
      }
    });
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));
}

crmForm?.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(crmForm);
  dsCRM.add({
    name: data.get('name'),
    email: data.get('email'),
    phone: data.get('phone'),
    interest: data.get('interest')
  });
  crmForm.reset();
  renderCRM();
  window.DSAnalytics?.track('crm_lead_added', {});
});

document.getElementById('crmExport')?.addEventListener('click', () => {
  const leads = dsCRM.get();
  const headers = ['createdAt','name','email','phone','interest','status','owner','nextFollowUp','notes'];
  const lines = [headers.join(',')];
  leads.forEach(lead => {
    lines.push(headers.map(key => `"${String(lead[key] || '').replace(/"/g,'""')}"`).join(','));
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DominionStar-Leads-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('crmClear')?.addEventListener('click', () => {
  if (confirm('Clear all locally stored leads from this browser?')) {
    dsCRM.save([]);
    renderCRM();
  }
});

const crmImport = document.getElementById('crmImport');
crmImport?.addEventListener('change', async () => {
  const file = crmImport.files?.[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;
  const headers = lines[0].split(',').map(v => v.replace(/^"|"$/g,''));
  const imported = [];
  for (const line of lines.slice(1)) {
    const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g,'').replace(/""/g,'"')) || [];
    const lead = {};
    headers.forEach((h,i) => lead[h] = values[i] || '');
    imported.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      createdAt: lead.createdAt || new Date().toISOString(),
      status: lead.status || 'New',
      ...lead
    });
  }
  dsCRM.save([...imported, ...dsCRM.get()]);
  renderCRM();
  crmImport.value = '';
});

document.querySelectorAll('[data-copy-template]').forEach(button => {
  button.addEventListener('click', async () => {
    const target = document.getElementById(button.dataset.copyTemplate);
    if (!target) return;
    await navigator.clipboard.writeText(target.innerText);
    const previous = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => button.textContent = previous, 1400);
  });
});

renderCRM();


/* DominionStar One v0.7 — Stability & Experience */

function dsShowToast(message, type = 'success') {
  let toast = document.getElementById('dsToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dsToast';
    toast.className = 'ds-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.className = `ds-toast ${type} show`;
  toast.textContent = message;
  clearTimeout(window.__dsToastTimer);
  window.__dsToastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function dsIsValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('#guideLeadSubmit');
  if (!button) return;

  const name = document.getElementById('guideLeadName')?.value.trim() || '';
  const email = document.getElementById('guideLeadEmail')?.value.trim() || '';
  const interest = document.getElementById('guideLeadInterest')?.value || '';

  if (!name || !email || !interest) {
    dsShowToast('Complete your name, email, and interest.', 'error');
    return;
  }
  if (!dsIsValidEmail(email)) {
    dsShowToast('Enter a valid email address.', 'error');
  }
}, true);

window.addEventListener('DOMContentLoaded', () => {
  const query = new URLSearchParams(window.location.search);
  const form = document.querySelector('form[name="dominionstar-lead"]');

  if (form) {
    ['name', 'email', 'interest'].forEach((key) => {
      const field = form.querySelector(`[name="${key}"]`);
      const value = query.get(key);
      if (field && value) field.value = value;
    });

    if (query.get('source') === 'DominionStar Guide' || sessionStorage.getItem('ds_guide_handoff') === '1') {
      sessionStorage.removeItem('ds_guide_handoff');
      setTimeout(() => {
        document.getElementById('conversation')?.scrollIntoView({behavior: 'smooth', block: 'start'});
        dsShowToast('Your information was added. Complete the remaining fields to request your conversation.');
        form.querySelector('[name="phone"]')?.focus({preventScroll: true});
      }, 250);
    }
  }

  document.querySelectorAll('form[data-netlify="true"]').forEach((netlifyForm) => {
    netlifyForm.addEventListener('submit', (event) => {
      const required = [...netlifyForm.querySelectorAll('[required]')];
      const invalid = required.find((field) => !field.value.trim());

      if (invalid) {
        event.preventDefault();
        invalid.focus();
        dsShowToast('Please complete all required fields.', 'error');
        return;
      }

      const email = netlifyForm.querySelector('input[type="email"]');
      if (email && !dsIsValidEmail(email.value)) {
        event.preventDefault();
        email.focus();
        dsShowToast('Enter a valid email address.', 'error');
        return;
      }

      const submit = netlifyForm.querySelector('button[type="submit"]');
      if (submit) {
        submit.disabled = true;
        submit.dataset.originalText = submit.textContent;
        submit.textContent = 'Submitting...';
      }
    });
  });
});

window.addEventListener('pageshow', () => {
  document.querySelectorAll('button[type="submit"][disabled]').forEach((button) => {
    button.disabled = false;
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  });
});

/* v0.8 Journey Tracker */
const journeyTrackerKey='dominionstar_journey_progress_v1';
function getJourneyProgress(){try{return JSON.parse(localStorage.getItem(journeyTrackerKey)||'{}')}catch{return {}}}
function saveJourneyProgress(p){localStorage.setItem(journeyTrackerKey,JSON.stringify(p))}
function renderJourneyProgress(){const items=[...document.querySelectorAll('[data-journey-step]')];if(!items.length)return;const p=getJourneyProgress();let done=0;items.forEach(i=>{const c=i.querySelector('input[type="checkbox"]');if(!c)return;c.checked=Boolean(p[i.dataset.journeyStep]);if(c.checked)done++});const pct=Math.round(done/items.length*100);const bar=document.getElementById('journeyProgressBar'),label=document.getElementById('journeyProgressLabel'),count=document.getElementById('journeyProgressCount');if(bar)bar.style.width=`${pct}%`;if(label)label.textContent=`${pct}% complete`;if(count)count.textContent=`${done} of ${items.length} milestones`}
document.querySelectorAll('[data-journey-step] input[type="checkbox"]').forEach(c=>c.addEventListener('change',()=>{const p=getJourneyProgress(),id=c.closest('[data-journey-step]').dataset.journeyStep;p[id]=c.checked;saveJourneyProgress(p);renderJourneyProgress()}));
document.getElementById('journeyReset')?.addEventListener('click',()=>{if(confirm('Reset journey progress stored in this browser?')){localStorage.removeItem(journeyTrackerKey);renderJourneyProgress()}});
renderJourneyProgress();


/* DominionStar One v0.9 — Visual Polish */

window.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('.site-header .nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('/')) return;
    const linkPath = href.split('#')[0].replace(/\/+$/, '') || '/';
    if (linkPath === currentPath) link.setAttribute('aria-current', 'page');
  });

  document.querySelectorAll('.light-section .eyebrow').forEach((label) => {
    label.classList.add('on-light');
  });
});


/* DominionStar Platform v1.0 */

const platformProgressKey = 'dominionstar_platform_progress_v1';

function getPlatformProgress(){
  try{return JSON.parse(localStorage.getItem(platformProgressKey)||'{}')}
  catch{return {}}
}
function savePlatformProgress(progress){
  localStorage.setItem(platformProgressKey,JSON.stringify(progress));
}
function renderPlatformProgress(){
  const items=[...document.querySelectorAll('[data-platform-step]')];
  if(!items.length)return;
  const progress=getPlatformProgress();
  let complete=0;

  items.forEach(item=>{
    const checkbox=item.querySelector('input[type="checkbox"]');
    const id=item.dataset.platformStep;
    if(!checkbox)return;
    checkbox.checked=Boolean(progress[id]);
    if(checkbox.checked)complete++;
  });

  const percent=Math.round((complete/items.length)*100);
  const bar=document.getElementById('platformProgressBar');
  const label=document.getElementById('platformProgressLabel');
  const count=document.getElementById('platformProgressCount');
  if(bar)bar.style.width=`${percent}%`;
  if(label)label.textContent=`${percent}% complete`;
  if(count)count.textContent=`${complete} of ${items.length} platform milestones`;
}

document.querySelectorAll('[data-platform-step] input[type="checkbox"]').forEach(checkbox=>{
  checkbox.addEventListener('change',()=>{
    const item=checkbox.closest('[data-platform-step]');
    const progress=getPlatformProgress();
    progress[item.dataset.platformStep]=checkbox.checked;
    savePlatformProgress(progress);
    renderPlatformProgress();
    window.DSAnalytics?.track('platform_milestone_updated',{
      milestone:item.dataset.platformStep,
      complete:checkbox.checked
    });
  });
});

document.getElementById('platformProgressReset')?.addEventListener('click',()=>{
  if(confirm('Reset your platform progress in this browser?')){
    localStorage.removeItem(platformProgressKey);
    renderPlatformProgress();
  }
});

renderPlatformProgress();


/* DominionStar Platform v1.1 — Google Analytics 4 */
window.DSGA = {
  send(eventName, params = {}) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
          page_path: window.location.pathname,
          page_title: document.title,
          ...params
        });
      }
    } catch (error) {
      console.debug('GA4 event skipped', error);
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const pageEvents = {
    '/platform': 'platform_dashboard_opened',
    '/academy': 'academy_viewed',
    '/knowledge': 'knowledge_center_opened',
    '/journey': 'journey_viewed',
    '/opportunity': 'opportunity_viewed',
    '/events': 'events_viewed',
    '/success': 'success_viewed',
    '/schedule': 'schedule_viewed'
  };
  if (pageEvents[path]) window.DSGA.send(pageEvents[path]);
  if (path === '/404.html' || document.title.toLowerCase().includes('not found')) {
    window.DSGA.send('page_not_found', { requested_path: window.location.pathname });
  }

  document.querySelectorAll('a, button').forEach((element) => {
    element.addEventListener('click', () => {
      const label = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      const href = element.getAttribute('href') || '';
      if (!label) return;

      window.DSGA.send('platform_interaction', {
        interaction_label: label,
        destination: href
      });

      const lower = label.toLowerCase();
      if (lower.includes('schedule') || lower.includes('conversation')) {
        window.DSGA.send('conversation_cta_clicked', { interaction_label: label });
      }
      if (lower.includes('assessment')) {
        window.DSGA.send('career_assessment_cta_clicked', { interaction_label: label });
      }
      if (lower.includes('academy')) {
        window.DSGA.send('academy_cta_clicked', { interaction_label: label });
      }
      if (lower.includes('journey')) {
        window.DSGA.send('journey_cta_clicked', { interaction_label: label });
      }
    }, { passive: true });
  });

  document.querySelectorAll('form[data-netlify="true"]').forEach((form) => {
    form.addEventListener('submit', () => {
      const formName =
        form.getAttribute('name') ||
        form.querySelector('input[name="form-name"]')?.value ||
        'unknown_form';

      window.DSGA.send('form_submitted', { form_name: formName });
      if (formName.includes('lead') || formName.includes('join')) {
        window.DSGA.send('recruit_lead_submitted', { form_name: formName });
      }
      if (formName.includes('appointment')) {
        window.DSGA.send('conversation_requested', { form_name: formName });
      }
      if (formName.includes('event')) {
        window.DSGA.send('event_registration_submitted', { form_name: formName });
      }
    });
  });

  const scrollThresholds = [25, 50, 75, 100];
  const firedScroll = new Set();
  function trackScrollDepth() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const percent = Math.round(((window.scrollY || 0) / maxScroll) * 100);
    scrollThresholds.forEach((threshold) => {
      if (percent >= threshold && !firedScroll.has(threshold)) {
        firedScroll.add(threshold);
        window.DSGA.send('scroll_depth', { percent_scrolled: threshold });
      }
    });
  }
  window.addEventListener('scroll', trackScrollDepth, { passive: true });
  trackScrollDepth();

  [30, 60, 120, 300].forEach((seconds) => {
    window.setTimeout(() => {
      window.DSGA.send('time_on_page', { seconds });
    }, seconds * 1000);
  });
});

document.getElementById('guideLaunch')?.addEventListener('click', () => {
  window.DSGA?.send('guide_opened');
});
document.getElementById('guideForm')?.addEventListener('submit', () => {
  window.DSGA?.send('guide_question_sent');
});
document.getElementById('readinessForm')?.addEventListener('focusin', () => {
  if (!window.__dsAssessmentStarted) {
    window.__dsAssessmentStarted = true;
    window.DSGA?.send('career_assessment_started');
  }
});
document.getElementById('fullAssessment')?.addEventListener('click', (event) => {
  if (event.target.closest('[data-answer]') && !window.__dsFullAssessmentStarted) {
    window.__dsFullAssessmentStarted = true;
    window.DSGA?.send('career_assessment_started', { assessment_type: 'full' });
  }
});
document.querySelectorAll('[data-journey-step] input[type="checkbox"]').forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    const stage = checkbox.closest('[data-journey-step]')?.dataset.journeyStep || 'unknown';
    window.DSGA?.send('journey_progress', { stage, completed: checkbox.checked });
  });
});
document.querySelectorAll('[data-platform-step] input[type="checkbox"]').forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    const stage = checkbox.closest('[data-platform-step]')?.dataset.platformStep || 'unknown';
    window.DSGA?.send('platform_progress', { stage, completed: checkbox.checked });
  });
});


/* DominionStar Platform v2.0 — Dual Ecosystem */

window.addEventListener('DOMContentLoaded', () => {
  const topic = new URLSearchParams(window.location.search).get('topic');
  const topicField = document.getElementById('consultationTopic');
  if (topic && topicField) {
    const option = [...topicField.options].find(item => item.value === topic);
    if (option) topicField.value = topic;
  }

  if (window.location.pathname.startsWith('/financial-services')) {
    window.DSGA?.send('financial_services_viewed', {
      service_path: window.location.pathname
    });
  }
  if (window.location.pathname.startsWith('/consultation')) {
    window.DSGA?.send('client_consultation_viewed');
  }
});

document.querySelector('form[name="dominionstar-client-consultation"]')?.addEventListener('submit', () => {
  const topic = document.querySelector('[name="interest"]')?.value || 'unknown';
  window.DSGA?.send('client_consultation_requested', { topic });
});

document.querySelectorAll('a[href^="tel:"]').forEach(link => {
  link.addEventListener('click', () => window.DSGA?.send('phone_clicked'));
});
document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
  link.addEventListener('click', () => window.DSGA?.send('email_clicked'));
});

/* v2.1 Leadership & Verification */
window.addEventListener('DOMContentLoaded',()=>{const path=window.location.pathname.replace(/\/+$/,'')||'/';if(path==='/leadership')window.DSGA?.send('leadership_path_viewed');if(path==='/professional-verification')window.DSGA?.send('professional_verification_viewed')});
document.querySelector('form[name="dominionstar-professional-verification"]')?.addEventListener('submit',()=>{const rank=document.querySelector('select[name="rank"]')?.value||'unknown';window.DSGA?.send('professional_verification_submitted',{rank})});
