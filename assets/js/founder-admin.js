
(async () => {
  const gate = document.getElementById('founderGate');
  const app = document.getElementById('founderApp');
  const memberRows = document.getElementById('memberRows');
  const searchInput = document.getElementById('memberSearch');
  const statusFilter = document.getElementById('statusFilter');
  const rankFilter = document.getElementById('rankFilter');
  const refreshButton = document.getElementById('founderRefresh');
  const logoutButton = document.getElementById('founderLogout');
  const announcementForm = document.getElementById('announcementForm');
  const announcementResult = document.getElementById('announcementResult');
  const feedbackRows = document.getElementById('feedbackRows');
  const auditRows = document.getElementById('auditRows');
  const mindsetUploadForm = document.getElementById('mindsetUploadForm');
  const mindsetUploadResult = document.getElementById('mindsetUploadResult');
  const mindsetAdminRows = document.getElementById('mindsetAdminRows');
  const commandOnline = document.getElementById('commandOnline');
  const commandUnreadMessages = document.getElementById('commandUnreadMessages');
  const commandMeetingsToday = document.getElementById('commandMeetingsToday');
  const commandPending = document.getElementById('commandPending');
  const commandJourneyToday = document.getElementById('commandJourneyToday');
  const commandRecognitionToday = document.getElementById('commandRecognitionToday');
  const commandPriorityCount = document.getElementById('commandPriorityCount');
  const commandPriorityList = document.getElementById('commandPriorityList');
  const commandHealthScore = document.getElementById('commandHealthScore');
  const commandHealthList = document.getElementById('commandHealthList');
  const commandActivityList = document.getElementById('commandActivityList');
  const commandAuroraBrief = document.getElementById('commandAuroraBrief');
  const commandRefreshActivity = document.getElementById('commandRefreshActivity');

  let supabase;
  let session;
  let allMembers = [];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  function show(target, text, type='info') {
    if (!target) return;
    target.textContent = text;
    target.className = `member-message show ${type}`;
  }

  if (!window.DSAuth?.ready) {
    show(gate, 'Authentication configuration is unavailable.', 'error');
    return;
  }

  supabase = await window.DSAuth.init();
  const authResult = await supabase.auth.getSession();
  session = authResult.data.session;

  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  await supabase.rpc('ensure_member_profile');

  const permission = await supabase.rpc('is_dominionstar_founder');
  const founderAllowed = permission.data === true
    || ['dominionstarld@gmail.com','dominionstarwfg@gmail.com'].includes(session.user.email?.toLowerCase());

  if (!founderAllowed) {
    show(gate, 'Founder access has not been enabled for this account.', 'error');
    return;
  }

  const founderResult = await supabase
    .from('member_profiles')
    .select('full_name,email,role,is_founder')
    .eq('id', session.user.id)
    .maybeSingle();

  const founder = founderResult.data || {};
  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');
  document.getElementById('founderName').textContent =
    founder.full_name || session.user.user_metadata?.full_name || 'Founder';
  const hour = new Date().getHours();
  document.getElementById('commandDaypart').textContent =
    hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';



  const startOfToday = () => {
    const value = new Date();
    value.setHours(0,0,0,0);
    return value.toISOString();
  };

  const eventIcon = type => ({
    'message.created':'💬',
    'journey.milestone.completed':'◆',
    'recognition.awarded':'🏆',
    'meeting.created':'📅',
    'academy.lesson.completed':'🎓',
    'member.approved':'✓'
  }[type] || '✦');

  async function loadCommandSnapshot() {
    const today = startOfToday();
    const results = await Promise.allSettled([
      supabase.from('community_presence')
        .select('user_id,last_seen_at,status')
        .gte('last_seen_at', new Date(Date.now() - 120000).toISOString()),
      supabase.from('direct_messages')
        .select('id',{count:'exact',head:true})
        .is('read_at',null)
        .eq('is_deleted',false),
      supabase.from('member_appointments')
        .select('id',{count:'exact',head:true})
        .gte('starts_at',today)
        .lt('starts_at',new Date(new Date(today).getTime()+86400000).toISOString()),
      supabase.from('member_profiles')
        .select('id',{count:'exact',head:true})
        .eq('verification_status','pending'),
      supabase.from('executive_events')
        .select('id',{count:'exact',head:true})
        .eq('event_type','journey.milestone.completed')
        .gte('created_at',today),
      supabase.from('executive_events')
        .select('id',{count:'exact',head:true})
        .eq('event_type','recognition.awarded')
        .gte('created_at',today)
    ]);

    const readCount = result => {
      if (result.status !== 'fulfilled' || result.value.error) {
        return { value: 0, available: false };
      }
      return {
        value: result.value.count ?? result.value.data?.length ?? 0,
        available: true
      };
    };

    const metrics = results.map(readCount);
    const elements = [
      commandOnline,
      commandUnreadMessages,
      commandMeetingsToday,
      commandPending,
      commandJourneyToday,
      commandRecognitionToday
    ];
    metrics.forEach((metric, index) => {
      elements[index].textContent = metric.available ? metric.value : '—';
      elements[index].closest('article')?.classList.toggle('data-unavailable', !metric.available);
      elements[index].closest('article')?.setAttribute(
        'title',
        metric.available ? 'Live data' : 'Data is temporarily unavailable'
      );
    });

    const updated = document.getElementById('founderSnapshotUpdated');
    const unavailableCount = metrics.filter(metric => !metric.available).length;
    if (updated) {
      updated.textContent = unavailableCount
        ? `Updated with ${unavailableCount} unavailable source${unavailableCount === 1 ? '' : 's'}`
        : `Updated ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
    }

    return {
      online:metrics[0].value,
      unread:metrics[1].value,
      meetings:metrics[2].value,
      pending:metrics[3].value,
      journeys:metrics[4].value,
      recognitions:metrics[5].value,
      unavailableCount
    };
  }

  async function loadCommandPriorities(snapshot) {
    const priorities = [];
    if (snapshot.pending) priorities.push({
      title:`Approve ${snapshot.pending} pending member${snapshot.pending === 1 ? '' : 's'}`,
      detail:'Review identity, agent code, and contract level.',
      url:'#memberRows'
    });
    if (snapshot.unread) priorities.push({
      title:`Review ${snapshot.unread} unread message${snapshot.unread === 1 ? '' : 's'}`,
      detail:'Organization conversations need attention.',
      url:'/direct-messages/'
    });
    if (snapshot.meetings) priorities.push({
      title:`Prepare for ${snapshot.meetings} meeting${snapshot.meetings === 1 ? '' : 's'} today`,
      detail:'Review appointments and meeting details.',
      url:'/founder-appointments/'
    });

    const feedback = await supabase.from('member_feedback')
      .select('id',{count:'exact',head:true});
    if (!feedback.error && feedback.count) priorities.push({
      title:`Review ${feedback.count} member feedback item${feedback.count === 1 ? '' : 's'}`,
      detail:'Member feedback can reveal operational issues.',
      url:'#feedbackRows'
    });

    commandPriorityCount.textContent = priorities.length;
    commandPriorityList.innerHTML = priorities.length
      ? priorities.map(item => `
        <a class="command-priority-item" href="${item.url}">
          <span>!</span>
          <div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div>
          <b>→</b>
        </a>`).join('')
      : '<div class="command-clear-state"><strong>All clear.</strong><p>No critical priorities require attention.</p></div>';
  }

  async function loadCommandHealth(snapshot) {
    const inactiveResult = await supabase.from('community_presence')
      .select('user_id',{count:'exact',head:true})
      .lt('last_seen_at',new Date(Date.now()-7*86400000).toISOString());

    const approvedResult = await supabase.from('member_profiles')
      .select('id',{count:'exact',head:true})
      .eq('verification_status','approved');

    const inactive = inactiveResult.error ? 0 : (inactiveResult.count || 0);
    const approved = approvedResult.error ? 0 : (approvedResult.count || 0);
    const activeRate = approved ? Math.max(0,Math.round(((approved-inactive)/approved)*100)) : 100;
    const healthScore = Math.max(0,Math.min(100,
      activeRate
      - Math.min(snapshot.pending*2,20)
      + Math.min(snapshot.journeys,8)
      + Math.min(snapshot.recognitions,6)
    ));

    if (snapshot.unavailableCount) {
      commandHealthScore.textContent = '—';
      commandHealthList.innerHTML = `
        <div class="command-clear-state"><strong>Organization status is partially unavailable.</strong><p>Refresh after the data connection is restored. No values are being estimated.</p></div>`;
      return;
    }

    commandHealthScore.textContent = `${healthScore}%`;
    commandHealthList.innerHTML = `
      <div class="command-health-row"><span class="${activeRate >= 80 ? 'good' : 'warn'}"></span><div><strong>${activeRate}% active</strong><p>Approved members seen within 7 days.</p></div></div>
      <div class="command-health-row"><span class="${inactive ? 'warn' : 'good'}"></span><div><strong>${inactive} inactive member${inactive === 1 ? '' : 's'}</strong><p>No recent platform activity.</p></div></div>
      <div class="command-health-row"><span class="${snapshot.pending ? 'warn' : 'good'}"></span><div><strong>${snapshot.pending} approval${snapshot.pending === 1 ? '' : 's'} pending</strong><p>Verification queue status.</p></div></div>
      <div class="command-health-row"><span class="good"></span><div><strong>${snapshot.journeys} journey milestone${snapshot.journeys === 1 ? '' : 's'} today</strong><p>Professional development activity.</p></div></div>`;
  }

  async function loadCommandActivity() {
    if (!window.ExecutiveCore) {
      commandActivityList.innerHTML = '<p class="dsos-muted">Executive Core is unavailable.</p>';
      return;
    }
    try {
      const events = await window.ExecutiveCore.list({limit:14});
      commandActivityList.innerHTML = events.length
        ? events.map(event => `
          <article class="command-activity-item">
            <span>${eventIcon(event.event_type)}</span>
            <div><strong>${esc(event.title)}</strong><p>${esc(event.description || '')}</p><small>${new Date(event.created_at).toLocaleString()}</small></div>
          </article>`).join('')
        : '<div class="command-clear-state"><strong>No organization activity yet.</strong><p>Messages, milestones, recognitions, and meetings will appear here.</p></div>';
    } catch (error) {
      commandActivityList.innerHTML = `<div class="dashboard-load-error"><strong>Activity unavailable.</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  function renderAuroraBrief(snapshot) {
    const items = [];
    if (snapshot.unread) items.push(`${snapshot.unread} unread message${snapshot.unread === 1 ? '' : 's'} need review.`);
    if (snapshot.pending) items.push(`${snapshot.pending} member approval${snapshot.pending === 1 ? '' : 's'} are pending.`);
    if (snapshot.meetings) items.push(`${snapshot.meetings} meeting${snapshot.meetings === 1 ? '' : 's'} are scheduled today.`);
    if (snapshot.journeys) items.push(`${snapshot.journeys} journey milestone${snapshot.journeys === 1 ? '' : 's'} were completed today.`);
    if (snapshot.unavailableCount) {
      items.push(`${snapshot.unavailableCount} data source${snapshot.unavailableCount === 1 ? ' is' : 's are'} temporarily unavailable.`);
    }
    if (!items.length) items.push('You are all caught up. Nothing requires your attention today.');

    commandAuroraBrief.innerHTML = `
      <p>Today’s executive briefing:</p>
      <ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  async function loadCommandCenter() {
    const snapshot = await loadCommandSnapshot();
    await Promise.all([
      loadCommandPriorities(snapshot),
      loadCommandHealth(snapshot),
      loadCommandActivity()
    ]);
    renderAuroraBrief(snapshot);
  }

  async function loadOperationsSnapshot() {
    const [appointments, posts, comments, feedback] = await Promise.allSettled([
      supabase.from('member_appointments')
        .select('id',{count:'exact',head:true})
        .eq('status','pending'),
      supabase.from('community_messages')
        .select('id',{count:'exact',head:true})
        .eq('is_deleted',false),
      supabase.from('community_comments')
        .select('id',{count:'exact',head:true})
        .eq('is_deleted',false),
      supabase.from('member_feedback')
        .select('id',{count:'exact',head:true})
    ]);

    const countOf = result =>
      result.status === 'fulfilled' && !result.value.error
        ? (result.value.count || 0)
        : 0;

    const values = {
      livePendingAppointments: countOf(appointments),
      liveCommunityPosts: countOf(posts),
      liveCommunityComments: countOf(comments),
      liveFeedbackCount: countOf(feedback)
    };

    for (const [id,value] of Object.entries(values)) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }

    const updated = document.getElementById('founderSnapshotUpdated');
    if (updated) updated.textContent = `Updated ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
  }

  async function loadSummary() {
    const { data, error } = await supabase.rpc('founder_member_summary');
    if (error) {
      console.error('Summary:', error);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    const values = {
      statTotal: row.total_members,
      statPending: row.pending_members,
      statApproved: row.approved_members,
      statTA: row.ta_count,
      statAssociate: row.associate_count,
      statSA: row.sa_count,
      statMD: row.md_count,
      statSMD: row.smd_count
    };

    for (const [id, value] of Object.entries(values)) {
      const element = document.getElementById(id);
      if (element) element.textContent = value ?? 0;
    }
  }

  async function loadAnalytics() {
    const { data, error } = await supabase.rpc('founder_analytics');
    if (error) {
      console.error('Analytics:', error);
      return;
    }
    const analytics = Array.isArray(data) ? data[0] : data;
    if (!analytics) return;
    document.getElementById('analytics30').textContent = analytics.members_last_30_days ?? 0;
    document.getElementById('analyticsApproval').textContent = `${analytics.approval_rate ?? 0}%`;
    document.getElementById('analyticsFounding').textContent = analytics.founding_members ?? 0;
  }


  async function queueApprovalEmail(memberId) {
    const result = await supabase.rpc('queue_member_approval_email', {
      target_user_id: memberId
    });

    if (result.error) {
      alert(result.error.message);
      return false;
    }

    alert('Approval email queued. It will be sent by the email processor.');
    return true;
  }

  async function loadMembers() {
    memberRows.innerHTML = '<tr><td colspan="9">Loading members…</td></tr>';

    const { data, error } = await supabase
      .from('member_profiles')
      .select('id,full_name,preferred_name,email,agent_code,smd_name,verification_status,rank,founding_member,exclusive_member_number,role,is_founder,joined_at,account_notes')
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
    const rank = rankFilter.value;

    const filtered = allMembers.filter(member => {
      const text = [
        member.full_name, member.preferred_name, member.email,
        member.agent_code, member.smd_name
      ].filter(Boolean).join(' ').toLowerCase();

      return (!query || text.includes(query))
        && (!status || member.verification_status === status)
        && (!rank || member.rank === rank);
    });

    memberRows.innerHTML = filtered.length ? filtered.map(member => {
      const lockedFounder = member.role === 'founder'
        || member.is_founder
        || ['dominionstarld@gmail.com','dominionstarwfg@gmail.com'].includes(member.email?.toLowerCase());

      return `
      <tr data-id="${member.id}">
        <td>
          <a class="text-link" href="/member-profile/?id=${member.id}">
            <strong>${esc(member.preferred_name || member.full_name)}</strong>
          </a><br>
          <small>${esc(member.email)}</small>
          ${lockedFounder ? '<br><span class="founding-member-badge">Founder</span>' : ''}${member.exclusive_member_number ? `<br><span class="exclusive-20-badge">Exclusive #${member.exclusive_member_number}</span>` : ''}
        </td>
        <td>${esc(member.agent_code)}</td>
        <td>${esc(member.smd_name || '—')}</td>
        <td><span class="member-status ${esc(member.verification_status)}">${esc(member.verification_status)}</span></td>
        <td>
          <select class="founder-select status-select" ${lockedFounder ? 'disabled' : ''}>
            ${['pending','approved','declined','suspended'].map(value =>
              `<option value="${value}" ${member.verification_status===value?'selected':''}>${value}</option>`
            ).join('')}
          </select>
        </td>
        <td>
          <select class="founder-select rank-select contract-level-select" aria-label="Change contract level" ${lockedFounder ? 'disabled' : ''}>
            ${['TA','Associate','SA','MD','SMD'].map(value =>
              `<option value="${value}" ${member.rank===value?'selected':''}>${value}</option>`
            ).join('')}
          </select>
        </td>
        <td><label class="exclusive-toggle"><input class="founder-checkbox founding-check" type="checkbox" ${member.founding_member?'checked':''} ${lockedFounder ? 'disabled' : ''}><span>${member.exclusive_member_number ? `#${member.exclusive_member_number}` : 'Badge'}</span></label></td>
        <td><input class="founder-notes notes-input" value="${esc(member.account_notes || '')}" placeholder="Private note"></td>
        <td><button class="btn btn-gold save-member" type="button">${lockedFounder ? 'Save Note' : 'Save Changes'}</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="9">No matching members.</td></tr>';

    document.querySelectorAll('.save-member').forEach(button => {
      button.addEventListener('click', saveMember);
    });
  }

  async function saveMember(event) {
    const row = event.currentTarget.closest('tr');
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Saving…';

    const statusSelect = row.querySelector('.status-select');
    const rankSelect = row.querySelector('.rank-select');
    const foundingCheck = row.querySelector('.founding-check');

    let badgeError = null;

    if (!foundingCheck.disabled) {
      const badgeResult = await supabase.rpc('assign_exclusive_founding_number', {
        target_user_id: row.dataset.id,
        should_be_founding: foundingCheck.checked
      });
      badgeError = badgeResult.error;
    }

    const memberResult = badgeError ? { error: badgeError } : await supabase.rpc('founder_update_member', {
      target_user_id: row.dataset.id,
      new_status: statusSelect.disabled ? null : statusSelect.value,
      new_rank: rankSelect.disabled ? null : rankSelect.value,
      mark_founding_member: foundingCheck.disabled ? null : foundingCheck.checked,
      new_notes: row.querySelector('.notes-input').value.trim() || null
    });

    const error = memberResult.error;

    button.disabled = false;

    if (error) {
      button.textContent = 'Try Again';
      alert(`Could not save member: ${error.message}`);
      return;
    }

    button.textContent = 'Saved';
    setTimeout(() => button.textContent = 'Save Changes', 1200);
    await Promise.all([loadMembers(), loadSummary(), loadAnalytics(), loadAudit(), loadOperationsSnapshot()]);
  }

  async function loadFeedback() {
    const { data, error } = await supabase
      .from('member_feedback')
      .select('feedback_type,message,created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    feedbackRows.innerHTML = error
      ? `<tr><td colspan="3">${esc(error.message)}</td></tr>`
      : (data || []).length
        ? data.map(item => `
          <tr>
            <td>${esc(item.feedback_type)}</td>
            <td>${esc(item.message)}</td>
            <td>${new Date(item.created_at).toLocaleString()}</td>
          </tr>`).join('')
        : '<tr><td colspan="3">No feedback yet.</td></tr>';
  }

  async function loadAudit() {
    if (!auditRows) return;

    const { data, error } = await supabase
      .from('audit_log')
      .select('action,details,created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    auditRows.innerHTML = error
      ? `<tr><td colspan="3">${esc(error.message)}</td></tr>`
      : (data || []).length
        ? data.map(item => `
          <tr>
            <td>${esc(item.action)}</td>
            <td><code>${esc(JSON.stringify(item.details))}</code></td>
            <td>${new Date(item.created_at).toLocaleString()}</td>
          </tr>`).join('')
        : '<tr><td colspan="3">No audit activity yet.</td></tr>';
  }


  function safeFilename(filename) {
    const extension = filename.includes('.')
      ? `.${filename.split('.').pop().toLowerCase()}`
      : '';
    const base = filename
      .replace(/\.[^/.]+$/, '')
      .normalize('NFKD')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'media';

    return `${base}${extension}`;
  }

  function mindsetMediaType(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    return null;
  }

  async function loadMindsetContent() {
    if (!mindsetAdminRows) return;

    mindsetAdminRows.innerHTML =
      '<tr><td colspan="6">Loading mindset content…</td></tr>';

    const { data, error } = await supabase
      .from('mindset_content')
      .select('id,title,media_type,target_rank,is_featured,is_active,storage_path,created_at')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      mindsetAdminRows.innerHTML =
        `<tr><td colspan="6">${esc(error.message)}</td></tr>`;
      return;
    }

    const rows = data || [];

    mindsetAdminRows.innerHTML = rows.length
      ? rows.map(item => `
        <tr data-content-id="${item.id}">
          <td><strong>${esc(item.title)}</strong></td>
          <td>${esc(item.media_type)}</td>
          <td>${esc(item.target_rank || 'All approved members')}</td>
          <td>${item.is_featured ? 'Yes' : 'No'}</td>
          <td>${new Date(item.created_at).toLocaleString()}</td>
          <td>
            <button
              class="btn btn-outline delete-mindset-content"
              type="button"
              data-content-id="${item.id}"
            >Delete</button>
          </td>
        </tr>
      `).join('')
      : '<tr><td colspan="6">No mindset content has been published yet.</td></tr>';

    mindsetAdminRows
      .querySelectorAll('.delete-mindset-content')
      .forEach(button => {
        button.addEventListener('click', async () => {
          if (!confirm('Delete this published content and its media file?')) {
            return;
          }

          button.disabled = true;
          button.textContent = 'Deleting…';

          const result = await supabase.rpc(
            'founder_delete_mindset_content',
            { target_content_id: button.dataset.contentId }
          );

          if (result.error) {
            alert(result.error.message);
            button.disabled = false;
            button.textContent = 'Delete';
            return;
          }

          const storagePath = result.data;
          if (storagePath) {
            const removal = await supabase.storage
              .from('mindset-media')
              .remove([storagePath]);

            if (removal.error) {
              console.warn(
                'Content row deleted, but the media object could not be removed:',
                removal.error
              );
            }
          }

          await loadMindsetContent();
        });
      });
  }

  mindsetUploadForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const file = mindsetUploadForm.media.files?.[0];
    const mediaType = file ? mindsetMediaType(file) : null;
    const allowedTypes = new Set([
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]);

    if (!file) {
      show(mindsetUploadResult, 'Choose a video or image first.', 'error');
      return;
    }

    if (!mediaType || !allowedTypes.has(file.type)) {
      show(
        mindsetUploadResult,
        'Unsupported file type. Use MP4, WebM, MOV, JPG, PNG, or WebP.',
        'error'
      );
      return;
    }

    if (file.size > 104857600) {
      show(
        mindsetUploadResult,
        'This file is larger than the 100 MB upload limit.',
        'error'
      );
      return;
    }

    const submitButton = mindsetUploadForm.querySelector(
      'button[type="submit"]'
    );
    submitButton.disabled = true;
    submitButton.textContent = 'Uploading…';
    show(mindsetUploadResult, 'Uploading media…', 'info');

    const storagePath = [
      session.user.id,
      new Date().toISOString().slice(0, 10),
      `${crypto.randomUUID()}-${safeFilename(file.name)}`
    ].join('/');

    const upload = await supabase.storage
      .from('mindset-media')
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      });

    if (upload.error) {
      submitButton.disabled = false;
      submitButton.textContent = 'Upload and Publish';
      show(
        mindsetUploadResult,
        `Upload failed: ${upload.error.message}`,
        'error'
      );
      return;
    }

    show(mindsetUploadResult, 'Media uploaded. Publishing content…', 'info');

    const insert = await supabase
      .from('mindset_content')
      .insert({
        title: mindsetUploadForm.title.value.trim(),
        description:
          mindsetUploadForm.description.value.trim() || null,
        media_type: mediaType,
        storage_path: storagePath,
        target_rank:
          mindsetUploadForm.target_rank.value || null,
        is_featured:
          mindsetUploadForm.is_featured.checked,
        is_active: true,
        created_by: session.user.id
      })
      .select('id')
      .single();

    if (insert.error) {
      await supabase.storage
        .from('mindset-media')
        .remove([storagePath]);

      submitButton.disabled = false;
      submitButton.textContent = 'Upload and Publish';
      show(
        mindsetUploadResult,
        `The file uploaded, but publishing failed: ${insert.error.message}`,
        'error'
      );
      return;
    }

    mindsetUploadForm.reset();
    submitButton.disabled = false;
    submitButton.textContent = 'Upload and Publish';
    show(
      mindsetUploadResult,
      'Content published successfully. It is now visible to the selected audience.',
      'success'
    );

    await loadMindsetContent();
  });


  announcementForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button=announcementForm.querySelector('[type="submit"]');
    const title=announcementForm.title.value.trim(),body=announcementForm.body.value.trim();
    button.disabled=true;button.textContent='Publishing…';
    show(announcementResult, 'Publishing to the member Community…', 'info');
    try {
      const community=await supabase.from('community_messages').insert({user_id:session.user.id,title,body,post_type:'announcement',is_pinned:true}).select('id,created_at').single();
      if(community.error)throw community.error;
      const verified=await supabase.from('community_messages').select('id').eq('id',community.data.id).single();
      if(verified.error||!verified.data)throw new Error('The announcement was not visible after publishing.');
      const legacy=await supabase.from('founder_announcements').insert({title,body,is_active:true});
      if(legacy.error)console.warn('Legacy announcement mirror failed:',legacy.error.message);
      announcementForm.reset();
      show(announcementResult,'Announcement verified in Community. Refreshing…','success');
      setTimeout(()=>window.location.reload(),800);
    } catch(error) {
      show(announcementResult,error.message||String(error),'error');
      button.disabled=false;button.textContent='Publish Announcement';
    }
  });

  searchInput.addEventListener('input', renderMembers);
  statusFilter.addEventListener('change', renderMembers);
  rankFilter.addEventListener('change', renderMembers);

  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    await loadAll();
    refreshButton.disabled = false;
  });

  logoutButton.addEventListener('click', () => window.DSAuth.signOut());

  async function loadAll() {
    await Promise.all([
      loadMembers(),
      loadSummary(),
      loadAnalytics(),
      loadFeedback(),
      loadAudit(),
      loadMindsetContent(),
      loadOperationsSnapshot()
    ]);
  }

  await loadAll();

  document.addEventListener('click', async event => {
    const button = event.target.closest('.queue-approval-email');
    if (!button) return;

    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Queuing…';

    await queueApprovalEmail(button.dataset.memberId);

    button.disabled = false;
    button.textContent = original;
  });

})();
