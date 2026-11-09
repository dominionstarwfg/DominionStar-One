
(async () => {
  const gate = document.getElementById('directoryGate');
  const app = document.getElementById('directoryApp');
  const grid = document.getElementById('directoryGrid');
  const search = document.getElementById('directorySearch');
  const rankFilter = document.getElementById('directoryRankFilter');

  let supabase;
  let members = [];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  if (!window.DSAuth.ready) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication service is temporarily unavailable.</h1>';
    return;
  }

  supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  const { data: viewer } = await supabase
    .from('member_profiles')
    .select('verification_status')
    .eq('id', session.user.id)
    .single();

  if (viewer?.verification_status !== 'approved') {
    gate.innerHTML = '<p class="eyebrow">Restricted</p><h1>Founder approval is required.</h1>';
    return;
  }

  // This is a peer-facing directory, never a Founder administrative read.
  // It must not query the private member_profiles table—even when a
  // broader legacy SELECT policy still exists during a staged migration.
  if(window.DOMINIONSTAR_AGENT_DATA_FEATURES?.publicMemberProfilesV2!==true){
    gate.innerHTML='<p class="eyebrow">Directory Update</p><h1>Team Directory temporarily unavailable</h1><p>Member privacy verification is required before this directory can be opened.</p><a class="btn btn-outline" href="/member-dashboard/">Return to Dashboard</a>';
    return;
  }
  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  const { data, error } = await supabase
    .from('member_public_profiles')
    .select('id,full_name,preferred_name,city,state,rank,avatar_path,founding_member,exclusive_member_number')
    .eq('verification_status', 'approved')
    .order('rank')
    .order('full_name');

  if (error) {
    grid.innerHTML = `<p>${esc(error.message)}</p>`;
    return;
  }

  members = [];
  for (const member of (data || [])) {
    let avatarUrl = '/assets/logo.jpeg';
    if (member.avatar_path) {
      const signed = await supabase.storage
        .from('member-avatars')
        .createSignedUrl(member.avatar_path, 3600);
      if (signed.data?.signedUrl) avatarUrl = signed.data.signedUrl;
    }
    members.push({ ...member, avatarUrl });
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const rank = rankFilter.value;

    const visible = members.filter(member => {
      const text = [
        member.full_name, member.preferred_name,
        member.city, member.state, member.rank
      ].filter(Boolean).join(' ').toLowerCase();

      return (!q || text.includes(q)) && (!rank || member.rank === rank);
    });

    grid.innerHTML = visible.length ? visible.map(member => `
      <article class="team-member-card">
        <img src="${esc(member.avatarUrl)}" alt="${esc(member.preferred_name || member.full_name)}" loading="lazy" decoding="async">
        <div>
          <small>${esc(member.rank)}${member.founding_member ? ' • Founding Member' : ''}</small>
          <h2>${esc(member.preferred_name || member.full_name)}</h2>
          <p>${esc([member.city, member.state].filter(Boolean).join(', ') || 'Location not listed')}</p>
          <div class="profile-social-row">
            <a href="/professional-profile/?member=${encodeURIComponent(member.id)}">View professional profile</a>
          </div>
        </div>
      </article>
    `).join('') : '<div class="member-empty-state"><h2>No matching members.</h2></div>';
  }

  search.addEventListener('input', render);
  rankFilter.addEventListener('change', render);
  render();
})();
