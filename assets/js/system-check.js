
(async () => {
  const container = document.getElementById('systemChecks');
  const results = [];

  function add(name, passed, detail='') {
    results.push({name,passed,detail});
    container.innerHTML = results.map(item => `
      <div class="system-check-row ${item.passed?'pass':'fail'}">
        <strong>${item.passed?'✓':'✕'} ${item.name}</strong>
        <span>${item.detail}</span>
      </div>`).join('');
  }

  add('Supabase configuration', Boolean(window.DSAuth?.ready),
    window.DSAuth?.ready ? 'Project URL and publishable key are present.' : 'Configuration is missing.');

  if (!window.DSAuth?.ready) return;

  const client = await window.DSAuth.init();
  add('Supabase client library', Boolean(client),
    client ? 'Client initialized.' : 'The browser could not load Supabase JS.');
  if (!client) return;

  const auth = await client.auth.getSession();
  const session = auth.data.session;
  add('Authentication session', Boolean(session),
    session ? `Signed in as ${session.user.email}` : 'Not signed in; backend RPC checks require login.');
  if (!session) return;

  const ensure = await client.rpc('ensure_member_profile');
  add('ensure_member_profile RPC', !ensure.error, ensure.error?.message || 'Available.');

  const profile = await client.from('member_profiles')
    .select('full_name,email,agent_code,rank,verification_status,role')
    .eq('id',session.user.id).maybeSingle();
  add('member_profiles read policy', !profile.error && Boolean(profile.data),
    profile.error?.message || `${profile.data?.full_name || 'Member'} · ${profile.data?.rank || 'TA'}`);

  const founder = await client.rpc('is_dominionstar_founder');
  add('Founder permission function', !founder.error,
    founder.error?.message || (founder.data ? 'Founder access recognized.' : 'Standard member access recognized.'));

  const bucket = await client.storage.from('member-avatars').list(session.user.id,{limit:1});
  add('Avatar storage access', !bucket.error, bucket.error?.message || 'Bucket policy is available.');
})();
