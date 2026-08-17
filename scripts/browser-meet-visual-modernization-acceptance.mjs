import { chromium } from 'playwright';

const baseURL = process.env.DOMINIONSTAR_PREVIEW_URL || 'http://127.0.0.1:4173';
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 780 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error?.stack || error?.message || error)));

try {
  await page.goto(`${baseURL}/meet/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('#filmstrip [data-dock-view]')];
    const hand = document.querySelector('#raiseHandBtn .raise-hand-icon');
    return buttons.length === 4 && buttons.every(button => button.querySelector('svg')) && Boolean(hand?.querySelector('svg'));
  }, null, { timeout: 10000 });

  const iconState = await page.evaluate(() => ({
    dock: [...document.querySelectorAll('#filmstrip [data-dock-view]')].map(button => ({
      view: button.dataset.dockView,
      text: button.textContent.trim(),
      hasSvg: Boolean(button.querySelector('svg')),
      modernized: button.dataset.dsModernIcon === '1'
    })),
    raiseHandText: document.querySelector('#raiseHandBtn .raise-hand-icon')?.textContent?.trim() || '',
    raiseHandSvg: Boolean(document.querySelector('#raiseHandBtn .raise-hand-icon svg')),
    futureBlue: getComputedStyle(document.documentElement).getPropertyValue('--ds-future-blue').trim(),
    futureCyan: getComputedStyle(document.documentElement).getPropertyValue('--ds-future-cyan').trim(),
    futureGold: getComputedStyle(document.documentElement).getPropertyValue('--ds-future-gold').trim()
  }));

  assert(iconState.dock.length === 4, `expected four dock view controls, found ${iconState.dock.length}`);
  assert(iconState.dock.every(item => item.hasSvg && item.modernized && item.text === ''),
    `legacy dock glyphs remain visible: ${JSON.stringify(iconState.dock)}`);
  assert(iconState.raiseHandSvg && !iconState.raiseHandText.includes('✋'), 'Raise Hand still exposes an emoji instead of vector iconography');
  assert(iconState.futureBlue && iconState.futureCyan && iconState.futureGold, 'futuristic DominionStar surface tokens are missing');

  const prejoinSurface = await page.evaluate(() => {
    const card = document.querySelector('.join-card');
    const preview = document.querySelector('.preview-shell');
    const cardStyle = card ? getComputedStyle(card) : null;
    const previewStyle = preview ? getComputedStyle(preview) : null;
    return {
      cardBackground: cardStyle?.backgroundImage || '',
      cardBackdrop: cardStyle?.backdropFilter || cardStyle?.webkitBackdropFilter || '',
      previewShadow: previewStyle?.boxShadow || ''
    };
  });
  assert(/gradient/i.test(prejoinSurface.cardBackground), `pre-join futuristic surface missing: ${prejoinSurface.cardBackground}`);
  assert(/blur/i.test(prejoinSurface.cardBackdrop), `pre-join glass treatment missing: ${prejoinSurface.cardBackdrop}`);
  assert(prejoinSurface.previewShadow && prejoinSurface.previewShadow !== 'none', 'pre-join preview has no depth treatment');

  await page.evaluate(() => {
    const participantList = document.getElementById('participantList');
    const row = document.createElement('div');
    row.className = 'participant-row';
    const badge = document.createElement('b');
    badge.className = 'participant-raised-hand';
    badge.title = 'Raised hand queue position 3';
    badge.textContent = '✋ #3';
    row.append(badge);
    participantList.append(row);
  });

  await page.waitForFunction(() => {
    const badge = document.querySelector('#participantList .participant-raised-hand');
    return badge?.dataset.dsModernIcon === '1' && Boolean(badge.querySelector('svg'));
  }, null, { timeout: 5000 });

  const dynamicHand = await page.locator('#participantList .participant-raised-hand').evaluate(badge => ({
    text: badge.textContent.trim(),
    hasSvg: Boolean(badge.querySelector('svg')),
    queue: badge.querySelector('.raised-hand-queue')?.textContent?.trim() || ''
  }));
  assert(dynamicHand.hasSvg && dynamicHand.queue === '#3' && !dynamicHand.text.includes('✋'),
    `dynamic participant hand was not modernized: ${JSON.stringify(dynamicHand)}`);

  const surface = await page.evaluate(() => {
    document.body.classList.add('meeting-active');
    const toolbar = document.getElementById('meetingToolbar');
    const dock = document.getElementById('filmstrip');
    const participants = document.getElementById('participantsPanel');
    const chat = document.getElementById('chatPanel');
    const deviceMenu = document.getElementById('deviceMenu');
    const shareStatus = document.getElementById('shareStatusBar');
    const settings = document.getElementById('settingsDialog');
    if (settings) settings.setAttribute('open','');

    let alert = document.querySelector('.join-request-toast.waiting-room-banner');
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'join-request-toast waiting-room-banner';
      document.body.append(alert);
    }

    const styleOf = node => node ? getComputedStyle(node) : null;
    const compact = node => {
      const style = styleOf(node);
      return {
        background: style?.backgroundImage || '',
        backdrop: style?.backdropFilter || style?.webkitBackdropFilter || '',
        shadow: style?.boxShadow || '',
        border: style?.borderColor || '',
        radius: style?.borderRadius || ''
      };
    };

    return {
      toolbar: compact(toolbar),
      dock: compact(dock),
      participants: compact(participants),
      chat: compact(chat),
      deviceMenu: compact(deviceMenu),
      shareStatus: compact(shareStatus),
      settings: compact(settings),
      alert: compact(alert)
    };
  });

  assert(/gradient/i.test(surface.toolbar.background), `toolbar futuristic gradient missing: ${surface.toolbar.background}`);
  assert(surface.toolbar.radius === '18px', `toolbar radius contract changed: ${surface.toolbar.radius}`);
  assert(/blur/i.test(surface.toolbar.backdrop), `toolbar glass treatment missing: ${surface.toolbar.backdrop}`);
  assert(/gradient/i.test(surface.dock.background), `participant dock futuristic gradient missing: ${surface.dock.background}`);
  assert(/blur/i.test(surface.dock.backdrop), `participant dock glass treatment missing: ${surface.dock.backdrop}`);

  for (const name of ['participants','chat','deviceMenu','shareStatus','settings','alert']) {
    const item = surface[name];
    assert(/gradient/i.test(item.background), `${name} feature surface is not futuristic: ${JSON.stringify(item)}`);
    assert(item.shadow && item.shadow !== 'none', `${name} feature surface has no depth treatment`);
  }
  assert(/blur/i.test(surface.participants.backdrop), `participants panel glass treatment missing: ${surface.participants.backdrop}`);
  assert(/blur/i.test(surface.chat.backdrop), `chat panel glass treatment missing: ${surface.chat.backdrop}`);
  assert(/blur/i.test(surface.deviceMenu.backdrop), `device menu glass treatment missing: ${surface.deviceMenu.backdrop}`);
  assert(/blur/i.test(surface.shareStatus.backdrop), `share controls glass treatment missing: ${surface.shareStatus.backdrop}`);

  assert(errors.length === 0, `Meet visual contract produced page errors:\n${errors.join('\n---\n')}`);

  console.log('MEET_VISUAL_OK vector dock controls');
  console.log('MEET_VISUAL_OK vector raised-hand controls and dynamic queue badge');
  console.log('MEET_VISUAL_OK futuristic pre-join surface');
  console.log('MEET_VISUAL_OK futuristic toolbar, dock, participants, chat, device menu, settings, share and alert surfaces');
  console.log('DOMINIONSTAR_MEET_VISUAL_MODERNIZATION_ACCEPTANCE_OK');
} finally {
  await context.close();
  await browser.close();
}
