(async () => {
  const byId = id => document.getElementById(id);
  const gate = byId('diagGate');
  const app = byId('diagApp');
  const maintenanceForm = byId('maintenanceForm');
  const maintenanceSaveStatus = byId('maintenanceSaveStatus');

  const ctx = await window.DSPlatform
    .bootstrap({ requireAuth: true, requireApproved: true })
    .catch(error => {
      gate.innerHTML = `<h1>${error.message}</h1>`;
      return null;
    });

  if (!ctx) return;

  const { client } = ctx;

  const founderResult = await client.rpc('is_dominionstar_founder');
  if (founderResult.error || founderResult.data !== true) {
    gate.innerHTML = '<h1>Founder access required.</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  byId('diagEnvironment').textContent =
    window.DOMINIONSTAR_PLATFORM.environment;

  byId('diagRuntimeErrors').textContent =
    String(window.DSPlatform.runtimeErrors.length);

  byId('diagSupabaseConfig').textContent =
    window.DOMINIONSTAR_SUPABASE?.url &&
    window.DOMINIONSTAR_SUPABASE?.anonKey
      ? 'Configured'
      : 'Missing';

  const field = name => maintenanceForm.elements.namedItem(name);

  function setSaveStatus(message, type = 'info') {
    maintenanceSaveStatus.textContent = message;
    maintenanceSaveStatus.className = `maintenance-save-status ${type}`;
  }

  async function loadSettings() {
    const result = await client
      .from('platform_settings')
      .select(
        'maintenance_enabled,maintenance_message,maintenance_eta_minutes,current_build,updated_at'
      )
      .eq('id', true)
      .maybeSingle();

    if (result.error) {
      setSaveStatus(`Could not load settings: ${result.error.message}`, 'error');
      return false;
    }

    if (!result.data) {
      setSaveStatus(
        'Platform settings record is missing. Run the v6.5.1b SQL hotfix.',
        'error'
      );
      return false;
    }

    field('enabled').checked = Boolean(result.data.maintenance_enabled);
    field('message').value =
      result.data.maintenance_message ||
      'DominionStar is undergoing scheduled maintenance.';
    field('eta').value = result.data.maintenance_eta_minutes || 15;

    setSaveStatus(
      result.data.maintenance_enabled
        ? 'Maintenance Mode is currently ON.'
        : 'Maintenance Mode is currently OFF.',
      result.data.maintenance_enabled ? 'warning' : 'success'
    );

    return true;
  }

  async function loadEmail() {
    const result = await client
      .from('email_notification_outbox')
      .select('status')
      .limit(500);

    const rows = result.data || [];
    byId('diagEmailPending').textContent = String(
      rows.filter(item => ['pending', 'processing'].includes(item.status)).length
    );
    byId('diagEmailFailed').textContent = String(
      rows.filter(item => item.status === 'failed').length
    );
    byId('diagEmailSent').textContent = String(
      rows.filter(item => item.status === 'sent').length
    );
  }

  async function loadActivity() {
    const result = await client
      .from('system_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const host = byId('activityList');

    if (result.error) {
      host.innerHTML = `<p>${result.error.message}</p>`;
      return;
    }

    host.innerHTML = (result.data || []).length
      ? result.data.map(item => `
          <article class="email-queue-item">
            <div>
              <strong>${item.action_label}</strong>
              <p>${item.action_type}</p>
              <small>${new Date(item.created_at).toLocaleString()}</small>
            </div>
          </article>
        `).join('')
      : '<div class="member-empty-state"><h2>No activity recorded yet.</h2></div>';
  }

  function renderHealth(payload) {
    byId('healthScore').textContent = `${payload.score}%`;
    byId('healthResults').innerHTML = Object.entries(
      payload.checks || {}
    ).map(([name, passed]) => `
      <article class="qa-result ${passed ? 'pass' : 'fail'}">
        <span>${passed ? '✓' : '✕'}</span>
        <div>
          <strong>${name.replaceAll('_', ' ')}</strong>
          <p>${passed ? 'Passed' : 'Needs attention'}</p>
        </div>
      </article>
    `).join('');
  }

  async function runSelfTest() {
    const result = await client.rpc('production_self_test');

    if (result.error) {
      alert(result.error.message);
      return null;
    }

    renderHealth(result.data);
    await loadActivity();
    return result.data;
  }

  byId('runSelfTest').addEventListener('click', runSelfTest);

  maintenanceForm.addEventListener('submit', async event => {
    event.preventDefault();

    const submitButton = maintenanceForm.querySelector(
      'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = 'Saving…';
    setSaveStatus('Saving Maintenance Mode settings…', 'info');

    const requestedEnabled = field('enabled').checked;
    const requestedMessage = field('message').value.trim();
    const requestedEta = Number(field('eta').value) || null;

    const result = await client.rpc('set_maintenance_mode_v651a', {
      p_enabled: requestedEnabled,
      p_message: requestedMessage,
      p_eta_minutes: requestedEta,
      p_build_id: window.DOMINIONSTAR_PLATFORM.build
    });

    if (result.error) {
      setSaveStatus(`Save failed: ${result.error.message}`, 'error');
      window.DSPlatform.toast(
        `Maintenance settings were not saved: ${result.error.message}`,
        'error'
      );
      submitButton.disabled = false;
      submitButton.textContent = 'Save Maintenance Status';
      return;
    }

    const verify = await client
      .from('platform_settings')
      .select('maintenance_enabled,maintenance_message,maintenance_eta_minutes')
      .eq('id', true)
      .single();

    if (
      verify.error ||
      Boolean(verify.data?.maintenance_enabled) !== requestedEnabled
    ) {
      setSaveStatus(
        verify.error
          ? `Saved, but verification failed: ${verify.error.message}`
          : 'The database did not retain the requested Maintenance Mode status.',
        'error'
      );
      submitButton.disabled = false;
      submitButton.textContent = 'Save Maintenance Status';
      return;
    }

    await Promise.all([loadSettings(), loadActivity()]);

    window.DSPlatform.toast(
      requestedEnabled
        ? 'Maintenance Mode enabled.'
        : 'Maintenance Mode disabled.',
      'success'
    );

    submitButton.disabled = false;
    submitButton.textContent = 'Save Maintenance Status';
  });

  byId('beginSafeDeploy').addEventListener('click', async () => {
    const test = await runSelfTest();
    if (!test) return;

    const result = await client.rpc('set_maintenance_mode_v651a', {
      p_enabled: true,
      p_message:
        'DominionStar is being updated. Founder testing is in progress.',
      p_eta_minutes: 15,
      p_build_id: window.DOMINIONSTAR_PLATFORM.build
    });

    if (result.error) {
      alert(result.error.message);
      return;
    }

    window.DSPlatform.toast(
      test.score === 100
        ? 'Safe Deploy started. Maintenance Mode is enabled.'
        : 'Maintenance Mode enabled. Resolve failed checks before completion.',
      test.score === 100 ? 'success' : 'warning'
    );

    await Promise.all([loadSettings(), loadActivity()]);
  });

  byId('completeSafeDeploy').addEventListener('click', async () => {
    const test = await runSelfTest();

    if (!test || test.score < 100) {
      alert(
        'Safe Deploy cannot complete until the Production Self-Test reaches 100%.'
      );
      return;
    }

    const result = await client.rpc('set_maintenance_mode_v651a', {
      p_enabled: false,
      p_message: 'DominionStar is available.',
      p_eta_minutes: null,
      p_build_id: window.DOMINIONSTAR_PLATFORM.build
    });

    if (result.error) {
      alert(result.error.message);
      return;
    }

    window.DSPlatform.toast(
      'Deployment completed and Maintenance Mode disabled.',
      'success'
    );

    await Promise.all([loadSettings(), loadActivity()]);
  });

  await Promise.all([loadSettings(), loadEmail(), loadActivity()]);
})();
