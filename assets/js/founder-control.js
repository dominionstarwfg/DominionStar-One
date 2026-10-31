
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
    memberRows.innerHTML = '<tr><td colspan="10">Loading members…</td></tr>';
    const { data, error } = await supabase
      .from('member_profiles')
      .select('id,full_name,email,agent_code,smd_name,verification_status,rank,founding_member,exclusive_member_number,joined_at,account_notes')
      .order('joined_at', { ascending: false });

    if (error) {
      memberRows.innerHTML = `<tr><td colspan="10">${esc(error.message)}</td></tr>`;
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
        <td>
          <label class="founder-exclusive-control">
            <input class="founder-checkbox founding-check" type="checkbox" aria-label="Exclusive 20 status for ${esc(member.full_name)}" ${member.founding_member?'checked':''}>
            <span>${Number(member.exclusive_member_number)>=1&&Number(member.exclusive_member_number)<=20?'#'+Number(member.exclusive_member_number):'Not assigned'}</span>
          </label>
        </td>
        <td>
          <button class="btn btn-outline recognize-member" type="button" data-member-id="${member.id}">
            Recognize
          </button>
        </td>
        <td><input class="founder-notes notes-input" value="${esc(member.account_notes || '')}" placeholder="Private founder note" aria-label="Founder notes for ${esc(member.full_name)}"></td>
        <td><button class="btn btn-gold save-member" type="button">Save Changes</button></td>
      </tr>
    `).join('') : '<tr><td colspan="10">No matching members.</td></tr>';

    if (memberCount) memberCount.textContent = `${allMembers.length} member${allMembers.length === 1 ? '' : 's'}`;
    if (memberVisibleCount) memberVisibleCount.textContent = filtered.length === allMembers.length
      ? `Showing all ${filtered.length}`
      : `Showing ${filtered.length} of ${allMembers.length}`;

    document.querySelectorAll('.save-member').forEach(button => {
      button.addEventListener('click', saveMember);
    });
    document.querySelectorAll('.recognize-member').forEach(button => {
      button.addEventListener('click', recognizeAdvancement);
    });
  }

  async function saveMember(event) {
    const row = event.currentTarget.closest('tr');
    const targetId = row.dataset.id;
    const original = allMembers.find(member => member.id === targetId);
    const status = row.querySelector('.status-select').value;
    const rank = row.querySelector('.rank-select').value;
    const founding = row.querySelector('.founding-check').checked;
    const notes = row.querySelector('.notes-input').value.trim();

    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Saving…';

    // Member status/rank/notes and Exclusive-20 numbering have different
    // authoritative RPCs. Do not let the old boolean-only field pretend a
    // founding number was assigned.
    const memberUpdate = await supabase.rpc('founder_update_member', {
      target_user_id: targetId,
      new_status: status,
      new_rank: rank,
      mark_founding_member: null,
      new_notes: notes || null
    });

    if (memberUpdate.error) {
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = 'Error';
      return;
    }

    const exclusiveUpdate = await supabase.rpc('assign_exclusive_founding_number', {
      target_user_id: targetId,
      should_be_founding: founding
    });

    if (exclusiveUpdate.error) {
      // Best-effort restoration of the original founding state. Rank/status
      // remain authoritative from founder_update_member and are not hidden.
      if (original) {
        try {
          await supabase.rpc('assign_exclusive_founding_number', {
            target_user_id: targetId,
            should_be_founding: Boolean(original.founding_member)
          });
        } catch (_rollbackError) {}
      }
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = 'Exclusive 20 error';
      const result = document.getElementById('founderRecognitionResult');
      if (result) message(result, 'Member changes saved, but Exclusive 20 assignment failed: '+exclusiveUpdate.error.message, 'error');
      await Promise.all([loadMembers(), loadSummary()]);
      return;
    }

    event.currentTarget.disabled = false;
    event.currentTarget.textContent = 'Saved';
    setTimeout(() => event.currentTarget.textContent = 'Save Changes', 1200);
    await Promise.all([loadMembers(), loadSummary()]);
  }

  async function recognizeAdvancement(event) {
    const button = event.currentTarget;
    const targetId = button.dataset.memberId;
    const member = allMembers.find(item => item.id === targetId);
    const result = document.getElementById('founderRecognitionResult');
    if (!member || !result) return;

    button.disabled = true;
    button.textContent = 'Verifying…';
    message(result, 'Verifying the latest contract-level advancement…');

    try {
      const history = await supabase
        .from('rank_history')
        .select('id,previous_rank,new_rank,created_at')
        .eq('user_id',targetId)
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();
      if (history.error) throw history.error;
      if (!history.data) throw new Error('No verified contract-level advancement is recorded for this member.');
      if (history.data.new_rank !== member.rank) {
        throw new Error('The latest rank-history record does not match the member’s current contract level.');
      }

      const title = `Leadership Recognition · ${member.full_name}`;
      const existing = await supabase
        .from('community_messages')
        .select('id,created_at,title')
        .eq('user_id',session.user.id)
        .eq('post_type','announcement')
        .eq('title',title)
        .gte('created_at',history.data.created_at)
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        message(result, `${member.full_name} is already recognized for the current advancement.`, 'success');
        button.textContent = 'Recognized';
        return;
      }

      const previous = history.data.previous_rank || 'previous contract level';
      const body = `Congratulations to ${member.full_name} on advancing from ${previous} to ${member.rank}. DominionStar recognizes this verified leadership milestone and the continued commitment to professional growth, service, and leadership.`;
      const published = await supabase
        .from('community_messages')
        .insert({
          user_id:session.user.id,
          title,
          body,
          post_type:'announcement',
          is_pinned:false
        })
        .select('id,created_at')
        .single();
      if (published.error) throw published.error;

      const verified = await supabase
        .from('community_messages')
        .select('id')
        .eq('id',published.data.id)
        .maybeSingle();
      if (verified.error || !verified.data) throw new Error('The recognition post could not be verified after publishing.');

      message(result, `Recognition published for ${member.full_name} · ${member.rank}.`, 'success');
      button.textContent = 'Recognized';
    } catch (error) {
      message(result, error?.message || 'Recognition could not be published.', 'error');
      button.textContent = 'Recognize';
    } finally {
      setTimeout(()=>{button.disabled=false;if(button.textContent==='Recognized')button.textContent='Recognize'},1800);
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
