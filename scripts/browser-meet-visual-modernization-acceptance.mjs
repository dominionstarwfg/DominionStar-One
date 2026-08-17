import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.DOMINIONSTAR_PREVIEW_URL || 'http://127.0.0.1:4173';
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const reviewDir = '.visual-review';
fs.mkdirSync(reviewDir,{recursive:true});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 780 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error?.stack || error?.message || error)));

const screenshot = async name => {
  await page.screenshot({ path: `${reviewDir}/${name}.png`, animations: 'disabled' });
};

try {
  await page.goto(`${baseURL}/meet/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('#filmstrip [data-dock-view]')];
    const hand = document.querySelector('#raiseHandBtn .raise-hand-icon');
    return buttons.length === 4 && buttons.every(button => button.querySelector('svg')) && Boolean(hand?.querySelector('svg'));
  }, null, { timeout: 10000 });

  await screenshot('01-prejoin');

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

  // Capture the exact certified candidate in representative visible states for
  // human review. These screenshots do not alter the production authorization gate.
  await page.evaluate(() => {
    document.body.classList.remove('prejoin-active','local-presentation-active','waiting-room-active');
    document.body.classList.add('meeting-active');
    const prejoin=document.getElementById('prejoin');
    const meeting=document.getElementById('meeting');
    if(prejoin) prejoin.hidden=true;
    if(meeting){meeting.hidden=false;meeting.classList.remove('waiting-room-active');}
    const stageFallback=document.getElementById('stageFallback');
    if(stageFallback) stageFallback.hidden=false;
    const stageName=document.getElementById('stageName');
    if(stageName) stageName.textContent='DominionStar Leadership Meeting';
    const roomLabel=document.getElementById('roomLabel');
    if(roomLabel) roomLabel.textContent='Meeting ID: 744 300 1370';
    const connection=document.getElementById('connectionState');
    if(connection) connection.textContent='Connected';
    for(const id of ['participantsPanel','chatPanel','deviceMenu','shareStatusBar']){
      const el=document.getElementById(id); if(el){el.hidden=true;el.style.removeProperty('display');}
    }
    const settings=document.getElementById('settingsDialog');
    if(settings?.open) settings.close(); else settings?.removeAttribute('open');
    document.querySelector('.join-request-toast.waiting-room-banner')?.remove();
  });
  await screenshot('02-live-meeting');

  await page.evaluate(() => {
    const panel=document.getElementById('participantsPanel');
    if(panel){panel.hidden=false;panel.style.display='block';}
    const list=document.getElementById('participantList');
    if(list){
      list.innerHTML=`
        <div class="participant-row is-speaking"><div class="participant-avatar">LA</div><div class="participant-name">Levismond Aken <span class="participant-role">Host</span></div><div class="participant-actions"><button aria-label="More">•••</button></div></div>
        <div class="participant-row"><div class="participant-avatar">JM</div><div class="participant-name">Jordan Miles <span class="participant-role">Co-host</span></div><div class="participant-actions"><button aria-label="More">•••</button></div></div>
        <div class="participant-row"><div class="participant-avatar">AK</div><div class="participant-name">Amina K.</div><div class="participant-actions"><button aria-label="More">•••</button></div></div>`;
    }
  });
  await screenshot('03-participants');

  await page.evaluate(() => {
    const participants=document.getElementById('participantsPanel');
    if(participants){participants.hidden=true;participants.style.display='none';}
    const chat=document.getElementById('chatPanel');
    if(chat){chat.hidden=false;chat.style.display='block';}
    const messages=document.getElementById('chatMessages');
    if(messages){messages.innerHTML='<div class="chat-message"><strong>Jordan Miles</strong><p>Welcome to DominionStar Meet.</p></div><div class="chat-message"><strong>Levismond Aken</strong><p>We will begin in a moment.</p></div>';}
  });
  await screenshot('04-chat');

  await page.evaluate(() => {
    const chat=document.getElementById('chatPanel');
    if(chat){chat.hidden=true;chat.style.display='none';}
    const menu=document.getElementById('deviceMenu');
    if(menu){menu.hidden=false;menu.style.display='block';menu.style.left='90px';}
  });
  await screenshot('05-device-menu');

  await page.evaluate(() => {
    const menu=document.getElementById('deviceMenu');
    if(menu){menu.hidden=true;menu.style.display='none';}
    const settings=document.getElementById('settingsDialog');
    if(settings){settings.removeAttribute('open'); if(typeof settings.showModal==='function') settings.showModal(); else settings.setAttribute('open','');}
  });
  await screenshot('06-settings');

  await page.evaluate(() => {
    const settings=document.getElementById('settingsDialog');
    if(settings?.open && typeof settings.close==='function') settings.close(); else settings?.removeAttribute('open');
    document.body.classList.add('local-presentation-active');
    const share=document.getElementById('shareStatusBar');
    if(share){share.hidden=false;share.style.display='flex';}
    const text=document.getElementById('shareStatusText');
    if(text) text.textContent='You are sharing your screen';
  });
  await screenshot('07-screen-share-controls');

  await page.evaluate(() => {
    document.body.classList.remove('local-presentation-active');
    document.body.classList.add('waiting-room-active');
    const meeting=document.getElementById('meeting');
    if(meeting) meeting.classList.add('waiting-room-active');
    let gate=document.getElementById('waitingRoomGate');
    if(!gate){
      gate=document.createElement('section');
      gate.id='waitingRoomGate';
      gate.className='waiting-room-gate';
      gate.innerHTML=`<div class="waiting-room-brand-stage" aria-label="DominionStar waiting room">
        <img class="waiting-room-logo" src="/assets/logo.jpeg" alt="DominionStar Leadership">
        <p class="waiting-room-eyebrow">DOMINIONSTAR LEADERSHIP</p>
        <h1>You are in the Waiting Room</h1>
        <p class="waiting-room-message">The host knows you are here.</p>
        <div class="waiting-room-preview" aria-label="Camera and microphone preview">
          <div class="waiting-room-preview-fallback"><img src="/assets/logo.jpeg" alt=""></div>
          <div class="waiting-room-preview-controls">
            <button type="button" class="waiting-preview-mic" aria-label="Toggle microphone"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg></button>
            <button type="button" class="waiting-preview-cam" aria-label="Toggle camera"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"></rect><path d="m16 10 5-3v10l-5-3"></path></svg></button>
            <button type="button" class="waiting-preview-settings" aria-label="Audio and video settings"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2H10V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg></button>
          </div>
        </div>
        <label class="waiting-room-remember"><input type="checkbox"><span>Remember my camera and microphone choices</span></label>
        <div class="waiting-room-pulse" aria-hidden="true"><i></i><i></i><i></i></div>
        <small>You will join automatically when the host admits you.</small>
        <button type="button" class="waiting-room-leave">Leave Meeting</button>
      </div>`;
      document.body.append(gate);
    }
  });
  await screenshot('08-waiting-room');

  assert(errors.length === 0, `Meet visual contract produced page errors:\n${errors.join('\n---\n')}`);

  console.log('MEET_VISUAL_OK vector dock controls');
  console.log('MEET_VISUAL_OK vector raised-hand controls and dynamic queue badge');
  console.log('MEET_VISUAL_OK futuristic pre-join surface');
  console.log('MEET_VISUAL_OK futuristic toolbar, dock, participants, chat, device menu, settings, share and alert surfaces');
  console.log('MEET_VISUAL_REVIEW_SCREENSHOTS_WRITTEN', reviewDir);
  console.log('DOMINIONSTAR_MEET_VISUAL_MODERNIZATION_ACCEPTANCE_OK');
} finally {
  await context.close();
  await browser.close();
}