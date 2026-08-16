
(async () => {
  const gate = document.getElementById('profileGate');
  const app = document.getElementById('profileApp');
  const params = new URLSearchParams(window.location.search);
  const memberId = params.get('id');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  if (!memberId || !window.DSAuth.ready) {
    gate.innerHTML = '<p class="eyebrow">Error</p><h1>Member profile unavailable</h1>';
    return;
  }

  const supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  const { data: founder } = await supabase
    .from('member_profiles')
    .select('is_founder')
    .eq('id', session.user.id)
    .single();

  if (!founder?.is_founder) {
    gate.innerHTML = '<p class="eyebrow">Restricted</p><h1>Founder access required</h1>';
    return;
  }

  const { data: profile, error } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('id', memberId)
    .single();

  if (error || !profile) {
    gate.innerHTML = '<p class="eyebrow">Error</p><h1>Member not found</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  document.getElementById('profileName').textContent = profile.full_name;
  document.getElementById('profileEmail').textContent = profile.email;
  document.getElementById('profileAgentCode').textContent = profile.agent_code || '—';
  document.getElementById('profileSmd').textContent = profile.smd_name || '—';
  document.getElementById('profileRank').textContent = profile.rank || 'TA';
  document.getElementById('profileNotes').textContent = profile.account_notes || 'No notes.';
  const status = document.getElementById('profileStatus');
  status.textContent = profile.verification_status;
  status.className = `member-status ${profile.verification_status}`;

  await supabase.rpc('ensure_default_milestones', { target_user_id: memberId });

  const { data: milestones } = await supabase
    .from('member_milestones')
    .select('*')
    .eq('user_id', memberId)
    .order('milestone_key');

  document.getElementById('milestoneList').innerHTML = (milestones || []).map(item => `
    <label>
      <input type="checkbox" data-key="${esc(item.milestone_key)}" ${item.completed ? 'checked' : ''}>
      <span><strong>${esc(item.milestone_label)}</strong><br><small>${item.completed ? 'Completed' : 'Not completed'}</small></span>
    </label>
  `).join('');

  document.querySelectorAll('#milestoneList input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', async () => {
      input.disabled = true;
      const { error } = await supabase.rpc('founder_set_milestone', {
        target_user_id: memberId,
        target_key: input.dataset.key,
        is_complete: input.checked
      });
      input.disabled = false;
      if (error) {
        input.checked = !input.checked;
        alert(error.message);
      }
    });
  });

  const { data: history } = await supabase
    .from('rank_history')
    .select('previous_rank,new_rank,note,created_at')
    .eq('user_id', memberId)
    .order('created_at', { ascending: false });

  document.getElementById('rankHistoryRows').innerHTML = (history || []).length
    ? history.map(item => `
      <tr>
        <td>${esc(item.previous_rank || '—')}</td>
        <td>${esc(item.new_rank)}</td>
        <td>${esc(item.note || '—')}</td>
        <td>${new Date(item.created_at).toLocaleString()}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4">No rank changes yet.</td></tr>';
})();
