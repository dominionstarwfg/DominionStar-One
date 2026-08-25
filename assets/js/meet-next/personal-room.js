(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'ds_meet_personal_room_v2';
  const LEGACY_KEY = 'ds_meet_personal_room_v1';
  let client = null;
  let session = null;
  let settings = null;
  let loadPromise = null;
  let resolveReady = null;
  const ready = new Promise(resolve => { resolveReady = resolve; });

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
        if (value?.personalRoomId) return value;
      } catch (_) {}
    }
    return null;
  };
  const saveLocal = value => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      localStorage.setItem(LEGACY_KEY, JSON.stringify(value));
    } catch (_) {}
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
    'Join my DominionStar Personal Room',
    buildLink(value),
    `Meeting ID: ${formatMeetingId(value.personalRoomId)}`,
    ...(value.passcode ? [`Passcode: ${value.passcode}`] : [])
  ].join('\n');

  const normalizeRoom = (value, fallbackName = 'dominionstar-member') => ({
    personalRoomId: digitsOnly(value?.personalRoomId || value?.personal_room_id || '').slice(0, 10),
    personalLinkName: slugify(value?.personalLinkName || value?.personal_link_name || fallbackName),
    passcode: value?.passcode === undefined || value?.passcode === null ? randomDigits(6) : digitsOnly(value.passcode).slice(0, 6),
    waitingRoomEnabled: Boolean(value?.waitingRoomEnabled ?? value?.waiting_room_enabled)
  });

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
      personalRoomId: digitsOnly(settings?.personalRoomId || ''),
      personalLinkName: slugify(rawSlug),
      passcode: $('personalRequirePasscode')?.checked===false?'':digitsOnly($('personalRoomPasscode')?.value).slice(0, 6),
      waitingRoomEnabled: Boolean($('personalWaitingRoom')?.checked)
    };
  }

  function validate(value) {
    if (!/^\d{10}$/.test(value.personalRoomId)) {
      throw new Error('Your Personal Meeting ID is not available yet. Reopen Meeting Settings after account sync completes.');
    }
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
    if (!$('personalRoomLink') || !settings?.personalRoomId) return;
    const value = formValue();
    if (value.personalRoomId) $('personalRoomLink').value = buildLink(value);
  }

  async function readRemoteRoom() {
    if (!client || !session?.user) return { ok:false, data:null, reason:'signed-out' };
    try {
      const result = await client.from('meet_personal_rooms').select('*').eq('user_id', session.user.id).maybeSingle();
      if (result.error) return { ok:false, data:null, reason:String(result.error.message || 'query-failed') };
      return { ok:true, data:result.data || null, reason:'' };
    } catch (error) {
      return { ok:false, data:null, reason:String(error?.message || error) };
    }
  }

  async function upsertRemote(value) {
    if (!client || !session?.user) return { ok:false, localOnly:true, value };

    // Read before write. If the account already has a Personal Meeting ID, that
    // ID is authoritative and a stale/local random ID must never replace it.
    const existing = await readRemoteRoom();
    if (!existing.ok) {
      console.warn('Personal Room account lookup unavailable; refusing to overwrite remote identity.', existing.reason);
      return { ok:false, localOnly:true, value };
    }

    const next = existing.data?.personal_room_id
      ? { ...value, personalRoomId:String(existing.data.personal_room_id) }
      : value;
    const payload = {
      user_id: session.user.id,
      personal_room_id: next.personalRoomId,
      personal_link_name: next.personalLinkName,
      passcode: next.passcode,
      waiting_room_enabled: next.waitingRoomEnabled,
      updated_at: new Date().toISOString()
    };
    try {
      const result = await client.from('meet_personal_rooms').upsert(payload, { onConflict: 'user_id' });
      if (result.error) {
        const message = String(result.error.message || '');
        if (message.toLowerCase().includes('duplicate')) throw new Error('That personal link name is already in use. Choose another one.');
        console.warn('Personal Room remote sync unavailable; local settings retained.', result.error);
        return { ok:false, localOnly:true, value:next };
      }
      return { ok:true, localOnly:false, value:next };
    } catch (error) {
      if (/already in use/i.test(String(error?.message || ''))) throw error;
      console.warn('Personal Room remote sync failed; local settings retained.', error);
      return { ok:false, localOnly:true, value:next };
    }
  }

  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      let fallbackName = 'dominionstar-member';
      let remote = { ok:false, data:null, reason:'not-checked' };
      try {
        client = await window.DSAuth?.init?.();
        session = client ? (await client.auth.getSession()).data.session : null;
        fallbackName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || fallbackName;
        if (client && session?.user) {
          try {
            const profile = await client.from('member_profiles').select('full_name,preferred_name').eq('id', session.user.id).maybeSingle();
            fallbackName = profile.data?.preferred_name || profile.data?.full_name || fallbackName;
          } catch (_) {}
          remote = await readRemoteRoom();
          if (remote.ok && remote.data) settings = normalizeRoom(remote.data, fallbackName);
        }
      } catch (_) {}

      const local = readLocal();
      if (!settings && local) settings = normalizeRoom(local, fallbackName);

      if (!settings) {
        settings = normalizeRoom({
          personalRoomId:randomDigits(10),
          personalLinkName:slugify(fallbackName),
          passcode:randomDigits(6),
          waitingRoomEnabled:false
        }, fallbackName);
      }

      // If the account query succeeded and had no room, migrate/create exactly
      // once from the stable local cache. If the query failed, keep the local
      // room but do not risk overwriting an unseen account room.
      if (session?.user && remote.ok && !remote.data) {
        try {
          const synced = await upsertRemote(settings);
          if (synced.value?.personalRoomId) settings = normalizeRoom(synced.value, fallbackName);
        } catch (error) {
          console.warn('Personal Room first account sync deferred.', error);
        }
      }

      saveLocal(settings);
      render();
      resolveReady?.(true);
      resolveReady = null;
      window.dispatchEvent(new CustomEvent('dominionstar:personal-room-ready',{detail:{personalRoomId:settings.personalRoomId}}));
      return { ...settings };
    })();
    return loadPromise;
  }

  async function persist(value) {
    validate(value);
    let next = normalizeRoom(value, settings?.personalLinkName || 'dominionstar-member');
    settings = next;
    saveLocal(settings);
    render();

    if (client && session?.user) {
      const synced = await upsertRemote(next);
      if (synced.value?.personalRoomId) {
        next = normalizeRoom(synced.value, next.personalLinkName);
        settings = next;
        saveLocal(settings);
        render();
      }
      return { localOnly:Boolean(synced.localOnly), value:{...settings} };
    }
    return { localOnly:true, value:{...settings} };
  }

  async function saveRoom() {
    setStatus('Saving…');
    await load();
    await persist(formValue());
    showToast('Personal Room saved');
  }

  async function startRoom() {
    setStatus('Starting your Personal Room…');
    await load();
    const value = formValue();
    const saved = await persist(value);
    const current = saved.value || value;
    window.__DS_START_AS_HOST = true;
    window.__DS_WAITING_ROOM = current.waitingRoomEnabled;
    window.__DS_MEETING_PASSCODE = current.passcode;
    const roomInput = $('roomId');
    if (!roomInput) throw new Error('Meeting room field is unavailable. Refresh and try again.');
    roomInput.value = formatMeetingId(current.personalRoomId);
    const params = new URLSearchParams({
      room: current.personalRoomId,
      personal: current.personalLinkName,
      host: '1',
      ...(current.passcode ? {passcode: current.passcode} : {})
    });
    if (current.waitingRoomEnabled) params.set('waiting', '1');
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    $('personalRoomDialog')?.close();
    if (typeof window.DominionStarEnterHostPrejoin === 'function') {
      window.DominionStarEnterHostPrejoin({
        room: current.personalRoomId,
        passcode: current.passcode,
        waitingRoom: current.waitingRoomEnabled,
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
    await load();
    const value = formValue();
    validate(value);
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
      saveRoom().catch(error => showToast(error.message || 'Could not save Personal Room'));
    });
    $('startPersonalRoom')?.addEventListener('click', event => {
      event.preventDefault();
      startRoom().catch(error => showToast(error.message || 'Could not start Personal Room'));
    });
    $('copyPersonalInvite')?.addEventListener('click', event => {
      event.preventDefault();
      copyInvitation().catch(error => showToast(error.message || 'Could not copy invitation'));
    });
    $('personalLinkName')?.addEventListener('input', event => {
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

  window.DominionPersonalRoom = Object.freeze({
    version:'3.0.0-account-authority',
    ready,
    load:()=>load(),
    current:()=>settings?{...settings}:null,
    persist:value=>persist(value),
    formatMeetingId
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { wire(); void load(); }, { once: true });
  } else {
    wire();
    void load();
  }
})();
