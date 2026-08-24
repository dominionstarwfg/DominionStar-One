import { chromium } from 'playwright';

const baseURL = process.env.DOMINIONSTAR_PREVIEW_URL || 'http://127.0.0.1:4173';
const roomId = '7443001370';
const passcode = '360';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const runtimeNoop = `
window.DominionRuntime ||= { events: { publish(){ return true; } } };
window.DominionRuntime.events ||= { publish(){ return true; } };
`;

const memberAuthStub = `
(() => {
  const params = new URLSearchParams(location.search);
  const isGuest = params.get('guest') === '1';
  const session = isGuest ? null : {
    access_token: 'preview-host-token',
    user: {
      id: 'host-user',
      email: 'preview-host@example.invalid',
      user_metadata: { full_name: 'Preview Host' }
    }
  };
  const room = {
    room_id: '${roomId}',
    owner_id: 'host-user',
    waiting_room_enabled: true,
    passcode: '${passcode}',
    active: true,
    updated_at: new Date().toISOString()
  };
  const profile = {
    full_name: 'Preview Host',
    preferred_name: 'Preview Host',
    email: 'preview-host@example.invalid',
    avatar_path: null,
    rank: 'SMD',
    agent_code: 'PREVIEWH'
  };

  function resultFor(table) {
    if (table === 'member_profiles') return { data: profile, error: null };
    if (table === 'meet_user_preferences') return { data: null, error: null };
    if (table === 'meet_rooms') return { data: room, error: null };
    if (table === 'meet_scheduled_meetings') return { data: null, error: null };
    return { data: null, error: null };
  }

  function query(table) {
    let upsertPayload = null;
    let proxy;
    proxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return async () => {
            if (table === 'meet_rooms' && upsertPayload) Object.assign(room, upsertPayload);
            return resultFor(table);
          };
        }
        if (prop === 'upsert') {
          return payload => { upsertPayload = payload; Object.assign(room, payload || {}); return proxy; };
        }
        if (prop === Symbol.toStringTag) return 'DominionStarMeetPreviewQuery';
        return () => proxy;
      }
    });
    return proxy;
  }

  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user || null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } })
    },
    from: table => query(table),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        upload: async () => ({ data: null, error: null })
      })
    }
  };

  window.DSAuth = {
    ready: true,
    init: async () => client,
    getSession: async () => session
  };
})();
`;

