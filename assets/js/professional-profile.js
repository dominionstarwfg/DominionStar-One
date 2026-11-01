
(async () => {
  const gate = document.getElementById('profileGate');
  const app = document.getElementById('profileApp');
  const form = document.getElementById('contactProfileForm');
  const result = document.getElementById('profileSaveResult');
  const avatarPreview = document.getElementById('profileAvatarPreview');
  const avatarInitials = document.getElementById('profileAvatarInitials');
  const photoInput = document.getElementById('profilePhotoInput');

  let supabase;
  let session;
  let profile;
  let currentAvatarPath = '';
  let localPreviewUrl = '';

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value || '—';
  };

  const setValue = (name, value) => {
    const field = form.elements[name];
    if (field) field.value = value || '';
  };

  function show(text, type='info') {
    result.textContent = text;
    result.className = `member-message show ${type}`;
  }

  const profileInitials = value => String(value || 'DS')
    .trim().split(/\s+/).filter(Boolean).slice(0,2)
    .map(part => part.charAt(0)).join('').toUpperCase() || 'DS';

  const showAvatarFallback = () => {
    avatarPreview.classList.add('member-hidden');
    avatarPreview.removeAttribute('src');
    avatarInitials?.classList.remove('member-hidden');
  };

  const showAvatarImage = src => {
    if (!src) {
      showAvatarFallback();
      return;
    }
    avatarPreview.classList.add('member-hidden');
    avatarInitials?.classList.remove('member-hidden');
    avatarPreview.onerror = () => showAvatarFallback();
    avatarPreview.onload = () => {
      avatarPreview.classList.remove('member-hidden');
      avatarInitials?.classList.add('member-hidden');
    };
    avatarPreview.src = src;
  };

  async function loadAvatar(path) {
    currentAvatarPath = path || '';
    if (!path) {
      showAvatarFallback();
      return;
    }

    const { data, error } = await supabase.storage
      .from('member-avatars')
      .createSignedUrl(path, 3600);

    if (!error && data?.signedUrl) {
      const separator = data.signedUrl.includes('?') ? '&' : '?';
      showAvatarImage(`${data.signedUrl}${separator}v=${Date.now()}`);
      return;
    }
    showAvatarFallback();
  }

  function renderProfile() {
    const displayName = profile.full_name || session.user.user_metadata?.full_name || session.user.email;
    const email = session.user.email || profile.email || '';

    setText('profileDisplayName', displayName);
    if (avatarInitials) avatarInitials.textContent = profileInitials(displayName);
    setText('profileDisplayRank', profile.rank || 'TA');
    setText('verifiedFullName', displayName);
    setText('verifiedEmail', email);
    setText('verifiedAgentCode', profile.agent_code || 'Pending verification');
    setText('verifiedRank', profile.rank || 'TA');
    setText('verifiedSmd', profile.smd_name || 'Not assigned');
    setText('verifiedStatus', profile.verification_status || 'pending');

    setValue('full_name', displayName);
    setValue('email', email);
    setValue('phone', profile.phone);
    setValue('address_line1', profile.address_line1);
    setValue('address_line2', profile.address_line2);
    setValue('city', profile.city);
    setValue('state', profile.state);
    setValue('postal_code', profile.postal_code);
    setValue('country', profile.country);

    document.getElementById('profileBadgeRow').innerHTML = `
      <span class="founding-member-badge">${profile.verification_status || 'pending'}</span>
      <span class="founding-member-badge">${profile.rank || 'TA'}</span>
      ${profile.founding_member === true &&
          Number.isInteger(Number(profile.exclusive_member_number)) &&
          Number(profile.exclusive_member_number) >= 1 &&
          Number(profile.exclusive_member_number) <= 20
        ? `<span class="exclusive-20-badge">Founding Member #${Number(profile.exclusive_member_number)}</span>`
        : ''}
      ${profile.role === 'founder' || profile.is_founder
        ? '<span class="exclusive-20-badge">Founder</span>'
        : ''}
    `;
  }

  if (!window.DSAuth?.ready) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication configuration is missing.</h1>';
    return;
  }

  supabase = await window.DSAuth.init();
  if (!supabase) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication could not load.</h1><p>Refresh the page after checking the internet connection.</p>';
    return;
  }

  const auth = await supabase.auth.getSession();
  session = auth.data.session;
  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  await supabase.rpc('ensure_member_profile');

  const response = await supabase
    .from('member_profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (response.error || !response.data) {
    gate.innerHTML = `<p class="eyebrow">Profile Error</p><h1>${response.error?.message || 'Profile not found.'}</h1>`;
    return;
  }

  profile = response.data;
  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');
  renderProfile();
  await loadAvatar(profile.avatar_path);

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    localPreviewUrl = URL.createObjectURL(file);
    showAvatarImage(localPreviewUrl);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    show('Saving profile changes…', 'info');

    const file = photoInput.files[0];
    let avatarPath = currentAvatarPath;
    const previousPath = currentAvatarPath;

    if (file) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
        show('Use a JPG, PNG, or WebP image.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        show('The profile picture must be under 5 MB.', 'error');
        return;
      }

      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      avatarPath = `${session.user.id}/profile-${Date.now()}.${extension}`;

      const upload = await supabase.storage
        .from('member-avatars')
        .upload(avatarPath, file, { contentType:file.type, cacheControl:'3600' });

      if (upload.error) {
        show(`Photo upload failed: ${upload.error.message}`, 'error');
        return;
      }
    }

    const requestedEmail = form.email.value.trim().toLowerCase();
    const currentEmail = session.user.email?.toLowerCase() || '';

    // Save the profile record first. Email authentication is a separate
    // confirmation workflow and must not be allowed to partially precede a
    // failed contact/profile update.
    const update = await supabase.rpc('update_own_contact_profile', {
      new_full_name: form.full_name.value,
      new_phone: form.phone.value,
      new_address_line1: form.address_line1.value,
      new_address_line2: form.address_line2.value,
      new_city: form.city.value,
      new_state: form.state.value,
      new_postal_code: form.postal_code.value,
      new_country: form.country.value,
      new_avatar_path: avatarPath || ''
    });

    if (update.error) {
      if (file && avatarPath !== previousPath) {
        await supabase.storage.from('member-avatars').remove([avatarPath]);
      }
      show(`Profile save failed: ${update.error.message}`, 'error');
      return;
    }

    profile = Array.isArray(update.data) ? update.data[0] : update.data;
    currentAvatarPath = profile.avatar_path || avatarPath || currentAvatarPath;

    if (file && previousPath && previousPath !== currentAvatarPath) {
      await supabase.storage.from('member-avatars').remove([previousPath]);
    }

    photoInput.value = '';
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      localPreviewUrl = '';
    }
    await loadAvatar(currentAvatarPath);
    renderProfile();

    if (requestedEmail && requestedEmail !== currentEmail) {
      show('Profile saved. Requesting the email change…', 'info');
      const emailUpdate = await supabase.auth.updateUser({ email: requestedEmail });
      if (emailUpdate.error) {
        show(
          `Profile saved, but the email change could not be started: ${emailUpdate.error.message}`,
          'warning'
        );
        return;
      }
      show('Profile saved. Check your email to confirm the address change.', 'success');
      return;
    }

    show('Profile changes saved.', 'success');
  });

})();
