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
    futureCyan: getComputedStyle(document.documentElement).getPropertyValue('--ds-future-cyan').trim()
  }));

  assert(iconState.dock.length === 4, `expected four dock view controls, found ${iconState.dock.length}`);
  assert(iconState.dock.every(item => item.hasSvg && item.modernized && item.text === ''),
    `legacy dock glyphs remain visible: ${JSON.stringify(iconState.dock)}`);
  assert(iconState.raiseHandSvg && !iconState.raiseHandText.includes('✋'), 'Raise Hand still exposes an emoji instead of vector iconography');
  assert(iconState.futureBlue && iconState.futureCyan, 'futuristic DominionStar surface tokens are missing');

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
    const toolbarStyle = getComputedStyle(toolbar);
    const dockStyle = getComputedStyle(dock);
    return {
      toolbarBackground: toolbarStyle.backgroundImage,
      toolbarRadius: toolbarStyle.borderRadius,
      toolbarBackdrop: toolbarStyle.backdropFilter || toolbarStyle.webkitBackdropFilter || '',
      dockBackground: dockStyle.backgroundImage,
      dockBackdrop: dockStyle.backdropFilter || dockStyle.webkitBackdropFilter || ''
    };
  });

  assert(/gradient/i.test(surface.toolbarBackground), `toolbar futuristic gradient missing: ${surface.toolbarBackground}`);
  assert(surface.toolbarRadius === '18px', `toolbar radius contract changed: ${surface.toolbarRadius}`);
  assert(/blur/i.test(surface.toolbarBackdrop), `toolbar glass treatment missing: ${surface.toolbarBackdrop}`);
  assert(/gradient/i.test(surface.dockBackground), `participant dock futuristic gradient missing: ${surface.dockBackground}`);
  assert(/blur/i.test(surface.dockBackdrop), `participant dock glass treatment missing: ${surface.dockBackdrop}`);
  assert(errors.length === 0, `Meet visual contract produced page errors:\n${errors.join('\n---\n')}`);

  console.log('MEET_VISUAL_OK vector dock controls');
  console.log('MEET_VISUAL_OK vector raised-hand controls and dynamic queue badge');
  console.log('MEET_VISUAL_OK futuristic glass/depth surface system');
  console.log('DOMINIONSTAR_MEET_VISUAL_MODERNIZATION_ACCEPTANCE_OK');
} finally {
  await context.close();
  await browser.close();
}
