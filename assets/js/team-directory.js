
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

  if (!window.DSAuth?.ready) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication service is temporarily unavailable.</h1>';
    return;
  }

  try { supabase = await window.DSAuth.init(); } catch (_) {}
  if (!supabase) {
    gate.textContent = 'Unable to initialize the secure directory. Refresh and sign in again.';
    return;
  }
  let sessionResult;
  try { sessionResult = await supabase.auth.getSession(); }
  catch (_) {
    gate.textContent = 'Unable to verify your session. Check your connection and refresh.';
    return;
  }
  if (sessionResult.error) {
    gate.textContent = 'Unable to verify your secure session. Refresh and sign in again.';
    return;
  }
  const session = sessionResult.data?.session;

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

  // Render the directory without waiting for private signed-photo requests.
  // Each profile-photo request runs independently and must never block names.
  members = (data || []).map(member => ({ ...member, avatarUrl:'' }));
  const initials = name => String(name || 'DS').trim().split(/\s+/).filter(Boolean)
    .slice(0,2).map(part => part.charAt(0)).join('').toUpperCase() || 'DS';
  async function loadSignedPhoto(member) {
    if (!member.avatar_path) return;
    try {
      const signed = await Promise.race([
        supabase.storage.from('member-avatars').createSignedUrl(member.avatar_path, 3600),
        new Promise((_,reject) => setTimeout(() => reject(new Error('Photo timed out')), 5000))
      ]);
      if (signed.error || !signed.data?.signedUrl) return;
      const current = members.find(item => item.id === member.id);
      if (!current || current.avatar_path !== member.avatar_path) return;
      current.avatarUrl = signed.data.signedUrl;
      // Update the photo, not the card tree: preserve search, focus, and scroll.
      const card = [...grid.querySelectorAll('[data-member-id]')]
        .find(node => node.dataset.memberId === String(member.id));
      const avatar = card?.querySelector('.team-member-avatar');
      if (!avatar) return;
      let image = avatar.querySelector('img');
      if (!image) {
        image = document.createElement('img');
        image.alt = current.preferred_name || current.full_name || 'Member photo';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => image.remove(), {once:true});
        avatar.appendChild(image);
      }
      image.src = current.avatarUrl;
    } catch (_) { /* Name initials remain available and interactive. */ }
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
      <article class="team-member-card" data-member-id="${esc(member.id)}">
        <div class="team-member-avatar">
          <span class="team-member-initials" aria-hidden="true">${esc(initials(member.preferred_name || member.full_name))}</span>
          ${member.avatarUrl ? `<img src="${esc(member.avatarUrl)}" alt="${esc(member.preferred_name || member.full_name)}" loading="lazy" decoding="async">` : ''}
        </div>
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
  members.forEach(member => { void loadSignedPhoto(member); });
})();
