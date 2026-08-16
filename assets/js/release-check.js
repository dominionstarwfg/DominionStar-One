(async () => {
  const target = document.getElementById('releaseCheckList');
  const rerun = document.getElementById('rerunReleaseCheck');

  async function run() {
    const results = [];
    target.innerHTML = '<p>Running checks…</p>';

    const add = (name, passed, detail = '') => {
      results.push({ name, passed, detail });
      target.innerHTML = results.map(item => `
        <article class="system-check-row ${item.passed ? 'pass' : 'fail'}">
          <strong>${item.passed ? '✓' : '✕'} ${item.name}</strong>
          <span>${item.detail}</span>
        </article>
      `).join('');
    };

    add('Runtime safety layer', Boolean(window.DOMINIONSTAR_RUNTIME), 'Global error capture is active.');
    add('Supabase configuration', Boolean(window.DSAuth?.ready),
      window.DSAuth?.ready ? 'Configuration is present.' : 'Configuration is missing.');

    if (!window.DSAuth?.ready) return;

    const client = await window.DSAuth.init();
    add('Supabase client', Boolean(client), client ? 'Client initialized.' : 'Client failed to initialize.');
    if (!client) return;

    const auth = await client.auth.getSession();
    const session = auth.data.session;
    add('Authentication session', Boolean(session),
      session ? `Signed in as ${session.user.email}` : 'Not signed in.');
    if (!session) return;

    const profile = await client.from('member_profiles')
      .select('full_name,email,agent_code,rank,verification_status,role')
      .eq('id',session.user.id)
      .maybeSingle();
    add('Profile access', !profile.error && Boolean(profile.data),
      profile.error?.message || `${profile.data?.full_name || 'Member'} · ${profile.data?.rank || 'TA'}`);

    const founder = await client.rpc('is_dominionstar_founder');
    add('Founder permission check', !founder.error,
      founder.error?.message || (founder.data ? 'Founder recognized.' : 'Standard member recognized.'));

    const modules = [
      ['Appointments','member_appointments'],
      ['Community posts','community_messages'],
      ['Community comments','community_comments'],
      ['Notifications','member_notifications']
    ];

    for (const [label, table] of modules) {
      const result = await client.from(table).select('id',{count:'exact',head:true});
      add(label, !result.error, result.error?.message || `${result.count || 0} records visible.`);
    }

    const flags = await client
      .from('feature_flags')
      .select('feature_key,label,is_enabled,founder_only')
      .order('label');

    add(
      'Feature flags',
      !flags.error,
      flags.error?.message ||
        (flags.data?.length
          ? `${flags.data.length} controls available.`
          : 'Table is accessible; run the Stable finalization SQL to install defaults.')
    );

    const avatar = await client.storage.from('member-avatars').list(session.user.id,{limit:1});
    add('Avatar storage', !avatar.error, avatar.error?.message || 'Storage policy is available.');

    const lastError = sessionStorage.getItem('dominionstar-last-error');
    add('Current browser session', !lastError,
      lastError ? 'A runtime error was captured in this session.' : 'No runtime errors captured.');
  }

  rerun.addEventListener('click', run);
  await run();
})();
