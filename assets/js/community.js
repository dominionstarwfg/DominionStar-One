
(async () => {
  const gate = document.getElementById('communityGate');
  const app = document.getElementById('communityApp');
  const messages = document.getElementById('communityMessages');
  const form = document.getElementById('communityForm');
  const result = document.getElementById('communityResult');
  const connection = document.getElementById('communityConnection');
  const notificationForm = document.getElementById('notificationForm');
  const notificationResult = document.getElementById('notificationResult');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  if (!window.DSAuth?.ready) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication configuration is missing.</h1>';
    return;
  }

  const supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('member_profiles')
    .select('full_name,preferred_name,verification_status,role,is_founder')
    .eq('id',session.user.id)
    .single();

  if (profileError || profile?.verification_status !== 'approved') {
    gate.innerHTML = '<p class="eyebrow">Restricted</p><h1>Founder approval is required.</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  async function loadMessages() {
    const { data, error } = await supabase
      .from('community_messages')
      .select('id,user_id,body,is_pinned,created_at')
      .eq('is_deleted',false)
      .order('is_pinned',{ascending:false})
      .order('created_at',{ascending:true})
      .limit(100);

    if (error) {
      messages.innerHTML = `<p>${esc(error.message)}</p>`;
      return;
    }

    messages.innerHTML = (data || []).length ? data.map(item => {
      const member = item.member_profiles || {};
      return `
      <article class="community-message ${item.is_pinned ? 'pinned' : ''}">
        <div class="community-message-avatar">${esc((member.preferred_name || member.full_name || 'M').slice(0,1))}</div>
        <div>
          <div class="community-message-head">
            <strong>${esc(member.preferred_name || member.full_name || 'DominionStar Member')}</strong>
            <span>${esc(member.rank || 'TA')}</span>
            ${member.exclusive_member_number ? `<span>Exclusive #${member.exclusive_member_number}</span>` : ''}
          </div>
          <p>${esc(item.body)}</p>
          <small>${new Date(item.created_at).toLocaleString()}</small>
        </div>
      </article>`;
    }).join('') : '<div class="member-empty-state"><h2>Start the conversation.</h2><p>No messages have been posted yet.</p></div>';

    messages.scrollTop = messages.scrollHeight;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    result.textContent = 'Posting…';
    result.className = 'member-message show info';

    const body = form.body.value.trim();
    const { error } = await supabase.from('community_messages').insert({
      user_id:session.user.id,
      body
    });

    if (error) {
      result.textContent = error.message;
      result.className = 'member-message show error';
      return;
    }

    form.reset();
    result.textContent = 'Message posted.';
    result.className = 'member-message show success';
    await loadMessages();
  });

  const prefResult = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id',session.user.id)
    .maybeSingle();

  if (prefResult.data) {
    notificationForm.founder_updates.checked = prefResult.data.founder_updates;
    notificationForm.community_mentions.checked = prefResult.data.community_mentions;
    notificationForm.email_digest.value = prefResult.data.email_digest;
  }

  notificationForm.addEventListener('submit', async event => {
    event.preventDefault();

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id:session.user.id,
        founder_updates:notificationForm.founder_updates.checked,
        community_mentions:notificationForm.community_mentions.checked,
        email_digest:notificationForm.email_digest.value,
        updated_at:new Date().toISOString()
      });

    notificationResult.textContent = error ? error.message : 'Notification preferences saved.';
    notificationResult.className = `member-message show ${error ? 'error' : 'success'}`;
  });

  const channel = supabase
    .channel('dominionstar-community')
    .on(
      'postgres_changes',
      { event:'*',schema:'public',table:'community_messages' },
      loadMessages
    )
    .subscribe(status => {
      connection.textContent = status === 'SUBSCRIBED' ? 'Live' : 'Connecting…';
      connection.className = status === 'SUBSCRIBED' ? 'community-live' : '';
    });

  document.getElementById('communityLogout').addEventListener(
    'click',
    () => window.DSAuth.signOut()
  );

  await loadMessages();

  window.addEventListener('beforeunload', () => {
    supabase.removeChannel(channel);
  });
})();
