(() => {
  const sidebar = document.getElementById('dsosSidebar');
  const backdrop = document.getElementById('dsosBackdrop');
  const notificationPanel = document.getElementById('notificationPanel');
  const searchPanel = document.getElementById('dsosSearchPanel');
  const aiPanel = document.getElementById('dsosAiPanel');
  let panelTrigger = null;

  const hideAll = () => {
    sidebar?.classList.remove('open');
    [notificationPanel, searchPanel, aiPanel].forEach(panel => {
      panel?.classList.add('member-hidden');
      panel?.setAttribute('aria-hidden', 'true');
    });
    backdrop?.classList.add('member-hidden');
    document.body.classList.remove('dsos-overlay-open');
    panelTrigger?.focus?.();
    panelTrigger = null;
  };

  const focusFirstControl = panel => {
    const control = panel?.querySelector('input, button, a[href], select, textarea');
    setTimeout(() => control?.focus(), 0);
  };

  const showPanel = (panel, trigger = document.activeElement) => {
    hideAll();
    panelTrigger = trigger;
    panel?.classList.remove('member-hidden');
    panel?.setAttribute('aria-hidden', 'false');
    backdrop?.classList.remove('member-hidden');
    document.body.classList.add('dsos-overlay-open');
    focusFirstControl(panel);
  };

  document.getElementById('dsosMenu')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    backdrop?.classList.toggle('member-hidden', !sidebar?.classList.contains('open'));
  });

  ['notificationBell', 'openNotificationsMetric', 'openNotificationsSide'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', event => showPanel(notificationPanel, event.currentTarget));
  });
  document.getElementById('closeNotificationPanel')?.addEventListener('click', hideAll);

  document.getElementById('dsosSearchButton')?.addEventListener('click', event => {
    showPanel(searchPanel, event.currentTarget);
    document.getElementById('dsosSearchInput')?.focus();
  });
  document.getElementById('closeDsosSearch')?.addEventListener('click', hideAll);

  ['openAuroraSidebar', 'openAuroraSide', 'dsosFloatingAurora'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', event => {
      showPanel(aiPanel, event.currentTarget);
      document.getElementById('dsosAiInput')?.focus();
    });
  });
  document.getElementById('closeDsosAi')?.addEventListener('click', hideAll);
  backdrop?.addEventListener('click', hideAll);
  document.addEventListener('keydown', e => e.key === 'Escape' && hideAll());

  const destinations = [
    ['Dashboard','/member-dashboard/','Your executive workspace'],
    ['Messages','/direct-messages/','Private member conversations'],
    ['Community','/community/','Posts and announcements'],
    ['Academy','/academy/','Training and development'],
    ['Calendar','/appointments/','Appointments and meetings'],
    ['Directory','/member-directory/','Find approved members'],
    ['Recognition','/journey/','Progress and milestones'],
    ['Profile','/professional-profile/','Professional identity'],
    ['Settings','/account-settings/','Security and preferences'],
    ['Command Control','/founder-control/','Founder operations']
  ];
  const input = document.getElementById('dsosSearchInput');
  const results = document.getElementById('dsosSearchResults');
  const render = value => {
    const q = String(value || '').trim().toLowerCase();
    const matches = q ? destinations.filter(x => x.join(' ').toLowerCase().includes(q)) : destinations;
    results.innerHTML = matches.map(x => `<a href="${x[1]}"><strong>${x[0]}</strong><span>${x[2]}</span></a>`).join('') || '<p class="dsos-muted">No result.</p>';
  };
  input?.addEventListener('input', () => render(input.value));
  render('');

  const routes = [
    {terms:['message','chat'], label:'Opening Messages.', url:'/direct-messages/'},
    {terms:['community','post'], label:'Opening Community.', url:'/community/'},
    {terms:['academy','learn','course'], label:'Opening Academy.', url:'/academy/'},
    {terms:['calendar','meeting','appointment'], label:'Opening Calendar.', url:'/appointments/'},
    {terms:['directory','member'], label:'Opening Directory.', url:'/member-directory/'},
    {terms:['profile','photo'], label:'Opening Profile.', url:'/professional-profile/'},
    {terms:['setting','security','privacy'], label:'Opening Settings.', url:'/account-settings/'}
  ];
  document.getElementById('dsosAiForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('dsosAiInput');
    const messages = document.getElementById('dsosAiMessages');
    const text = input.value.trim();
    if (!text) return;
    const user = document.createElement('div');
    user.className = 'dsos-ai-message user';
    user.textContent = text;
    messages.appendChild(user);

    const match = routes.find(r => r.terms.some(t => text.toLowerCase().includes(t)));
    const reply = document.createElement('div');
    reply.className = 'dsos-ai-message';
    reply.innerHTML = match
      ? `${match.label} <a href="${match.url}">Open →</a>`
      : 'I can open Messages, Community, Academy, Calendar, Directory, Profile, or Settings.';
    messages.appendChild(reply);
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
  });

  const requiredRoutes = [
    '/member-dashboard/','/direct-messages/','/community/','/academy/',
    '/appointments/','/member-directory/','/journey/',
    '/professional-profile/','/account-settings/'
  ];

  const auditRoute = async route => {
    try {
      const response = await fetch(route, { method: 'HEAD', cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    }
  };

  window.DominionStarOS = window.DominionStarOS || {};
  window.DominionStarOS.auditRoutes = async () => {
    const results = {};
    for (const route of requiredRoutes) results[route] = await auditRoute(route);
    return results;
  };

  document.getElementById('markNotificationsRead')?.addEventListener('click', () => {
    const preview = document.getElementById('dsosNotificationPreview');
    if (preview) {
      preview.querySelectorAll('.dsos-notice.unread').forEach(item => item.classList.remove('unread'));
    }
  });


  const setStatus = (id, ok, readyText = 'Ready', failText = 'Needs attention') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = ok ? readyText : failText;
    el.classList.toggle('error', !ok);
  };

  const routeExists = async route => {
    try {
      const response = await fetch(route, { method: 'GET', cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const runMemberAudit = async () => {
    const button = document.getElementById('runMemberAudit');
    const summary = document.getElementById('memberAuditSummary');
    if (button) {
      button.disabled = true;
      button.textContent = 'Checking…';
    }

    const navigationChecks = await Promise.all(requiredRoutes.map(routeExists));
    const navigationOk = navigationChecks.every(Boolean);

    const notificationsOk = Boolean(
      document.getElementById('notificationBell') &&
      document.getElementById('notificationPanel') &&
      document.getElementById('markNotificationsRead')
    );

    const auroraOk = Boolean(
      document.getElementById('dsosFloatingAurora') &&
      document.getElementById('dsosAiPanel') &&
      document.getElementById('dsosAiForm')
    );

    const settingsOk = await routeExists('/account-settings/');

    setStatus('statusNavigation', navigationOk);
    setStatus('statusNotifications', notificationsOk);
    setStatus('statusAurora', auroraOk);
    setStatus('statusSettings', settingsOk);

    const passed = [navigationOk, notificationsOk, auroraOk, settingsOk].filter(Boolean).length;
    if (summary) {
      summary.textContent = passed === 4
        ? 'All member modules passed.'
        : `${passed} of 4 member checks passed.`;
    }

    if (button) {
      button.disabled = false;
      button.textContent = 'Run check';
    }

    return {
      navigation: navigationOk,
      notifications: notificationsOk,
      aurora: auroraOk,
      settings: settingsOk
    };
  };

  document.getElementById('runMemberAudit')?.addEventListener('click', runMemberAudit);
  window.DominionStarOS.runMemberAudit = runMemberAudit;

})();