const engineStub = `
(() => {
  const listeners = new Map();
  const state = {
    roomId: '',
    participantId: '',
    displayName: '',
    isHost: false,
    role: 'attendee',
    admitted: false,
    waitingRoomEnabled: false,
    audio: true,
    video: true,
    localStream: null,
    screenStream: null,
    channel: null,
    remote: new Map()
  };

  const on = (name, fn) => {
    const list = listeners.get(name) || [];
    list.push(fn);
    listeners.set(name, list);
    return () => listeners.set(name, list.filter(item => item !== fn));
  };
  const emit = (name, payload = {}) => {
    for (const fn of listeners.get(name) || []) {
      try { fn(payload); } catch (error) { console.error(error); }
    }
  };
  const makeStream = label => window.__DS_MAKE_TEST_STREAM__(label);
  const metaForSelf = () => ({
    participantId: state.participantId,
    from: state.participantId,
    displayName: state.displayName,
    isHost: state.isHost,
    role: state.role,
    admitted: state.admitted,
    audio: state.audio,
    video: state.video,
    userId: state.isHost ? 'host-user' : '',
    avatarUrl: ''
  });
  const post = payload => {
    if (!state.channel) return;
    state.channel.postMessage({ roomId: state.roomId, ...payload });
  };
  const addRemote = packet => {
    if (!packet?.from || packet.from === state.participantId) return;
    const previous = state.remote.get(packet.from) || {};
    const person = { ...previous, ...packet, participantId: packet.from };
    state.remote.set(packet.from, person);
    emit('participant-joined', { ...person, from: packet.from, meta: person });
    const stream = previous.stream || makeStream('remote-' + packet.from);
    person.stream = stream;
    state.remote.set(packet.from, person);
    emit('remote-stream', { participantId: packet.from, stream, meta: person });
    emit('presence', { members: [...state.remote.values()].map(item => ({
      participantId: item.participantId || item.from,
      displayName: item.displayName,
      isHost: Boolean(item.isHost),
      role: item.role || 'attendee',
      admitted: item.admitted !== false,
      audio: item.audio !== false,
      video: item.video !== false,
      avatarUrl: ''
    })) });
  };

  const handleBus = event => {
    const packet = event.data || {};
    if (packet.roomId !== state.roomId || packet.from === state.participantId) return;
    if (packet.type === 'join-request') {
      if (state.isHost || state.role === 'cohost') emit('join-request', packet);
      return;
    }
    if (packet.type === 'admitted' && packet.to === state.participantId) {
      state.admitted = true;
      emit('admitted', { participantId: state.participantId, from: packet.from });
      return;
    }
    if (packet.type === 'joined') {
      if (!state.admitted) return;
      addRemote(packet);
      if (state.isHost) post({ type: 'peer-intro', to: packet.from, ...metaForSelf(), from: state.participantId });
      return;
    }
    if (packet.type === 'peer-intro' && packet.to === state.participantId) {
      addRemote(packet);
      return;
    }
    if (packet.type === 'role-change') {
      const nextRole = packet.role || 'attendee';
      if (packet.target === state.participantId) {
        state.role = nextRole;
        state.isHost = nextRole === 'host';
      }
      const existing = state.remote.get(packet.target);
      if (existing) state.remote.set(packet.target, { ...existing, role: nextRole, isHost: nextRole === 'host' });
      emit('role-change', { role: nextRole, participantId: packet.target, from: packet.from });
      return;
    }
    if (packet.type === 'chat') {
      const addressed = !packet.to || packet.to === 'everyone' || packet.to === state.participantId;
      if (addressed) emit('chat', packet);
      return;
    }
    if (packet.type === 'media-state') {
      const person = state.remote.get(packet.from) || { participantId: packet.from, displayName: packet.displayName || 'Participant' };
      Object.assign(person, { audio: packet.audio, video: packet.video });
      state.remote.set(packet.from, person);
      emit('media-state', packet);
      return;
    }
    if (packet.type === 'screen-state') {
      if (packet.active) {
        const stream = makeStream('remote-screen-' + packet.from);
        const person = state.remote.get(packet.from) || { participantId: packet.from, displayName: packet.displayName || 'Participant' };
        person.screenStream = stream;
        state.remote.set(packet.from, person);
        emit('screen-state', { participantId: packet.from, active: true, paused: false, displayName: packet.displayName });
        emit('remote-screen-stream', { participantId: packet.from, stream });
      } else {
        emit('screen-state', { participantId: packet.from, active: false, paused: false, displayName: packet.displayName });
        emit('screen-ended', { participantId: packet.from });
      }
      return;
    }
    if (packet.type === 'ended') {
      emit('meeting-ended', { source: 'preview-two-client' });
    }
  };

  const engine = {
    on,
    snapshot() {
      return {
        roomId: state.roomId,
        participantId: state.participantId,
        isHost: state.isHost,
        role: state.role,
        admitted: state.admitted,
        localStream: state.localStream,
        screenStream: state.screenStream,
        mediaState: { audio: state.audio, video: state.video }
      };
    },
    async init(options = {}) {
      state.roomId = String(options.roomId || '');
      state.displayName = String(options.displayName || 'Participant');
      state.isHost = Boolean(options.isHost);
      state.role = state.isHost ? 'host' : (options.role || 'attendee');
      state.admitted = state.isHost;
      state.waitingRoomEnabled = Boolean(options.waitingRoomEnabled);
      state.participantId = state.isHost ? 'host-ui' : 'guest-ui';
      state.channel?.close?.();
      state.channel = new BroadcastChannel('ds-meet-ui-acceptance-' + state.roomId);
      state.channel.onmessage = handleBus;
      queueMicrotask(() => emit('connected', { participantId: state.participantId }));
      if (!state.isHost) {
        setTimeout(() => post({ type: 'join-request', ...metaForSelf(), from: state.participantId }), 30);
      }
      return engine.snapshot();
    },
    async startMedia({ existingStream, audio = true, video = true } = {}) {
      state.audio = Boolean(audio);
      state.video = Boolean(video);
      state.localStream = existingStream || makeStream('local-' + state.participantId);
      emit('local-stream', { stream: state.localStream });
      emit('local-media-state', { audio: state.audio, video: state.video, stream: state.localStream });
      if (state.admitted) {
        post({ type: 'media-state', ...metaForSelf(), from: state.participantId, audio: state.audio, video: state.video });
      }
      return state.localStream;
    },
    async ready() {
      if (!state.admitted) return false;
      post({ type: 'joined', ...metaForSelf(), from: state.participantId });
      return true;
    },
    async admit(participantId) {
      post({ type: 'admitted', from: state.participantId, to: participantId });
      setTimeout(() => emit('admission-confirmed', { participantId, from: participantId }), 90);
      return true;
    },
    async deny(participantId) {
      post({ type: 'denied', from: state.participantId, to: participantId });
      return true;
    },
    async toggleAudio(enabled) {
      state.audio = Boolean(enabled);
      emit('local-media-state', { audio: state.audio, video: state.video, stream: state.localStream });
      post({ type: 'media-state', ...metaForSelf(), from: state.participantId, audio: state.audio, video: state.video });
      return state.audio;
    },
    async toggleVideo(enabled) {
      state.video = Boolean(enabled);
      emit('local-media-state', { audio: state.audio, video: state.video, stream: state.localStream });
      post({ type: 'media-state', ...metaForSelf(), from: state.participantId, audio: state.audio, video: state.video });
      return state.video;
    },
    async setSpeaking(active, level = 0) {
      post({ type: 'speaking-state', from: state.participantId, participantId: state.participantId, active, level, displayName: state.displayName });
      return true;
    },
    async updateSecurity(settings = {}) {
      emit('security-state', { settings, from: state.participantId });
      return true;
    },
    async setRole(participantId, role) {
      const existing = state.remote.get(participantId);
      if (existing) state.remote.set(participantId, { ...existing, role, isHost: role === 'host' });
      emit('role-change', { role, participantId, from: state.participantId });
      post({ type: 'role-change', from: state.participantId, target: participantId, role });
      return true;
    },
    async setLocalRole(role) {
      state.role = role;
      state.isHost = role === 'host';
      emit('role-change', { role, participantId: state.participantId, from: state.participantId });
      return true;
    },
    async chat(message, to = 'everyone') {
      const payload = {
        type: 'chat',
        from: state.participantId,
        displayName: state.displayName,
        message: String(message),
        to,
        sentAt: Date.now()
      };
      emit('chat', payload);
      post(payload);
      return true;
    },
    async shareScreen() {
      if (state.screenStream) return state.screenStream;
      state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      emit('screen-stream', { stream: state.screenStream, settings: { displaySurface: 'monitor' } });
      post({ type: 'screen-state', from: state.participantId, displayName: state.displayName, active: true });
      return state.screenStream;
    },
    async pauseScreenShare(paused) {
      const value = Boolean(paused);
      emit('screen-paused', { paused: value, privateFreeze: true, stream: state.screenStream });
      return value;
    },
    async stopScreenShare() {
      const old = state.screenStream;
      state.screenStream = null;
      emit('screen-ended', { stream: old });
      post({ type: 'screen-state', from: state.participantId, displayName: state.displayName, active: false });
      old?.getTracks?.().forEach(track => track.stop());
      return true;
    },
    async moderate(participantId, action) {
      if (action === 'mute') post({ type: 'media-state', from: participantId, displayName: state.remote.get(participantId)?.displayName || 'Participant', audio: false, video: state.remote.get(participantId)?.video !== false });
      return true;
    },
    async react(emoji) {
      emit('reaction', { from: state.participantId, displayName: state.displayName, emoji });
      post({ type: 'reaction', from: state.participantId, displayName: state.displayName, emoji });
      return true;
    },
    async spotlight(participantId) {
      emit('spotlight', { participantId, from: state.participantId });
      return true;
    },
    async endMeetingForAll() {
      post({ type: 'ended', from: state.participantId });
      emit('meeting-ended', { source: 'preview-host' });
      return true;
    },
    async leave() {
      state.channel?.close?.();
      return true;
    },
    async recoverPeer() { return { ok: true }; },
    async requestMediaResync() { return true; },
    async respondToModeration() { return true; },
    async updateIdentity() { return true; }
  };

  window.DominionStarMeetingEngine = engine;
})();
`;

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required']
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 780 },
  serviceWorkers: 'block'
});

