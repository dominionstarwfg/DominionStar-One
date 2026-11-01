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

  const linkifySafe = value => String(value ?? '').split(/(https?:\/\/[^\s<>"']+)/gi).map(part => {
    if (!/^https?:\/\//i.test(part)) return escapeHtml(part);
    const trailing=(part.match(/[).,!?;:]+$/)||[])[0]||'';
    const candidate=part.slice(0,part.length-trailing.length);
    try {
      const url=new URL(candidate);
      if (!['http:','https:'].includes(url.protocol)) return escapeHtml(part);
      return '<a class="dsos-inline-link" href="'+escapeHtml(url.href)+'" target="_blank" rel="noopener noreferrer nofollow">'+escapeHtml(candidate)+'</a>'+escapeHtml(trailing);
    } catch {
      return escapeHtml(part);
    }
  }).join('');

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

  if (profileError || !profile) {
    if (statusEl) {
      statusEl.textContent = 'Profile unavailable';
      statusEl.className = 'member-status pending';
    }
    return;
  }

  // Display identity from the authenticated member profile, never demo data.
  const displayName = String(
    profile.preferred_name || profile.full_name || 'Member'
  ).trim() || 'Member';
  const fullName = String(profile.full_name || displayName).trim() || 'Member';
  const firstName = displayName.split(/\s+/)[0] || 'Member';
  const contractLevel = String(profile.rank || '').trim() || '—';
  const contractLevelText = `Contract Level: ${contractLevel}`;
  const setIdentityText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  setIdentityText('dashboardIdentityName', fullName);
  setIdentityText('topbarMemberName', fullName);
  setIdentityText('heroMemberName', firstName);
  setIdentityText('heroProfileFullName', fullName);
  setIdentityText('dashboardIdentityRank', contractLevelText);
  setIdentityText('topbarContractLevel', contractLevelText);
  setIdentityText('heroContractLevel', contractLevelText);
  // Render visible identity immediately. Permission lookups must never hold up
  // the authenticated member greeting or contract level.
  const founderLink = document.getElementById('founderControlLink');
  Promise.resolve().then(() => withTimeout(supabase.rpc('is_dominionstar_founder'), 5000))
    .then(permission => {
      if (!permission.error && permission.data === true) founderLink?.classList.remove('member-hidden');
    })
    .catch(() => { /* Fail closed: Founder tools stay hidden. */ });

  const dashboardIdentityCode = document.getElementById('dashboardIdentityCode');
  if (dashboardIdentityCode) dashboardIdentityCode.textContent =
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

  // Use a real profile image only when Storage authorizes a signed URL.
  // Missing, revoked or broken photos show member initials, never a company logo.
  const initials = fullName.split(/\s+/).filter(Boolean)
    .slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'DS';
  for (const id of ['dashboardAvatarInitials','heroProfileInitials','dashboardIdentityInitials','feedComposerInitials']) {
    setIdentityText(id, initials);
  }
  const avatarPairs = [
    ['dashboardAvatar','dashboardAvatarInitials'],
    ['heroProfileAvatar','heroProfileInitials'],
    ['dashboardIdentityAvatar','dashboardIdentityInitials'],
    ['feedComposerAvatar','feedComposerInitials']
  ];
  const renderAvatar = signedUrl => {
    for (const [imageId,fallbackId] of avatarPairs) {
      const img = document.getElementById(imageId);
      const fallback = document.getElementById(fallbackId);
      if (!img || !fallback) continue;
      img.classList.add('member-hidden');
      fallback.classList.remove('member-hidden');
      img.removeAttribute('src');
      if (!signedUrl) continue;
      const onBrokenImage = () => {
        img.classList.add('member-hidden');
        fallback.classList.remove('member-hidden');
        img.removeAttribute('src');
      };
      img.onerror = onBrokenImage;
      img.onload = () => {
        img.classList.remove('member-hidden');
        fallback.classList.add('member-hidden');
      };
      img.src = signedUrl;
    }
  };
  renderAvatar(null);
  if (profile.avatar_path) {
    // A slow or missing avatar must not delay the feed or greeting.
    Promise.resolve()
      .then(() => withTimeout(supabase.storage.from('member-avatars').createSignedUrl(profile.avatar_path, 3600), 5000))
      .then(result => {
        if (!result.error && result.data?.signedUrl) {
          const separator=result.data.signedUrl.includes('?')?'&':'?';
          renderAvatar(`${result.data.signedUrl}${separator}v=${Date.now()}`);
        }
      })
      .catch(() => { /* Keep visible initials instead of a broken image. */ });
  }

  const dashboardBadge = document.getElementById('dashboardBadge');
  const numberSeal = document.getElementById('dashboardFoundingNumber');
  const heroBadge = document.getElementById('heroFoundingBadge');
  const topbarFoundingBadge = document.getElementById('topbarFoundingBadge');
  const updateFoundingIdentity = () => {
    const foundingNumber = Number(profile.exclusive_member_number);
    const isFoundingMember = profile.founding_member === true;
    const hasValidFoundingNumber = isFoundingMember &&
      Number.isInteger(foundingNumber) && foundingNumber >= 1 && foundingNumber <= 20;
    const foundingText = isFoundingMember
      ? (hasValidFoundingNumber ? `Founding Member #${String(foundingNumber).padStart(2,'0')}` : 'Founding Member')
      : '';
    for (const el of [dashboardBadge,heroBadge,topbarFoundingBadge]) {
      if (!el) continue;
      el.textContent = foundingText;
      el.classList.toggle('member-hidden', !isFoundingMember);
    }
    if (numberSeal) {
      if (hasValidFoundingNumber) {
        numberSeal.textContent = `#${String(foundingNumber).padStart(2,'0')}`;
        numberSeal.title = `DominionStar Founding Member ${foundingNumber} of 20`;
      }
      numberSeal.classList.toggle('member-hidden', !hasValidFoundingNumber);
    }
  };
  // Immediately show the verified flag. Assign a missing founding number in
  // the background; never withhold the member's greeting or avatar to do so.
  updateFoundingIdentity();
  if (profile.founding_member === true && !profile.exclusive_member_number) {
    Promise.resolve().then(() => withTimeout(supabase.rpc('ensure_my_founding_member_number'), 5000))
      .then(result => {
        const number=Number(result.data);
        if (!result.error && Number.isInteger(number) && number>=1 && number<=20) {
          profile.exclusive_member_number=number;
          updateFoundingIdentity();
        }
      })
      .catch(() => { /* Retain Founding Member label until a number is available. */ });
  }

  const status = profile.verification_status || 'pending';
  if (nameEl) nameEl.textContent = fullName;
  if (rankEl) rankEl.textContent = profile.rank || 'TA';
  if (emailEl) emailEl.textContent = profile.email || user.email || '';
  if (agentCodeEl) agentCodeEl.textContent = profile.agent_code || '—';
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = `member-status ${status}`;
  }

  await supabase.rpc('ensure_default_milestones', { target_user_id: user.id });
  const { data: milestones } = await supabase
    .from('member_milestones')
    .select('milestone_key,title,completed')
    .eq('user_id', user.id)
    .order('milestone_key');

  const completed = (milestones || []).filter(item => item.completed).length;
  const totalMilestones = (milestones || []).length || 6;
  const percent = Math.round((completed / totalMilestones) * 100);
  const bar = document.querySelector('.member-progress span');
  if (bar) bar.style.width = `${percent}%`;
  const journeyPercentElement = document.getElementById('journeyPercent');
  const journeyCountElement = document.getElementById('journeyCount');
  if (journeyPercentElement) journeyPercentElement.textContent = `${percent}%`;
  const journeyPercentMirror = document.getElementById('dashboardJourneyPercentMirror');
  if (journeyPercentMirror) journeyPercentMirror.textContent = `${percent}%`;
  if (journeyCountElement) journeyCountElement.textContent =
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
    const missionLabel = nextMilestone.title || 'Complete your next milestone';
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

  const pendingContent = document.getElementById('pendingMemberContent');
  const socialGateway = document.getElementById('dsosSocialGateway');
  const communitySection = document.getElementById('dsosCommunitySection');
  if (status === 'approved') {
    socialGateway?.classList.remove('member-hidden');
    communitySection?.classList.remove('member-hidden');
    pendingContent?.classList.add('member-hidden');
  } else {
    pendingContent?.classList.remove('member-hidden');
    socialGateway?.classList.add('member-hidden');
    communitySection?.classList.add('member-hidden');
  }

  // First-visit-safe greeting: use the member's current local clock, not a
  // stored visit count or a potentially stale login flag.
  const greetingHour = new Date().getHours();
  const greetingText = greetingHour < 12
    ? 'Good morning'
    : greetingHour < 17
      ? 'Good afternoon'
      : 'Good evening';
  const greetingElement = document.getElementById('memberGreeting');
  if (greetingElement) greetingElement.textContent = greetingText;
  const heroGreeting = document.getElementById('heroGreeting');
  if (heroGreeting) heroGreeting.textContent = greetingText;

  async function loadAnnouncements() {
    const target = document.getElementById('dashboardAnnouncementPreview');
    if (!target) return;
    const result = await withTimeout(
      supabase
        .from('founder_announcements')
        .select('title,body,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
    );

    if (result.error || !result.data?.length) {
      target.classList.add('member-hidden');
      target.replaceChildren();
      return;
    }

    const item=result.data[0];
    const when=item.created_at ? new Date(item.created_at).toLocaleDateString() : '';
    target.innerHTML = `
      <article class="dsos-pinned-update">
        <div class="dsos-pinned-update-head">
          <span class="dsos-pinned-label">Founder update</span>
          <small>${escapeHtml(when)}</small>
        </div>
        <h3>${escapeHtml(item.title || 'DominionStar update')}</h3>
        <p>${linkifySafe(item.body || '')}</p>
      </article>`;
    target.classList.remove('member-hidden');
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
      const rawLocation = String(item.meeting_location || '').trim();
      let joinHref = '';
      try {
        const parsed = new URL(rawLocation);
        if (parsed.protocol === 'https:') joinHref = parsed.href;
      } catch (_error) { /* Meeting location may be plain text. */ }

      target.innerHTML = `
        <article class="dashboard-appointment-preview">
          <span class="appointment-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          <h3>${escapeHtml(String(item.meeting_type || 'Leadership meeting').replace(/-/g,' '))}</h3>
          <p>${escapeHtml(dateText)}</p>
          <small>${joinHref ? 'Online meeting link available' : escapeHtml(rawLocation || 'Location will be provided after confirmation.')}</small>
          ${joinHref ? '<a class="dsx-join-link" href="'+escapeHtml(joinHref)+'" target="_blank" rel="noopener noreferrer">Join meeting</a>' : ''}
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
      if (!window.DSDashboardSocial?.mount) {
        throw new Error('Social feed module is unavailable.');
      }
      // Only approved members arrive here; server RLS is still authoritative.
      await withTimeout(window.DSDashboardSocial.mount({
        client: supabase,
        memberId: user.id,
        target
      }));
    } catch (error) {
      target.innerHTML = '<div class="dashboard-empty-compact dashboard-load-error">' +
        '<strong>Community feed could not load.</strong><p>' +
        escapeHtml(error.message) + '</p>' +
        '<a href="/community/">Open Community →</a></div>';
    }
  }

  const feedComposerForm = document.getElementById('dsosSocialGateway');
  const feedComposerBody = document.getElementById('feedComposerBody');
  const feedComposerPublish = document.getElementById('feedComposerPublish');
  const feedComposerStatus = document.getElementById('feedComposerStatus');

  const setFeedComposerStatus = (message, type='') => {
    if (!feedComposerStatus) return;
    feedComposerStatus.textContent = message;
    feedComposerStatus.dataset.state = type;
  };

  feedComposerForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (status !== 'approved' || !feedComposerBody || !feedComposerPublish) return;
    const body = feedComposerBody.value.trim();
    if (!body) {
      setFeedComposerStatus('Write something before posting.', 'error');
      feedComposerBody.focus();
      return;
    }

    feedComposerPublish.disabled = true;
    feedComposerPublish.textContent = 'Posting…';
    setFeedComposerStatus('Publishing to your network…', 'pending');

    try {
      const insert = await supabase
        .from('community_messages')
        .insert({
          user_id:user.id,
          title:null,
          body:body.slice(0,2000),
          post_type:'discussion',
          is_pinned:false
        })
        .select('id')
        .single();
      if (insert.error) throw insert.error;

      await supabase.rpc('community_notify_mentions', {
        target_message_id:insert.data.id,
        message_body:body.slice(0,2000)
      });

      feedComposerBody.value = '';
      feedComposerBody.rows = 1;
      await loadDashboardCommunity();
      setFeedComposerStatus('Posted to your network.', 'success');
    } catch (error) {
      setFeedComposerStatus(error?.message || 'Your post could not be published.', 'error');
    } finally {
      feedComposerPublish.disabled = false;
      feedComposerPublish.textContent = 'Post';
    }
  });

  feedComposerBody?.addEventListener('focus', () => {
    feedComposerBody.rows = Math.max(feedComposerBody.rows, 3);
    feedComposerForm?.classList.add('is-expanded');
  });
  feedComposerBody?.addEventListener('input', () => {
    if (feedComposerBody.value.trim()) feedComposerForm?.classList.add('is-expanded');
  });

  // Never trust a notification payload URL as an href without same-origin checks.
  const safeNotificationHref = candidate => {
    if (typeof candidate !== 'string' ||
        !candidate.startsWith('/') || candidate.startsWith('//') ||
        candidate.includes('\\')) return '/notifications/';
    try {
      const parsed = new URL(candidate, window.location.origin);
      return parsed.origin === window.location.origin
        ? parsed.pathname + parsed.search + parsed.hash
        : '/notifications/';
    } catch (_error) {
      return '/notifications/';
    }
  };

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
        status === 'approved'
          ? withTimeout(
              supabase
                .from('community_messages')
                .select('id', { count:'exact', head:true })
                .eq('is_deleted', false)
            )
          : Promise.resolve({ data: null, error: null, count: null }),
        withTimeout(
          supabase
            .from('executive_events')
            .select('*')
            .eq('member_id', user.id)
            .order('created_at', { ascending:false })
            .limit(20)
        )
      ]);

      const announcementsMetric=document.getElementById('activityAnnouncements');
      const messagesMetric=document.getElementById('activityMessages');
      if (announcementsMetric) announcementsMetric.textContent =
        announcements.error ? '—' : (announcements.count ?? 0);
      if (messagesMetric) messagesMetric.textContent =
        status !== 'approved' || messages.error ? '—' : (messages.count ?? 0);

      if (notificationsResult.error) {
        const notificationMetric=document.getElementById('activityNotifications');
        if (notificationMetric) notificationMetric.textContent = '—';
        notificationCount?.classList.add('member-hidden');
        const panelStatus = document.getElementById('notificationPanelStatus');
        if (panelStatus) panelStatus.textContent = 'Notifications unavailable';
        notificationList.textContent = 'Notifications could not be loaded. Try again later.';
        const preview = document.getElementById('dsosNotificationPreview');
        if (preview) preview.textContent = 'Notifications unavailable.';
        return;
      }

      const notifications = notificationsResult.data || [];
      const unread = notifications.filter(item => !item.read_at).length;
      const unreadMessages = notifications.filter(item =>
        !item.read_at && typeof item.event_type === 'string' &&
        item.event_type.startsWith('message.')
      ).length;
      const messageBadge = document.getElementById('sidebarUnreadMessages');
      const messageLink = document.querySelector('.ds30-messages-nav');
      if (messageBadge) {
        messageBadge.textContent = unreadMessages > 99 ? '99+' : String(unreadMessages);
        messageBadge.classList.toggle('member-hidden', unreadMessages === 0);
      }
      messageLink?.classList.toggle('ds30-has-unread', unreadMessages > 0);
      window.CommunicationEngine?.setBadge(unread);
      const notificationMetric=document.getElementById('activityNotifications');
      if (notificationMetric) notificationMetric.textContent = unread;

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
            const destination = safeNotificationHref(item.payload?.action_url);
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
                 href="${escapeHtml(safeNotificationHref(item.payload?.action_url))}">
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

  // Member communications are restricted to Founder-approved agents.
  // Do not start the communications engine for pending/revoked profiles.
  if (status === 'approved' && String(profile.agent_code || '').trim()) {
    const dashboardSession = (await supabase.auth.getSession()).data.session;
    if (dashboardSession) await window.CommunicationEngine?.init({client:supabase, session:dashboardSession});
  }

  // Re-read the member's notification drawer after a live event arrives so
  // the bell, unread count, preview, and drawer all agree without a refresh.
  let notificationRefreshTimer;
  window.addEventListener('dominionstar:notification', () => {
    clearTimeout(notificationRefreshTimer);
    notificationRefreshTimer=setTimeout(() => {
      loadExecutiveActivity().catch(()=>{});
    }, 120);
  });
  window.addEventListener('beforeunload',()=>clearTimeout(notificationRefreshTimer),{once:true});

  // Panel visibility is controlled exclusively by dominionstar-os.js.
  // Keeping a single controller prevents the backdrop from remaining visible
  // after another click handler accidentally hides the drawer.
  notificationList?.addEventListener('click', async event => {
    const item = event.target.closest('[data-notification-id]');
    if (!item) return;
    const notificationId = item.dataset.notificationId;
    if (notificationId) {
      await supabase.rpc('mark_my_executive_notifications_read',{
        target_event_id:notificationId
      });
    }
  });

  document.getElementById('markNotificationsRead')?.addEventListener(
    'click',
    async () => {
      const button = document.getElementById('markNotificationsRead');
      button.disabled = true;
      button.textContent = 'Marking…';
      await supabase.rpc('mark_my_executive_notifications_read',{
        target_event_id:null
      });
      button.disabled = false;
      button.textContent = 'Mark all read';
      await loadExecutiveActivity();
    }
  );

  logout?.addEventListener('click', async () => {
    await window.CommunicationEngine?.disablePushSubscription?.().catch(()=>{});
    await window.DSAuth.signOut();
  });

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
    status === 'approved' ? loadDashboardCommunity() : Promise.resolve(),
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
