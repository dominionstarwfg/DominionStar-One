(async () => {
  const gate = document.getElementById('digitalCardGate');
  const app = document.getElementById('digitalCardApp');
  const status = document.getElementById('cardShareStatus');

  const showStatus = (message, type = 'success') => {
    status.textContent = message;
    status.className = `form-status show ${type}`;
    window.setTimeout(() => {
      status.className = 'form-status';
    }, 4500);
  };

  if (!window.DSAuth?.ready) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication configuration is missing.</h1>';
    return;
  }

  const supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    location.href = '/member-login/';
    return;
  }

  const flagResult = await supabase
    .from('feature_flags')
    .select('is_enabled')
    .eq('feature_key', 'digital_card')
    .maybeSingle();

  if (flagResult.data && flagResult.data.is_enabled === false) {
    gate.innerHTML = '<p class="eyebrow">Temporarily Unavailable</p><h1>Digital Business Cards are currently disabled by the Founder.</h1>';
    return;
  }

  const { data: profile, error } = await supabase
    .from('member_profiles')
    .select('full_name,preferred_name,email,phone,city,state,country,agent_code,smd_name,rank,verification_status,exclusive_member_number,founding_member,avatar_path')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    gate.innerHTML = `<p class="eyebrow">Profile Error</p><h1>${error?.message || 'Profile not found.'}</h1>`;
    return;
  }

  if (profile.verification_status !== 'approved') {
    gate.innerHTML = '<p class="eyebrow">Founder Approval Required</p><h1>Your digital card will be available after your account is approved.</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  const name = profile.preferred_name || profile.full_name || 'DominionStar Member';
  const email = profile.email || session.user.email || '';
  const phone = profile.phone || '';
  const locationText =
    [profile.city, profile.state, profile.country].filter(Boolean).join(', ') || 'Not listed';

  document.getElementById('cardName').textContent = name;
  document.getElementById('cardRank').textContent = `Contract Level: ${profile.rank || 'TA'}`;
  document.getElementById('cardAgentCode').textContent = profile.agent_code || '—';
  document.getElementById('cardSmd').textContent = profile.smd_name || 'Not assigned';
  document.getElementById('cardEmail').textContent = email || 'Private';
  document.getElementById('cardPhone').textContent = phone || 'Private';
  document.getElementById('cardLocation').textContent = locationText;
  document.getElementById('cardStatus').textContent = 'DominionStar Verified';

  const badge = document.getElementById('cardBadge');
  badge.textContent = profile.exclusive_member_number
    ? `Founding Member #${profile.exclusive_member_number}`
    : profile.founding_member
      ? 'Founding Member'
      : 'Approved Member';

  if (profile.avatar_path) {
    const { data } = await supabase.storage
      .from('member-avatars')
      .createSignedUrl(profile.avatar_path, 3600);

    if (data?.signedUrl) {
      document.getElementById('cardAvatar').src = data.signedUrl;
    }
  }

  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    'ORG:DominionStar',
    `TITLE:${profile.rank || 'DominionStar Professional'}`,
    `EMAIL:${email}`,
    `TEL:${phone}`,
    `ADR:;;${profile.city || ''};${profile.state || ''};;${profile.country || ''}`,
    `NOTE:Agent Code ${profile.agent_code || ''}; ${badge.textContent}; DominionStar Verified`,
    'END:VCARD'
  ].join('\r\n');

  const shareText = [
    name,
    `${profile.rank || 'TA'} DominionStar Professional`,
    profile.agent_code ? `Agent Code: ${profile.agent_code}` : '',
    email,
    phone,
    locationText,
    badge.textContent
  ].filter(Boolean).join('\n');

  const qrUrl =
    'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=' +
    encodeURIComponent(vcard);

  document.getElementById('cardQrCode').src = qrUrl;

  document.getElementById('printCard').addEventListener('click', () => window.print());

  document.getElementById('downloadVcard').addEventListener('click', () => {
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-dominionstar.vcf`;
    link.click();
    URL.revokeObjectURL(link.href);
    showStatus('Contact card downloaded.');
  });

  document.getElementById('copyCard').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      showStatus('Professional contact details copied.');
    } catch {
      showStatus('Copy failed. Use Download Contact instead.', 'error');
    }
  });

  document.getElementById('shareCard').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name} — DominionStar`,
          text: shareText
        });
        showStatus('Card shared successfully.');
      } catch (error) {
        if (error.name !== 'AbortError') {
          showStatus('Sharing was not completed.', 'error');
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      showStatus('Sharing is unavailable in this browser, so the card details were copied.');
    } catch {
      showStatus('Sharing is unavailable. Download the contact card instead.', 'error');
    }
  });

  document.querySelectorAll('.theme-chip').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.theme-chip').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      document.getElementById('digitalBusinessCard').dataset.theme = button.dataset.theme;
      localStorage.setItem('dominionstar-card-theme', button.dataset.theme);
    });
  });

  const savedTheme = localStorage.getItem('dominionstar-card-theme') || 'executive';
  const savedButton = document.querySelector(`[data-theme="${savedTheme}"]`);
  if (savedButton) savedButton.click();
})();
