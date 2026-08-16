
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

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  const { data, error } = await supabase
    .from('member_profiles')
    .select('id,full_name,preferred_name,bio,city,state,rank,team_name,avatar_path,founding_member,linkedin_url,instagram_url,website_url')
    .eq('verification_status', 'approved')
    .eq('profile_visibility', 'members')
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
        member.full_name, member.preferred_name, member.bio,
        member.city, member.state, member.rank, member.team_name
      ].filter(Boolean).join(' ').toLowerCase();

      return (!q || text.includes(q)) && (!rank || member.rank === rank);
    });

    grid.innerHTML = visible.length ? visible.map(member => `
      <article class="team-member-card">
        <img src="${member.avatarUrl}" alt="${esc(member.preferred_name || member.full_name)}">
        <div>
          <small>${esc(member.rank)}${member.founding_member ? ' • Founding Member' : ''}</small>
          <h2>${esc(member.preferred_name || member.full_name)}</h2>
          <p>${esc(member.team_name || '')}</p>
          <p>${esc([member.city, member.state].filter(Boolean).join(', '))}</p>
          <p>${esc(member.bio || '')}</p>
          <div class="profile-social-row">
            ${member.linkedin_url ? `<a href="${esc(member.linkedin_url)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
            ${member.instagram_url ? `<a href="${esc(member.instagram_url)}" target="_blank" rel="noopener">Instagram</a>` : ''}
            ${member.website_url ? `<a href="${esc(member.website_url)}" target="_blank" rel="noopener">Website</a>` : ''}
          </div>
        </div>
      </article>
    `).join('') : '<div class="member-empty-state"><h2>No matching members.</h2></div>';
  }

  search.addEventListener('input', render);
  rankFilter.addEventListener('change', render);
  render();
})();