const errors = [];
context.on('page', page => {
  page.on('pageerror', error => errors.push(`${page.url()} :: ${error?.stack || error?.message || error}`));
});

await context.addInitScript(() => {
  window.__DS_COPIED_TEXT__ = '';
  window.__DS_DISPLAY_MEDIA_CALLS__ = [];
  window.__DS_MAKE_TEST_STREAM__ = label => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '32px sans-serif';
    ctx.fillText(String(label || 'DominionStar'), 28, 64);
    const stream = canvas.captureStream(5);
    stream.__dsCanvas = canvas;
    return stream;
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => window.__DS_MAKE_TEST_STREAM__('preview-camera'),
      getDisplayMedia: async options => {
        window.__DS_DISPLAY_MEDIA_CALLS__.push({
          video: Boolean(options?.video),
          audio: Boolean(options?.audio)
        });
        return window.__DS_MAKE_TEST_STREAM__('preview-screen');
      },
      enumerateDevices: async () => [
        { kind: 'videoinput', deviceId: 'preview-camera', label: 'Preview Camera' },
        { kind: 'audioinput', deviceId: 'preview-mic', label: 'Preview Microphone' },
        { kind: 'audiooutput', deviceId: 'preview-speaker', label: 'Preview Speaker' }
      ]
    }
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async text => { window.__DS_COPIED_TEXT__ = String(text); },
      readText: async () => window.__DS_COPIED_TEXT__
    }
  });
  HTMLMediaElement.prototype.play = async function(){ return undefined; };
  window.DominionRuntime = { events: { publish(){ return true; } } };
});

