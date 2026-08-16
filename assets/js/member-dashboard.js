(async () => {
  const statusEl = document.getElementById('memberStatus');
  const nameEl = document.getElementById('memberName');
  const rankEl = document.getElementById('memberRank');
  const emailEl = document.getElementById('memberEmail');
  const agentCodeEl = document.getElementById('memberAgentCode');
  const logout = document.getElementById('memberLogout');
  const feedbackForm = document.getElementById('memberFeedbackForm');

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  const withTimeout = async (promise, timeoutMs = 9000) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('The request took too long. Please refresh.')),
            timeoutMs
          );
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  const setHtml = (id, html) => {
    const target = document.getElementById(id);
    if (target) target.innerHTML = html;
  };

  if (!window.DSAuth.ready) {
    window.location.href = '/member-login/';
    return;
  }

  const supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  const user = session.user;

  async function fetchProfile() {
    let result = await supabase
      .from('member_profiles')
      .select(
        'full_name,preferred_name,email,agent_code,smd_name,verification_status,' +
        'rank,founding_member,exclusive_member_number,is_founder,role,avatar_path'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (!result.data) {
      const created = await supabase.rpc('ensure_member_profile');
      if (!created.error) {
        result = await supabase
          .from('member_profiles')
          .select(
            'full_name,preferred_name,email,agent_code,smd_name,verification_status,' +
            'rank,founding_member,exclusive_member_number,is_founder,role,avatar_path'
          )
          .eq('id', user.id)
          .single();
      }
    }

    return result;
  }

  let { data: profile, error: profileError } = await withTimeout(fetchProfile());

  const founderLink = document.getElementById('founderControlLink');
  const founderEmails = ['dominionstarld@gmail.com', 'dominionstarwfg@gmail.com'];
  if (
    profile?.is_founder ||
    profile?.role === 'founder' ||
    founderEmails.includes(user.email?.toLowerCase())
  ) {
    founderLink?.classList.remove('member-hidden');
  }

  if (profileError || !profile) {
    statusEl.textContent = 'Profile unavailable';
    statusEl.className = 'member-status pending';
    return;
  }

  // Guarantee an assigned #1–#20 number for Founding Members.
  if (
    profile.founding_member === true &&
    !profile.exclusive_member_number
  ) {
    const assigned = await supabase.rpc('ensure_my_founding_member_number');
    if (!assigned.error && assigned.data) {
      profile.exclusive_member_number = assigned.data;
    }
  }

  const displayName =
    profile.preferred_name || profile.full_name || user.email || 'Member';
  const fullName = profile.full_name || displayName;

  document.getElementById('dashboardIdentityName').textContent = displayName;
  const topbarName = document.getElementById('topbarMemberName');
  const heroName = document.getElementById('heroMemberName');
  if (topbarName) topbarName.textContent = displayName;
  if (heroName) heroName.textContent = displayName.split(' ')[0] || displayName;
  document.getElementById('dashboardIdentityRank').textContent =
    `Contract Level: ${profile.rank || 'TA'}`;
  const topbarRank = document.getElementById('topbarContractLevel');
  if (topbarRank) topbarRank.textContent = profile.rank || 'TA';
  document.getElementById('dashboardIdentityCode').textContent =
    `Agent Code: ${profile.agent_code || '—'}`;

  const selectedSmdName =
    profile.smd_name ||
    profile.selected_smd_name ||
    profile.smd_full_name ||
    profile.sponsor_name ||
    profile.leader_name ||
    '';

  const smdElement = document.getElementById('dashboardIdentitySmd');
  if (smdElement) {
    if (selectedSmdName) {
      smdElement.textContent = `SMD: ${selectedSmdName}`;
      smdElement.classList.remove('member-hidden');
    } else {
      smdElement.textContent = 'SMD: —';
      smdElement.classList.add('member-hidden');
    }
  }

  if (smdElement) {
    if (profile.smd_name) {
      smdElement.textContent = `SMD: ${profile.smd_name}`;
      smdElement.classList.remove('member-hidden');
    } else {
      smdElement.classList.add('member-hidden');
    }
  }

  if (profile.avatar_path) {
    const avatarResult = await supabase.storage
      .from('member-avatars')
      .createSignedUrl(profile.avatar_path, 3600);
    if (avatarResult.data?.signedUrl) {
      document.getElementById('dashboardAvatar').src = avatarResult.data.signedUrl;
      const identityAvatar = document.getElementById('dashboardIdentityAvatar');
      if (identityAvatar) identityAvatar.src = avatarResult.data.signedUrl;
    }
  }

  const foundingNumber = Number(profile.exclusive_member_number);
  const hasValidFoundingNumber =
    profile.founding_member === true &&
    Number.isInteger(foundingNumber) &&
    foundingNumber >= 1 &&
    foundingNumber <= 20;

  const dashboardBadge = document.getElementById('dashboardBadge');
  const numberSeal = document.getElementById('dashboardFoundingNumber');
  const heroBadge = document.querySelector('.founding-member-badge');

  if (hasValidFoundingNumber) {
    const badgeText = `Founding Member #${foundingNumber}`;
    dashboardBadge.textContent = badgeText;
    dashboardBadge.classList.remove('member-hidden');
    numberSeal.textContent = `#${foundingNumber}`;
    numberSeal.title = `DominionStar Founding Member ${foundingNumber} of 20`;
    numberSeal.classList.remove('member-hidden');
    if (heroBadge) heroBadge.textContent = badgeText;
  } else {
    dashboardBadge?.classList.add('member-hidden');
    numberSeal?.classList.add('member-hidden');
    if (heroBadge) heroBadge.textContent = 'DominionStar Member';
  }

  const status = profile.verification_status || 'pending';
  nameEl.textContent = fullName;
  rankEl.textContent = profile.rank || 'TA';
  emailEl.textContent = profile.email || user.email || '';
  agentCodeEl.textContent = profile.agent_code || '—';
  statusEl.textContent = status;
  statusEl.className = `member-status ${status}`;

  await supabase.rpc('ensure_default_milestones', { target_user_id: user.id });
  const { data: milestones } = await supabase
    .from('member_milestones')
    .select('milestone_key,milestone_label,completed')
    .eq('user_id', user.id)
    .order('milestone_key');

  const completed = (milestones || []).filter(item => item.completed).length;
  const totalMilestones = (milestones || []).length || 6;
  const percent = Math.round((completed / totalMilestones) * 100);
  const bar = document.querySelector('.member-progress span');
  if (bar) bar.style.width = `${percent}%`;
  document.getElementById('journeyPercent').textContent = `${percent}%`;
  document.getElementById('journeyCount').textContent =
    `${completed} of ${totalMilestones} milestones completed`;
  const journeyProgressBar = document.getElementById('journeyProgressBar');
  if (journeyProgressBar) journeyProgressBar.style.width = `${percent}%`;

  const orderedMilestones = milestones || [];
  const nextMilestone = orderedMilestones.find(item => !item.completed);
  const currentIndex = nextMilestone
    ? orderedMilestones.findIndex(item => item.milestone_key === nextMilestone.milestone_key)
    : Math.max(orderedMilestones.length - 1, 0);
  const stepNumber = nextMilestone ? currentIndex + 1 : orderedMilestones.length;

  const journeyStepLabel = document.getElementById('journeyStepLabel');
  const journeyCurrentMission = document.getElementById('journeyCurrentMission');
  const journeyMissionStatus = document.getElementById('journeyMissionStatus');
  const journeyReward = document.getElementById('journeyReward');
  const journeyContinueButton = document.getElementById('journeyContinueButton');

  if (journeyStepLabel) {
    journeyStepLabel.textContent = orderedMilestones.length
      ? `Step ${Math.max(stepNumber, 1)} of ${orderedMilestones.length}`
      : 'Journey setup';
  }

  if (nextMilestone) {
    const missionLabel = nextMilestone.milestone_label || 'Complete your next milestone';
    if (journeyCurrentMission) journeyCurrentMission.textContent = missionLabel;
    if (journeyMissionStatus) {
      journeyMissionStatus.textContent =
        `${orderedMilestones.length - completed} milestone${orderedMilestones.length - completed === 1 ? '' : 's'} remaining`;
    }
    if (journeyReward) {
      journeyReward.textContent =
        missionLabel.toLowerCase().includes('profile')
          ? 'Verified professional identity'
          : missionLabel.toLowerCase().includes('academy')
            ? 'Academy progress recognition'
            : missionLabel.toLowerCase().includes('leadership')
              ? 'Leadership journey recognition'
              : 'Professional progress recognition';
    }
    if (journeyContinueButton) journeyContinueButton.textContent = 'Continue Journey';
  } else {
    if (journeyCurrentMission) journeyCurrentMission.textContent = 'Journey complete';
    if (journeyMissionStatus) journeyMissionStatus.textContent = 'All current milestones are complete.';
    if (journeyReward) journeyReward.textContent = 'Journey completion recognition';
    if (journeyContinueButton) journeyContinueButton.textContent = 'Review Journey';
  }

  const approvedContent = document.getElementById('approvedMemberContent');
  const pendingContent = document.getElementById('pendingMemberContent');
  if (status === 'approved') {
    approvedContent?.classList.remove('member-hidden');
    pendingContent?.classList.add('member-hidden');
  } else {
    approvedContent?.classList.add('member-hidden');
    pendingContent?.classList.remove('member-hidden');
  }

  const greetingHour = new Date().getHours();
  const greetingText = greetingHour < 12
    ? 'Good morning'
    : greetingHour < 18
      ? 'Good afternoon'
      : 'Good evening';
  const greetingElement = document.getElementById('memberGreeting');
  if (greetingElement) greetingElement.textContent = greetingText;
  const heroGreeting = document.getElementById('heroGreeting');
  if (heroGreeting) heroGreeting.textContent = greetingText;

  async function loadAnnouncements() {
    const result = await withTimeout(
      supabase
        .from('founder_announcements')
        .select('title,body,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5)
    );

    const target = document.getElementById('memberAnnouncements');
    if (!target) return;

    if (result.error) {
      target.innerHTML =
        '<div class="dashboard-empty-compact"><strong>Announcements unavailable.</strong>' +
        '<p>Please refresh in a moment.</p></div>';
      return;
    }

    target.innerHTML = result.data?.length
      ? result.data.map(item => `
          <article class="member-announcement">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`).join('')
      : '<p>No active announcements.</p>';
  }

  async function loadDashboardAppointments() {
    const target = document.getElementById('dashboardNextAppointment');
    if (!target) return;

    try {
      const result = await withTimeout(
        supabase
          .from('member_appointments')
          .select(
            'requested_date,requested_time_window,meeting_type,status,' +
            'confirmed_start,meeting_location'
          )
          .eq('member_id', user.id)
          .in('status', ['pending','confirmed','rescheduled'])
          .order('confirmed_start', { ascending: true, nullsFirst: false })
          .order('requested_date', { ascending: true })
          .limit(1)
      );

      if (result.error) throw result.error;

      if (!result.data?.length) {
        target.innerHTML = `
          <div class="dashboard-empty-compact">
            <strong>Your schedule is open.</strong>
            <p>Request a consultation, leadership meeting, or training session.</p>
            <a class="btn btn-outline" href="/appointments/">Request Appointment</a>
          </div>`;
        return;
      }

      const item = result.data[0];
      const dateText = item.confirmed_start
        ? new Date(item.confirmed_start).toLocaleString()
        : `${item.requested_date || 'Date pending'} · ${item.requested_time_window || 'Time pending'}`;

      target.innerHTML = `
        <article class="dashboard-appointment-preview">
          <span class="appointment-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          <h3>${escapeHtml(String(item.meeting_type || 'Leadership meeting').replace(/-/g,' '))}</h3>
          <p>${escapeHtml(dateText)}</p>
          <small>${escapeHtml(item.meeting_location || 'Location will be provided after confirmation.')}</small>
        </article>`;
    } catch (error) {
      target.innerHTML = `
        <div class="dashboard-empty-compact dashboard-load-error">
          <strong>Schedule could not load.</strong>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-outline" type="button" onclick="location.reload()">Retry</button>
        </div>`;
    }
  }

  async function loadDashboardCommunity() {
    const target = document.getElementById('dashboardCommunityPreview');
    if (!target) return;

    try {
      // The RPC provides author details without relying on PostgREST relationship cache.
      const result = await withTimeout(
        supabase.rpc('list_community_feed', { result_limit: 3 })
      );

      if (result.error) throw result.error;

      if (!result.data?.length) {
        target.innerHTML = `
          <div class="dashboard-empty-compact">
            <strong>The community is ready for your voice.</strong>
            <p>Start a professional discussion or share a milestone.</p>
            <a class="btn btn-outline" href="/community/">Open Community</a>
          </div>`;
        return;
      }

      target.innerHTML = result.data.map(item => {
        const authorName =
          item.author_preferred_name ||
          item.author_full_name ||
          'DominionStar Member';
        const body = String(item.description || '');
        const excerpt = body.length > 105 ? `${body.slice(0,105)}…` : body;
        const authorBadge =
          item.author_exclusive_number >= 1 &&
          item.author_exclusive_number <= 20
            ? ` · Founding #${item.author_exclusive_number}`
            : '';

        return `
          <a class="dashboard-community-preview-item" href="/community/">
            <div>
              <span>${escapeHtml(item.post_type || 'discussion')}</span>
              <strong>${escapeHtml(item.title || excerpt || 'Community update')}</strong>
              <small>${escapeHtml(authorName)}${escapeHtml(authorBadge)} · ${new Date(item.created_at).toLocaleDateString()}</small>
            </div>
          </a>`;
      }).join('');
    } catch (error) {
      target.innerHTML = `
        <div class="dashboard-empty-compact dashboard-load-error">
          <strong>Community Pulse could not load.</strong>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-outline" type="button" onclick="location.reload()">Retry</button>
        </div>`;
    }
  }

  const notificationBell = document.getElementById('notificationBell');
  const notificationPanel = document.getElementById('notificationPanel');
  const notificationCount = document.getElementById('notificationCount');
  const notificationList = document.getElementById('notificationList');

  async function loadExecutiveActivity() {
    try {
      const [announcements, messages, notificationsResult] = await Promise.all([
        withTimeout(
          supabase
            .from('founder_announcements')
            .select('id', { count:'exact', head:true })
            .eq('is_active', true)
        ),
        withTimeout(
          supabase
            .from('community_messages')
            .select('id', { count:'exact', head:true })
            .eq('is_deleted', false)
        ),
        withTimeout(
          supabase
            .from('executive_events')
            .select('*')
            .eq('member_id', user.id)
            .order('created_at', { ascending:false })
            .limit(20)
        )
      ]);

      const notifications = notificationsResult.data || [];
      const unread = notifications.filter(item => !item.read_at).length;
      window.CommunicationEngine?.setBadge(unread);

      document.getElementById('activityAnnouncements').textContent =
        announcements.count || 0;
      document.getElementById('activityMessages').textContent =
        messages.count || 0;
      document.getElementById('activityNotifications').textContent = unread;

      if (unread) {
        notificationCount.textContent = unread;
        notificationCount.classList.remove('member-hidden');
      } else {
        notificationCount.classList.add('member-hidden');
      }

      const panelStatus = document.getElementById('notificationPanelStatus');
      if (panelStatus) panelStatus.textContent = unread
        ? `${unread} unread notification${unread === 1 ? '' : 's'}`
        : 'You are all caught up';

      notificationList.innerHTML = notifications.length
        ? notifications.map(item => {
            const destination = item.payload?.action_url || '/notifications/';
            return `
              <a class="notification-item ${item.read_at ? 'read' : 'unread'}"
                 href="${escapeHtml(destination)}"
                 data-notification-id="${escapeHtml(item.id)}">
                <span class="notification-item-icon" aria-hidden="true">${item.event_type === 'call.missed' ? '☎' : item.event_type?.startsWith('message.') ? '✉' : item.event_type?.startsWith('meeting.') ? '▦' : '✦'}</span>
                <div>
                  <strong>${escapeHtml(item.title || 'DominionStar update')}</strong>
                  <p>${escapeHtml(item.description || '')}</p>
                  <small>${new Date(item.created_at).toLocaleString()}</small>
                </div>
                ${item.read_at ? '' : '<b class="notification-new-label">New</b>'}
              </a>`;
          }).join('')
        : '<div class="member-empty-state notification-empty"><span>✓</span><h2>You are all caught up.</h2><p>New messages and activity will appear here.</p></div>';
      const preview = document.getElementById('dsosNotificationPreview');
      if (preview) {
        preview.innerHTML = notifications.length
          ? notifications.slice(0, 3).map(item => `
              <a class="dsos-notice ${item.read_at ? '' : 'unread'}"
                 href="${escapeHtml(item.payload?.action_url || '/notifications/')}">
                <strong>${escapeHtml(item.title || 'Update')}</strong>
                <span>${escapeHtml(item.description || '')}</span>
              </a>`).join('')
          : '<p class="dsos-muted">No notifications yet.</p>';
      }
    } catch (error) {
      notificationList.innerHTML =
        `<div class="member-empty-state"><h2>Notifications unavailable.</h2>` +
        `<p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  const dashboardSession = (await supabase.auth.getSession()).data.session;
  if (dashboardSession) await window.CommunicationEngine?.init({client:supabase, session:dashboardSession});

  // Panel visibility is controlled exclusively by dominionstar-os.js.
  // Keeping a single controller prevents the backdrop from remaining visible
  // after another click handler accidentally hides the drawer.
  notificationList?.addEventListener('click', async event => {
    const item = event.target.closest('[data-notification-id]');
    if (!item) return;
    const notificationId = item.dataset.notificationId;
    if (notificationId) {
      await supabase
        .from('executive_events')
        .update({ read_at:new Date().toISOString() })
        .eq('id', notificationId)
        .eq('member_id', user.id);
    }
  });

  document.getElementById('markNotificationsRead')?.addEventListener(
    'click',
    async () => {
      const button = document.getElementById('markNotificationsRead');
      button.disabled = true;
      button.textContent = 'Marking…';
      await supabase
        .from('executive_events')
        .update({ read_at:new Date().toISOString() })
        .eq('member_id', user.id)
        .is('read_at', null);
      button.disabled = false;
      button.textContent = 'Mark all read';
      await loadExecutiveActivity();
    }
  );

  logout?.addEventListener('click', () => window.DSAuth.signOut());

  feedbackForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const feedbackType = feedbackForm.feedback_type.value;
    const message = feedbackForm.message.value.trim();
    const { error } = await supabase.from('member_feedback').insert({
      user_id: user.id,
      feedback_type: feedbackType,
      message
    });
    const result = document.getElementById('feedbackResult');
    result.textContent = error ? error.message : 'Feedback sent. Thank you.';
    result.className = `member-message show ${error ? 'error' : 'success'}`;
    if (!error) feedbackForm.reset();
  });

  // Every loading placeholder resolves to live data, a meaningful empty state,
  // or a visible retry state.
  await Promise.allSettled([
    loadAnnouncements(),
    loadDashboardAppointments(),
    loadDashboardCommunity(),
    loadExecutiveActivity()
  ]);

  const executiveTimeline = document.getElementById('executiveTimeline');
  const refreshExecutiveTimeline = document.getElementById('refreshExecutiveTimeline');

  const timelineIcon = eventType => ({
    'message.created':'💬',
    'journey.milestone.completed':'◆',
    'recognition.awarded':'🏆',
    'meeting.created':'📅',
    'academy.lesson.completed':'🎓'
  }[eventType] || '✦');

  const renderExecutiveTimeline = events => {
    if (!executiveTimeline) return;
    executiveTimeline.innerHTML = events.length
      ? events.map(event => `
          <article class="dsos-timeline-item">
            <span>${timelineIcon(event.event_type)}</span>
            <div>
              <strong>${escapeHtml(event.title || 'Platform activity')}</strong>
              <p>${escapeHtml(event.description || '')}</p>
              <small>${new Date(event.created_at).toLocaleString()}</small>
            </div>
          </article>`).join('')
      : '<div class="member-empty-state"><h2>No activity yet.</h2><p>Messages, journey progress, meetings, and recognition will appear here.</p></div>';
  };

  const loadExecutiveTimeline = async () => {
    if (!window.ExecutiveCore || !executiveTimeline) return;
    try {
      renderExecutiveTimeline(await window.ExecutiveCore.list({limit:12}));
    } catch (error) {
      executiveTimeline.innerHTML = `<div class="dashboard-load-error"><strong>Timeline unavailable.</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  };

  refreshExecutiveTimeline?.addEventListener('click', loadExecutiveTimeline);
  if (window.ExecutiveCore) {
    window.ExecutiveCore.on('*', loadExecutiveTimeline);
    await loadExecutiveTimeline();
  }


  const dashboardPresenceSelect=document.getElementById('dashboardPresenceSelect');
  const dashboardPresenceDot=document.getElementById('dashboardPresenceDot');
  const updateDashboardPresence=status=>{if(!dashboardPresenceDot||!dashboardPresenceSelect)return;dashboardPresenceDot.className=`dsos-presence-dot ${status}`;dashboardPresenceSelect.value=status;};
  if(window.DominionStarPresence){try{await window.DominionStarPresence.init();updateDashboardPresence('online');dashboardPresenceSelect?.addEventListener('change',async()=>updateDashboardPresence(await window.DominionStarPresence.setStatus(dashboardPresenceSelect.value)));}catch(error){console.warn('Presence engine unavailable:',error);}}

})();
