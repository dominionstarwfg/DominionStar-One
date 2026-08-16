
(async () => {
  const gate = document.getElementById('founderGate');
  const app = document.getElementById('founderApp');
  const memberRows = document.getElementById('memberRows');
  const searchInput = document.getElementById('memberSearch');
  const statusFilter = document.getElementById('statusFilter');
  const rankFilter = document.getElementById('rankFilter');
  const memberCount = document.getElementById('memberCount');
  const memberVisibleCount = document.getElementById('memberVisibleCount');
  const refreshButton = document.getElementById('founderRefresh');
  const logoutButton = document.getElementById('founderLogout');
  const announcementForm = document.getElementById('announcementForm');
  const announcementResult = document.getElementById('announcementResult');

  let supabase;
  let allMembers = [];

  function message(target, text, type='info') {
    target.textContent = text;
    target.className = `member-message show ${type}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[c]));
  }

  if (!window.DSAuth.ready) {
    message(gate, 'Supabase configuration is not connected yet.', 'error');
    return;
  }

  supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('member_profiles')
    .select('full_name,is_founder')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile?.is_founder) {
    message(gate, 'This page is restricted to the DominionStar Founder account.', 'error');
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');
  document.getElementById('founderName').textContent = profile.full_name || 'Founder';

  async function loadSummary() {
    const { data, error } = await supabase.rpc('founder_member_summary');
    if (error) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    const map = {
      statTotal: row.total_members,
      statPending: row.pending_members,
      statApproved: row.approved_members,
      statTA: row.ta_count,
      statAssociate: row.associate_count,
      statSA: row.sa_count,
      statMD: row.md_count,
      statSMD: row.smd_count
    };
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value ?? 0;
    });
  }

  async function loadMembers() {
    memberRows.innerHTML = '<tr><td colspan="9">Loading members…</td></tr>';
    const { data, error } = await supabase
      .from('member_profiles')
      .select('id,full_name,email,agent_code,smd_name,verification_status,rank,founding_member,joined_at,account_notes')
      .order('joined_at', { ascending: false });

    if (error) {
      memberRows.innerHTML = `<tr><td colspan="9">${esc(error.message)}</td></tr>`;
      return;
    }

    allMembers = data || [];
    renderMembers();
  }

  function renderMembers() {
    const query = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const rank = rankFilter?.value || '';

    const filtered = allMembers.filter(member => {
      const haystack = `${member.full_name} ${member.email} ${member.agent_code} ${member.smd_name || ''}`.toLowerCase();
      return (!query || haystack.includes(query)) &&
        (!status || member.verification_status === status) &&
        (!rank || member.rank === rank);
    });

    memberRows.innerHTML = filtered.length ? filtered.map(member => `
      <tr data-id="${member.id}">
        <td><strong>${esc(member.full_name)}</strong><br><small>${esc(member.email)}</small></td>
        <td>${esc(member.agent_code)}</td>
        <td>${esc(member.smd_name || '—')}</td>
        <td><span class="founder-status-badge status-${esc(member.verification_status || 'pending')}">${esc(member.verification_status || 'pending')}</span></td>
        <td>
          <select class="founder-select status-select" aria-label="Set status for ${esc(member.full_name)}">
            ${['pending','approved','declined','suspended'].map(s =>
              `<option value="${s}" ${member.verification_status===s?'selected':''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td>
          <select class="founder-select rank-select" aria-label="Set contract level for ${esc(member.full_name)}">
            ${['TA','Associate','SA','MD','SMD'].map(r =>
              `<option value="${r}" ${member.rank===r?'selected':''}>${r}</option>`
            ).join('')}
          </select>
        </td>
        <td><input class="founder-checkbox founding-check" type="checkbox" aria-label="Exclusive 20 status for ${esc(member.full_name)}" ${member.founding_member?'checked':''}></td>
        <td><input class="founder-notes notes-input" value="${esc(member.account_notes || '')}" placeholder="Private founder note" aria-label="Founder notes for ${esc(member.full_name)}"></td>
        <td><button class="btn btn-gold save-member" type="button">Save Changes</button></td>
      </tr>
    `).join('') : '<tr><td colspan="9">No matching members.</td></tr>';

    if (memberCount) memberCount.textContent = `${allMembers.length} member${allMembers.length === 1 ? '' : 's'}`;
    if (memberVisibleCount) memberVisibleCount.textContent = filtered.length === allMembers.length
      ? `Showing all ${filtered.length}`
      : `Showing ${filtered.length} of ${allMembers.length}`;

    document.querySelectorAll('.save-member').forEach(button => {
      button.addEventListener('click', saveMember);
    });
  }

  async function saveMember(event) {
    const row = event.currentTarget.closest('tr');
    const targetId = row.dataset.id;
    const status = row.querySelector('.status-select').value;
    const rank = row.querySelector('.rank-select').value;
    const founding = row.querySelector('.founding-check').checked;
    const notes = row.querySelector('.notes-input').value.trim();

    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Saving…';

    const { error } = await supabase.rpc('founder_update_member', {
      target_user_id: targetId,
      new_status: status,
      new_rank: rank,
      mark_founding_member: founding,
      new_notes: notes || null
    });

    event.currentTarget.disabled = false;
    event.currentTarget.textContent = error ? 'Error' : 'Saved';

    if (!error) {
      setTimeout(() => event.currentTarget.textContent = 'Save', 1200);
      await Promise.all([loadMembers(), loadSummary()]);
    }
  }

  searchInput.addEventListener('input', renderMembers);
  statusFilter.addEventListener('change', renderMembers);
  rankFilter?.addEventListener('change', renderMembers);
  refreshButton.addEventListener('click', async () => {
    await Promise.all([loadMembers(), loadSummary()]);
  });

  logoutButton.addEventListener('click', () => window.DSAuth.signOut());

  announcementForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = announcementForm.title.value.trim();
    const body = announcementForm.body.value.trim();
    const button = announcementForm.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Publishing…';
    message(announcementResult, 'Publishing to the member Community…');
    try {
      const community = await supabase.from('community_messages').insert({
        user_id: session.user.id, title, body, post_type: 'announcement', is_pinned: true
      }).select('id,created_at').single();
      if (community.error) throw community.error;
      const verified = await supabase.from('community_messages').select('id').eq('id', community.data.id).single();
      if (verified.error || !verified.data) throw new Error('The announcement was not visible after publishing.');
      const legacy = await supabase.from('founder_announcements').insert({title, body, is_active: true});
      if (legacy.error) console.warn('Legacy announcement mirror failed:', legacy.error.message);
      announcementForm.reset();
      message(announcementResult, 'Announcement verified in Community. Refreshing…', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      message(announcementResult, error.message || String(error), 'error');
      button.disabled = false;
      button.textContent = 'Publish Announcement';
    }
  });

  await Promise.all([loadMembers(), loadSummary()]);
})();