await context.route('**/assets/js/supabase-config.js*', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: "window.DOMINIONSTAR_SUPABASE={url:'https://preview.invalid',anonKey:'preview'};"
}));
await context.route('**/assets/js/member-auth.js*', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: memberAuthStub
}));
await context.route('**/assets/js/meeting-engine.js*', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: engineStub
}));
await context.route('**/assets/js/runtime/**', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: runtimeNoop
}));
await context.route('**/assets/js/meet/desktop-share-picker.js*', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: 'window.DominionDesktopSharePicker={};'
}));
await context.route('**/assets/js/meet/remote-control.js*', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: 'window.DominionRemoteControl={canRequest:()=>false};'
}));
for (const pattern of [
  '**/assets/js/meet-next/personal-room.js*',
  '**/assets/js/meet/live-transcription.js*',
  '**/assets/js/meet/meeting-intelligence.js*'
]) {
  await context.route(pattern, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: runtimeNoop
  }));
}

await context.route('**/.netlify/functions/resolve-meeting-join', async route => {
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
  const supplied = String(body.passcode || '').replace(/\D/g, '');
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      found: true,
      owner_id: 'host-user',
      waiting_room_enabled: true,
      active: true,
      passcode_required: true,
      passcode_valid: supplied === passcode
    })
  });
});
await context.route('**/.netlify/functions/meeting-host-alert', route => route.fulfill({
  status: 202,
  contentType: 'application/json',
  body: JSON.stringify({ queued: true, delivery: { deferred: true } })
}));

