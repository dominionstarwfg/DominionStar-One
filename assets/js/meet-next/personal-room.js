(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'ds_meet_personal_room_v2';
  const LEGACY_KEY = 'ds_meet_personal_room_v1';
  let client = null;
  let session = null;
  let settings = null;

  const randomDigits = length => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
  const digitsOnly = value => String(value || '').replace(/\D/g, '');
  const formatMeetingId = value => {
    const digits = digitsOnly(value);
    return digits.length === 10 ? digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : digits;
  };
  const slugify = value => String(value || 'dominionstar-member')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-').slice(0, 48) || `member-${randomDigits(5)}`;
  const readLocal = () => {
    for (const key of [STORAGE_KEY, LEGACY_KEY]) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value) return value;
      } catch (_) {}
    }
    return null;
  };
  const saveLocal = value => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(value));
  };
  const setStatus = (message, type = 'info') => {
    const node = $('personalRoomStatus');
    if (!node) return;
    node.textContent = message || '';
    node.dataset.type = type;
    node.hidden = !message;
  };
  const showToast = message => {
    setStatus(message, /could not|must|already|failed|error/i.test(message) ? 'error' : 'success');
    const layer = $('toastLayer');
    if (!layer) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    layer.append(node);
    setTimeout(() => node.remove(), 3000);
  };
  const buildLink = value => {
    const origin = location.origin;
    const params = new URLSearchParams({
      action: 'join',
      room: value.personalRoomId,
      personal: value.personalLinkName
    });
    return `${origin}/meet/?${params.toString()}`;
  };
  const invitationText = value => [
    'Join my DominionStar Personal Meeting Room',
    buildLink(value),
    `Meeting ID: ${formatMeetingId(value.personalRoomId)}`,
    ...(value.passcode ? [`Passcode: ${value.passcode}`] : [])
  ].join('\n');

  async function copyText(text) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(area);
    area.focus();
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    area.remove();
    return ok;
  }

  function formValue() {
    const rawSlug = $('personalLinkName')?.value || settings?.personalLinkName || '';
    return {
      personalRoomId: digitsOnly(settings?.personalRoomId || '') || randomDigits(10),
      personalLinkName: slugify(rawSlug),
      passcode: $('personalRequirePasscode')?.checked===false?'':digitsOnly($('personalRoomPasscode')?.value).slice(0, 6),
      waitingRoomEnabled: Boolean($('personalWaitingRoom')?.checked)
    };
  }

  function validate(value) {
    if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value.personalLinkName)) {
      throw new Error('Personal link name must use 3–48 letters, numbers, or hyphens.');
    }
    if (value.passcode && !/^\d{3,6}$/.test(value.passcode)) {
      throw new Error('Passcode must contain 3–6 digits.');
    }
  }

  function render() {
    if (!settings) return;
    if ($('personalRoomId')) $('personalRoomId').value = formatMeetingId(settings.personalRoomId);
    if ($('personalLinkName')) $('personalLinkName').value = settings.personalLinkName;
    if ($('personalRoomPasscode')) $('personalRoomPasscode').value = settings.passcode;
    if ($('personalRequirePasscode')) $('personalRequirePasscode').checked = Boolean(settings.passcode);
    if ($('personalPasscodeField')) $('personalPasscodeField').hidden = !settings.passcode;
    if ($('personalWaitingRoom')) $('personalWaitingRoom').checked = settings.waitingRoomEnabled;
    updatePreview();
  }

  function updatePreview() {
    if (!$('personalRoomLink') || !settings) return;
    $('personalRoomLink').value = buildLink(formValue());
  }

  async function load() {
    let fallbackName = 'dominionstar-member';
    try {
      client = await window.DSAuth?.init?.();
      session = client ? (await client.auth.getSession()).data.session : null;
      fallbackName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || fallbackName;
      if (client && session?.user) {
        try {
          const profile = await client.from('member_profiles').select('full_name,preferred_name').eq('id', session.user.id).maybeSingle();
          fallbackName = profile.data?.preferred_name || profile.data?.full_name || fallbackName;
        } catch (_) {}
        try {
          const result = await client.from('meet_personal_rooms').select('*').eq('user_id', session.user.id).maybeSingle();
          if (!result.error && result.data) {
            settings = {
              personalRoomId: String(result.data.personal_room_id),
              personalLinkName: String(result.data.personal_link_name),
              passcode: String(result.data.passcode),
              waitingRoomEnabled: Boolean(result.data.waiting_room_enabled)
            };
          }
        } catch (_) {}
      }
    } catch (_) {}

    if (!settings) {
      const local = readLocal();
      settings = local || {
        personalRoomId: randomDigits(10),
        personalLinkName: slugify(fallbackName),
        passcode: randomDigits(6),
        waitingRoomEnabled: false
      };
    }
    // Repair legacy values without blocking the dialog.
    settings.personalLinkName = slugify(settings.personalLinkName || fallbackName);
    // Empty is an intentional "no passcode" choice. Generate only for older
    // records that never stored a passcode preference at all.
    if (settings.passcode===undefined||settings.passcode===null) settings.passcode = randomDigits(6);
    else settings.passcode=digitsOnly(settings.passcode).slice(0,6);
    saveLocal(settings);
    render();
  }

  async function persist(value) {
    validate(value);
    // Save locally first, so the buttons remain functional even when Supabase is unavailable/misconfigured.
    settings = value;
    saveLocal(settings);
    render();

    if (client && session?.user) {
      const payload = {
        user_id: session.user.id,
        personal_room_id: value.personalRoomId,
        personal_link_name: value.personalLinkName,
        passcode: value.passcode,
        waiting_room_enabled: value.waitingRoomEnabled,
        updated_at: new Date().toISOString()
      };
      const result = await client.from('meet_personal_rooms').upsert(payload, { onConflict: 'user_id' });
      if (result.error) {
        const message = String(result.error.message || '');
        if (message.toLowerCase().includes('duplicate')) throw new Error('That personal link name is already in use. Choose another one.');
        // Keep local save and tell the user account sync is pending instead of making the UI appear broken.
        console.warn('Personal Room remote sync unavailable; local settings retained.', result.error);
        return { localOnly: true };
      }
    }
    return { localOnly: false };
  }

  async function saveRoom() {
    setStatus('Saving…');
    await persist(formValue());
    showToast('Personal Meeting Room saved');
  }

  async function startRoom() {
    setStatus('Starting your Personal Room…');
    const value = formValue();
    await persist(value);
    window.__DS_START_AS_HOST = true;
    window.__DS_WAITING_ROOM = value.waitingRoomEnabled;
    window.__DS_MEETING_PASSCODE = value.passcode;
    const roomInput = $('roomId');
    if (!roomInput) throw new Error('Meeting room field is unavailable. Refresh and try again.');
    roomInput.value = formatMeetingId(value.personalRoomId);
    const params = new URLSearchParams({
      room: value.personalRoomId,
      personal: value.personalLinkName,
      host: '1',
      ...(value.passcode ? {passcode: value.passcode} : {})
    });
    if (value.waitingRoomEnabled) params.set('waiting', '1');
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    $('personalRoomDialog')?.close();
    if (typeof window.DominionStarEnterHostPrejoin === 'function') {
      window.DominionStarEnterHostPrejoin({
        room: value.personalRoomId,
        passcode: value.passcode,
        waitingRoom: value.waitingRoomEnabled,
        autoShare: false
      });
      return;
    }
    const form = $('joinForm');
    if (!form) throw new Error('Meeting join form is unavailable. Refresh and try again.');
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  async function copyInvitation() {
    const value = formValue();
    validate(value);
    // Persist local edits before copying, without requiring the database.
    settings = value;
    saveLocal(settings);
    updatePreview();
    const ok = await copyText(invitationText(value));
    if (!ok) throw new Error('Copy was blocked by the browser. Select the Personal meeting link and copy it manually.');
    showToast('Personal invitation copied');
  }

  function wire() {
    $('personalRequirePasscode')?.addEventListener('change',event=>{if($('personalPasscodeField'))$('personalPasscodeField').hidden=!event.target.checked;if(event.target.checked&&!$('personalRoomPasscode').value)$('personalRoomPasscode').value=randomDigits(6);updatePreview();});
    $('personalMeetingAction')?.addEventListener('click', () => {
      render();
      setStatus('');
      const dialog = $('personalRoomDialog');
      if (dialog?.showModal && !dialog.open) dialog.showModal();
    });
    $('personalRoomClose')?.addEventListener('click', () => $('personalRoomDialog')?.close());
    $('personalRoomForm')?.addEventListener('submit', event => {
      event.preventDefault();
      saveRoom().catch(error => showToast(error.message || 'Could not save Personal Meeting Room'));
    });
    $('startPersonalRoom')?.addEventListener('click', event => {
      event.preventDefault();
      startRoom().catch(error => showToast(error.message || 'Could not start Personal Meeting Room'));
    });
    $('copyPersonalInvite')?.addEventListener('click', event => {
      event.preventDefault();
      copyInvitation().catch(error => showToast(error.message || 'Could not copy invitation'));
    });
    $('personalLinkName')?.addEventListener('input', event => {
      // Show the normalized slug immediately so the saved URL is predictable.
      const cursorAtEnd = event.target.selectionStart === event.target.value.length;
      event.target.value = slugify(event.target.value);
      if (cursorAtEnd) event.target.setSelectionRange(event.target.value.length, event.target.value.length);
      updatePreview();
    });
    $('personalRoomPasscode')?.addEventListener('input', event => {
      event.target.value = digitsOnly(event.target.value).slice(0, 6);
      updatePreview();
    });
    $('personalWaitingRoom')?.addEventListener('change', updatePreview);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { wire(); load(); }, { once: true });
  } else {
    wire();
    load();
  }
})();
