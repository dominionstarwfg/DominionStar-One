window.DSAurora = (() => {
  const route = location.pathname.toLowerCase();

  function routeArea() {
    if (route.includes('community') || route.includes('message') || route.includes('notification')) return 'community';
    if (route.includes('appointment') || route.includes('calendar')) return 'appointments';
    if (route.includes('founder') || route.includes('diagnostic') || route.includes('qa-center') || route.includes('release-check')) return 'founder';
    if (route.includes('academy') || route.includes('journey') || route.includes('leadership')) return 'learning';
    return 'dashboard';
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function normalizeReleaseLabels() {
    document.querySelectorAll('.production-stable-pill').forEach(el => {
      el.textContent = 'Aurora';
      el.classList.add('aurora-release-pill');
    });

    document.querySelectorAll('.founding-member-badge').forEach(el => {
      el.classList.add('aurora-badge');
    });

    document.querySelectorAll('.agent-exclusive-badge').forEach(el => {
      el.classList.add('aurora-exclusive-badge');
    });

    document.querySelectorAll('.platform-release-footer').forEach(el => {
      el.textContent = 'DominionStar Platform · v6.5.3 Aurora';
    });
  }

  function applyPageIdentity() {
    document.documentElement.dataset.auroraArea = routeArea();
    document.body.classList.add('aurora-enabled');
  }

  function addCommandStrip() {
    if (document.querySelector('.aurora-command-strip')) return;

    const main = document.querySelector('.member-dashboard');
    const header = main?.querySelector('.member-dashboard-header');
    if (!main || !header) return;

    const strip = document.createElement('div');
    strip.className = 'aurora-command-strip';
    strip.innerHTML = `
      <div class="aurora-command-brand">
        <span class="aurora-command-mark" aria-hidden="true"></span>
        <div>
          <strong>DominionStar</strong>
          <small>${routeArea().replace('-', ' ')}</small>
        </div>
      </div>
      <div class="aurora-command-status">
        <span class="aurora-live-dot" aria-hidden="true"></span>
        <span>Platform online</span>
        <b>v6.5.3</b>
      </div>
    `;
    main.insertBefore(strip, header);
  }

  function upgradeGreeting() {
    const memberGreeting = document.getElementById('memberGreeting');
    if (memberGreeting) memberGreeting.textContent = greeting();

    const founderHeader = document.querySelector('#founderApp .member-dashboard-header h1');
    if (founderHeader && !founderHeader.dataset.auroraGreeting) {
      const name = document.getElementById('founderName');
      founderHeader.innerHTML = `${greeting()}, <span id="founderName">${name?.textContent || 'Founder'}</span>`;
      founderHeader.dataset.auroraGreeting = 'true';
    }
  }

  function addFounderBriefing() {
    const app = document.getElementById('founderApp');
    const header = app?.querySelector('.member-dashboard-header');
    if (!app || !header || app.querySelector('.aurora-executive-briefing')) return;

    const briefing = document.createElement('section');
    briefing.className = 'aurora-executive-briefing';
    briefing.innerHTML = `
      <div>
        <p class="eyebrow">Executive Briefing</p>
        <h2>What needs your attention today</h2>
        <p>Review members, appointments, community activity, and platform health from one command center.</p>
      </div>
      <div class="aurora-briefing-status">
        <span>Platform health</span>
        <strong id="auroraHealthStatus">Healthy</strong>
        <small>Diagnostics available</small>
      </div>
    `;
    header.insertAdjacentElement('afterend', briefing);
  }

  function addMemberBriefing() {
    const dashboard = document.querySelector('main.member-dashboard');
    const header = dashboard?.querySelector('.member-dashboard-header');
    const identity = dashboard?.querySelector('.aurora-executive-identity');
    if (!dashboard || !header || document.getElementById('founderApp') || dashboard.querySelector('.aurora-member-briefing')) return;

    const briefing = document.createElement('section');
    briefing.className = 'aurora-member-briefing';
    briefing.innerHTML = `
      <div>
        <p class="eyebrow">Your Daily Briefing</p>
        <h2>Build momentum today.</h2>
        <p>Connect, learn, and take one meaningful step forward in your DominionStar journey.</p>
      </div>
      <div class="aurora-briefing-steps">
        <span>Connect</span>
        <span>Learn</span>
        <span>Lead</span>
      </div>
    `;
    (identity || header).insertAdjacentElement('afterend', briefing);
  }

  function decorateMetricCards() {
    document.querySelectorAll('.rank-dashboard-grid article, .founder-live-stat, .activity-summary > div').forEach((card, index) => {
      card.classList.add('aurora-metric-card');
      card.dataset.auroraTone = ['blue', 'purple', 'gold', 'green'][index % 4];
    });
  }

  function decoratePanels() {
    document.querySelectorAll('.member-panel, .member-card').forEach((panel, index) => {
      panel.classList.add('aurora-panel');
      if (!panel.dataset.auroraTone) {
        panel.dataset.auroraTone = ['blue', 'purple', 'neutral'][index % 3];
      }
    });
  }

  function decorateActions() {
    document.querySelectorAll('.dashboard-action-card, .resource-action-card, .connected-community-card').forEach((card, index) => {
      card.classList.add('aurora-action-card');
      card.dataset.auroraTone = ['blue', 'purple', 'green', 'gold'][index % 4];
    });
  }

  function animateNumbers() {
    const targets = document.querySelectorAll('.rank-dashboard-grid strong, .founder-live-stat strong, .activity-summary strong');
    targets.forEach(el => {
      const observer = new MutationObserver(() => {
        el.classList.remove('aurora-number-pop');
        void el.offsetWidth;
        el.classList.add('aurora-number-pop');
      });
      observer.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function improveBadgeText() {
    document.querySelectorAll('.aurora-badge, .aurora-exclusive-badge').forEach(badge => {
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-label', badge.textContent.trim());
    });
  }

  function init() {
    applyPageIdentity();
    normalizeReleaseLabels();
    addCommandStrip();
    upgradeGreeting();
    addFounderBriefing();
    addMemberBriefing();
    decorateMetricCards();
    decoratePanels();
    decorateActions();
    improveBadgeText();
    animateNumbers();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => window.DSAurora.init());