const host = await context.newPage();
const guest = await context.newPage();

async function fillIfEditable(page, selector, value) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'attached' });
  if (await locator.isEditable()) await locator.fill(value);
}

try {
  await host.goto(`${baseURL}/meet/?host=1&waiting=1&room=${roomId}&passcode=${passcode}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await host.waitForFunction(() => Boolean(window.DominionStarMeetingEngine && window.DSAuth), null, { timeout: 10000 });
  await fillIfEditable(host, '#roomId', roomId);
  await fillIfEditable(host, '#meetingPasscode', passcode);
  await host.locator('#joinForm button[type="submit"]').click();
  await host.locator('#meeting').waitFor({ state: 'visible', timeout: 10000 });
  assert(!(await host.locator('#endAllBtn').getAttribute('hidden')), 'host did not receive End Meeting for All authority');
  console.log('MEET_UI_OK host entered with host authority');

  await guest.goto(`${baseURL}/meet/?guest=1&waiting=1&room=${roomId}&passcode=${passcode}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await guest.waitForFunction(() => Boolean(window.DominionStarMeetingEngine && window.DSAuth), null, { timeout: 10000 });
  await fillIfEditable(guest, '#displayName', 'Preview Guest');
  await fillIfEditable(guest, '#roomId', roomId);
  await fillIfEditable(guest, '#meetingPasscode', passcode);
  await guest.locator('#joinForm button[type="submit"]').click();
  await guest.locator('#meeting').waitFor({ state: 'visible', timeout: 10000 });
  await guest.locator('#waitingRoomGate').waitFor({ state: 'visible', timeout: 10000 });
  await host.locator('[data-toast-admit="guest-ui"]').waitFor({ state: 'visible', timeout: 10000 });
  console.log('MEET_UI_OK waiting room is visible to guest and actionable by host');

  await host.locator('[data-toast-admit="guest-ui"]').click();
  await guest.locator('#waitingRoomGate').waitFor({ state: 'hidden', timeout: 10000 });
  await host.waitForFunction(() => document.querySelector('#participantList')?.textContent?.includes('Preview Guest'), null, { timeout: 10000 });
  await host.waitForFunction(() => document.querySelector('[data-tile="guest-ui"]'), null, { timeout: 10000 });
  await guest.waitForFunction(() => document.querySelector('#participantList')?.textContent?.includes('Preview Host'), null, { timeout: 10000 });
  assert((await host.locator('#participantCount').textContent()).trim() === '2', 'host participant count did not reach two');
  assert((await guest.locator('#participantCount').textContent()).trim() === '2', 'guest participant count did not reach two');
  console.log('MEET_UI_OK admission creates participant list and video dock on both clients');

  await host.locator('#participantsBtn').click();
  await host.locator('#participantList [data-participant="guest-ui"]').click();
  await host.getByRole('button', { name: 'Make co-host', exact: true }).click();
  await guest.waitForFunction(() => !document.getElementById('hostToolsBtn')?.hidden, null, { timeout: 10000 });
  assert(await guest.locator('#endAllBtn').getAttribute('hidden') !== null, 'co-host incorrectly received End Meeting for All authority');
  await host.waitForFunction(() => document.querySelector('#participantList')?.textContent?.includes('Co-host'), null, { timeout: 10000 });

  await guest.locator('#participantsBtn').click();
  await guest.locator('#participantList [data-participant="host-ui"]').click();
  const cohostMenuText = await guest.locator('#deviceMenu').textContent();
  assert(!/Make co-host|Make host/i.test(cohostMenuText), 'co-host was incorrectly allowed to appoint host or co-host from the participant menu');
  await guest.keyboard.press('Escape').catch(() => {});
  console.log('MEET_UI_OK co-host moderation authority is visible without host-only promotion/end powers');

  if (await host.locator('#chatPanel').isHidden()) await host.locator('#chatBtn').click();
  await host.locator('#chatInput').fill('Public preview message');
  await host.locator('#chatForm').evaluate(form => form.requestSubmit());
  await guest.waitForFunction(() => document.body.textContent.includes('Public preview message'), null, { timeout: 10000 });

  await host.selectOption('#chatRecipient', 'guest-ui');
  await host.locator('#chatInput').fill('Private preview message');
  await host.locator('#chatForm').evaluate(form => form.requestSubmit());
  await guest.waitForFunction(() => document.body.textContent.includes('Private preview message'), null, { timeout: 10000 });
  const guestChatText = await guest.locator('#chatMessages').textContent();
  assert(/Private preview message/.test(guestChatText), 'private chat did not reach the intended participant');
  console.log('MEET_UI_OK public and private meeting chat routes correctly');

  if (await host.locator('#participantsPanel').isHidden()) await host.locator('#participantsBtn').click();
  await host.locator('#inviteBtn').click();
  await host.locator('#inviteDialog').waitFor({ state: 'visible', timeout: 5000 });
  const inviteLink = await host.locator('#inviteMeetingLink').inputValue();
  assert(inviteLink.includes(`room=${roomId}`), `invite link omitted meeting ID: ${inviteLink}`);
  assert(inviteLink.includes(`passcode=${passcode}`), `invite link omitted passcode: ${inviteLink}`);
  await host.locator('#copyInviteBtn').click();
  const copied = await host.evaluate(() => window.__DS_COPIED_TEXT__);
  assert(copied.includes(roomId) && copied.includes(passcode), 'copied invitation omitted meeting credentials');
  await host.locator('#closeInviteBtn').click();
  console.log('MEET_UI_OK one-click invitation carries room and passcode');

  await host.locator('#micBtn').click();
  await host.waitForFunction(() => document.querySelector('#micBtn .tool-label')?.textContent === 'Unmute', null, { timeout: 5000 });
  await guest.waitForFunction(() => document.querySelector('[data-row="host-ui"] .participant-mic-action')?.classList.contains('is-off'), null, { timeout: 5000 });
  await host.locator('#micBtn').click();

  await host.locator('#camBtn').click();
  await host.waitForFunction(() => document.querySelector('#camBtn .tool-label')?.textContent === 'Start Video', null, { timeout: 5000 });
  await guest.waitForFunction(() => document.querySelector('[data-tile="host-ui"]')?.classList.contains('camera-off'), null, { timeout: 5000 });
  await host.locator('#camBtn').click();
  console.log('MEET_UI_OK microphone and camera intent synchronize to the other client');

  await host.locator('#shareBtn').click();
  await host.waitForFunction(() => document.body.classList.contains('local-presentation-active'), null, { timeout: 5000 });
  const captureBoundary = await host.evaluate(() => ({
    calls: Array.isArray(window.__DS_DISPLAY_MEDIA_CALLS__) ? window.__DS_DISPLAY_MEDIA_CALLS__.slice() : [],
    mode: window.DominionWebScreenShare?.mode || '',
    desktop: Boolean(window.dominionDesktop?.isDesktop),
    desktopBootstrapLoaded: Boolean(document.querySelector('script[data-ds-operation-2030-bootstrap]'))
  }));
  assert(captureBoundary.calls.length === 1, `Share Screen did not traverse getDisplayMedia exactly once: ${JSON.stringify(captureBoundary)}`);
  assert(captureBoundary.calls[0]?.video === true, 'Browser Share Screen did not request a video presentation track');
  assert(captureBoundary.mode === 'browser-native-picker', `Web share boundary is not browser-native: ${captureBoundary.mode}`);
  assert(captureBoundary.desktop === false, 'Web acceptance unexpectedly entered desktop mode');
  assert(captureBoundary.desktopBootstrapLoaded === false, 'Web Share Screen loaded the desktop Operation 2030 bootstrap');
  console.log('MEET_UI_OK Share Screen traverses browser-native getDisplayMedia without desktop bootstrap leakage');

  await guest.waitForFunction(() => document.body.classList.contains('presentation-active'), null, { timeout: 5000 });
  await guest.waitForFunction(() => {
    const video = document.getElementById('stageVideo');
    return video?.srcObject?.getVideoTracks?.()[0]?.readyState === 'live';
  }, null, { timeout: 5000 });
  assert((await guest.locator('#shareStatusText').textContent()).trim() === 'Preview Host is sharing', 'viewer sharing status is not Zoom-style presenter status');

  const viewerTrackBefore = await guest.evaluate(() => document.getElementById('stageVideo')?.srcObject?.getVideoTracks?.()[0]?.id || '');
  await host.locator('#pauseShareBtn').click();
  await host.waitForFunction(() => document.getElementById('pauseShareBtn')?.textContent === 'Resume Share', null, { timeout: 5000 });
  const viewerStatusWhilePaused = (await guest.locator('#shareStatusText').textContent()).trim();
  const viewerTrackWhilePaused = await guest.evaluate(() => {
    const track = document.getElementById('stageVideo')?.srcObject?.getVideoTracks?.()[0];
    return { id: track?.id || '', readyState: track?.readyState || '' };
  });
  assert(viewerStatusWhilePaused === 'Preview Host is sharing', 'Pause Share exposed a paused notification to the viewer');
  assert(viewerTrackWhilePaused.id === viewerTrackBefore && viewerTrackWhilePaused.readyState === 'live', 'Pause Share removed the viewer presentation instead of retaining it');
  await host.locator('#pauseShareBtn').click();
  await host.waitForFunction(() => document.getElementById('pauseShareBtn')?.textContent === 'Pause Share', null, { timeout: 5000 });
  await host.locator('#stopShareBtn').click();
  await guest.waitForFunction(() => !document.body.classList.contains('presentation-active'), null, { timeout: 5000 });
  console.log('MEET_UI_OK share, private Pause Share presentation continuity, resume and stop');

  for (const size of [{ width: 1100, height: 650 }, { width: 780, height: 600 }, { width: 1440, height: 850 }]) {
    await host.setViewportSize(size);
    await host.waitForTimeout(120);
    const geometry = await host.evaluate(() => {
      const dock = document.getElementById('filmstrip');
      const rect = dock && !dock.hidden ? dock.getBoundingClientRect() : null;
      return {
        width: innerWidth,
        height: innerHeight,
        bodyScroll: document.body.scrollHeight,
        docScroll: document.documentElement.scrollHeight,
        dock: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null
      };
    });
    assert(geometry.bodyScroll <= geometry.height + 2 && geometry.docScroll <= geometry.height + 2,
      `meeting became a scrolling webpage at ${size.width}x${size.height}`);
    if (geometry.dock) {
      assert(geometry.dock.left >= -1 && geometry.dock.top >= -1 && geometry.dock.right <= geometry.width + 1 && geometry.dock.bottom <= geometry.height + 1,
        `participant dock escaped the viewport at ${size.width}x${size.height}`);
    }
  }
  console.log('MEET_UI_OK desktop resize keeps meeting fixed and participant dock inside the viewport');

  await host.locator('#leaveBtn').click();
  await host.locator('#leaveDialog').waitFor({ state: 'visible', timeout: 5000 });
  assert(await host.locator('#endAllBtn').getAttribute('hidden') === null, 'host Leave dialog hid End Meeting for All');
  await host.locator('#leaveCancelBtn').click();

  await guest.locator('#leaveBtn').click();
  await guest.locator('#leaveDialog').waitFor({ state: 'visible', timeout: 5000 });
  assert(await guest.locator('#endAllBtn').getAttribute('hidden') !== null, 'co-host Leave dialog exposed End Meeting for All');
  await guest.locator('#leaveCancelBtn').click();
  console.log('MEET_UI_OK host versus co-host Leave/End authority remains distinct');

  assert(errors.length === 0, `composed Meet UI produced page errors:\n${errors.join('\n---\n')}`);
  console.log('DOMINIONSTAR_TWO_CLIENT_MEET_UI_ACCEPTANCE_OK');
} finally {
  await context.close();
  await browser.close();
}
