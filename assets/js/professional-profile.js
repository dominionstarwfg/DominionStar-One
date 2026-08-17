
(async () => {
  const gate = document.getElementById('profileGate');
  const app = document.getElementById('profileApp');
  const form = document.getElementById('contactProfileForm');
  const result = document.getElementById('profileSaveResult');
  const avatarPreview = document.getElementById('profileAvatarPreview');
  const photoInput = document.getElementById('profilePhotoInput');

  let supabase;
  let session;
  let profile;
  let currentAvatarPath = '';

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

  async function loadAvatar(path) {
    currentAvatarPath = path || '';
    if (!path) {
      avatarPreview.src = '/assets/logo.jpeg';
      return;
    }

    const { data, error } = await supabase.storage
      .from('member-avatars')
      .createSignedUrl(path, 3600);

    if (!error && data?.signedUrl) {
      avatarPreview.src = `${data.signedUrl}&v=${Date.now()}`;
    }
  }

  function renderProfile() {
    const displayName = profile.full_name || session.user.user_metadata?.full_name || session.user.email;
    const email = profile.email || session.user.email || '';

    setText('profileDisplayName', displayName);
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
    if (file) avatarPreview.src = URL.createObjectURL(file);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    show('Saving changes…', 'info');

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
    const currentEmail = session.user.email?.toLowerCase();

    if (requestedEmail && requestedEmail !== currentEmail) {
      const emailUpdate = await supabase.auth.updateUser({ email: requestedEmail });
      if (emailUpdate.error) {
        if (file && avatarPath !== previousPath) {
          await supabase.storage.from('member-avatars').remove([avatarPath]);
        }
        show(`Email change failed: ${emailUpdate.error.message}`, 'error');
        return;
      }
    }

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
    await loadAvatar(currentAvatarPath);
    renderProfile();

    show(
      requestedEmail !== currentEmail
        ? 'Profile saved. Check your email to confirm the address change.'
        : 'Profile changes saved.',
      'success'
    );
  });
})();
