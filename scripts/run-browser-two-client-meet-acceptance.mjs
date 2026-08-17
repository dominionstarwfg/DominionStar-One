import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, 'browser-two-client-meet-acceptance.mjs');
const runtimePath = join(here, '.browser-two-client-meet-acceptance.runtime.mjs');

const waitingBefore = `  await guest.locator('#meeting').waitFor({ state: 'visible', timeout: 10000 });
  await guest.locator('#waitingRoomGate').waitFor({ state: 'visible', timeout: 10000 });`;

const waitingAfter = `  await guest.waitForFunction(() => {
    const meeting = document.getElementById('meeting');
    return Boolean(
      meeting &&
      !meeting.hidden &&
      meeting.classList.contains('waiting-room-active') &&
      meeting.getAttribute('aria-busy') === 'true'
    );
  }, null, { timeout: 10000 });
  await guest.locator('#waitingRoomGate').waitFor({ state: 'visible', timeout: 10000 });`;

const authorityBefore = `  await guest.keyboard.press('Escape').catch(() => {});
  console.log('MEET_UI_OK co-host moderation authority is visible without host-only promotion/end powers');`;

const authorityAfter = `${authorityBefore}

  await host.locator('#micMenuBtn').click();
  await host.waitForFunction(() => {
    const menu = document.getElementById('deviceMenu');
    return Boolean(menu && !menu.hidden && menu.dataset.dsProfessionalAudio === '1');
  }, null, { timeout: 5000 });
  const audioMenuText = await host.locator('#deviceMenu').textContent();
  assert(/Microphone/.test(audioMenuText) && /Preview Microphone/.test(audioMenuText), 'professional Audio menu omitted microphone selection');
  assert(/Speaker/.test(audioMenuText) && /Preview Speaker/.test(audioMenuText), 'professional Audio menu omitted speaker/output selection');
  assert(/Audio Settings/.test(audioMenuText), 'professional Audio menu omitted Audio Settings');
  await host.getByRole('button', { name: 'Audio Settings…', exact: true }).click();
  await host.locator('#settingsDialog').waitFor({ state: 'visible', timeout: 5000 });
  assert(await host.locator('#speakerSelect').count() === 1, 'Audio Settings omitted speaker/output selection');
  await host.keyboard.press('Escape');
  console.log('MEET_UI_OK quick Audio controls expose microphone, speaker and full audio settings');

  await host.locator('#hostToolsBtn').click();
  await host.waitForFunction(() => {
    const menu = document.getElementById('deviceMenu');
    return Boolean(menu && !menu.hidden && /Lock Meeting/.test(menu.textContent || ''));
  }, null, { timeout: 5000 });
  const hostToolsText = await host.locator('#deviceMenu').textContent();
  assert(/Enable Waiting Room/.test(hostToolsText), 'host lost the ability to enable or disable the Waiting Room');
  await host.keyboard.press('Escape');

  await guest.locator('#hostToolsBtn').click();
  await guest.waitForFunction(() => {
    const menu = document.getElementById('deviceMenu');
    return Boolean(menu && !menu.hidden && /Lock Meeting/.test(menu.textContent || ''));
  }, null, { timeout: 5000 });
  await guest.waitForTimeout(80);
  const cohostToolsText = await guest.locator('#deviceMenu').textContent();
  assert(!/Enable Waiting Room/.test(cohostToolsText), 'co-host incorrectly received host-only Waiting Room enable/disable authority');
  await guest.keyboard.press('Escape');

  if (await guest.locator('#participantsPanel').isHidden()) await guest.locator('#participantsBtn').click();
  await guest.locator('#participantMoreBtn').click();
  await guest.waitForFunction(() => {
    const menu = document.getElementById('deviceMenu');
    return Boolean(menu && !menu.hidden && /Participant Management|Participants/.test(menu.textContent || ''));
  }, null, { timeout: 5000 });
  await guest.waitForTimeout(80);
  const cohostParticipantToolsText = await guest.locator('#deviceMenu').textContent();
  assert(!/(^|\n)Waiting Room($|\n)/.test(cohostParticipantToolsText), 'co-host participant menu exposed Waiting Room enable/disable authority');
  await guest.keyboard.press('Escape');
  console.log('MEET_UI_OK host-only Waiting Room enablement is enforced while co-host moderation remains available');`;

const presentationBefore = `  await host.waitForFunction(() => document.body.classList.contains('local-presentation-active'), null, { timeout: 5000 });
  await guest.waitForFunction(() => document.body.classList.contains('presentation-active'), null, { timeout: 5000 });`;

const presentationAfter = `${presentationBefore}
  assert(await host.locator('#meetingToolbar').isHidden(), 'normal meeting toolbar remained visible while presenting');
  assert(await host.locator('#shareStatusBar').isVisible(), 'floating presenter toolbar did not replace the normal meeting toolbar');`;

const stopBefore = `  await host.locator('#stopShareBtn').click();
  await guest.waitForFunction(() => !document.body.classList.contains('presentation-active'), null, { timeout: 5000 });`;

const stopAfter = `${stopBefore}
  await host.waitForFunction(() => !document.body.classList.contains('local-presentation-active'), null, { timeout: 5000 });
  assert(await host.locator('#meetingToolbar').isVisible(), 'normal meeting toolbar did not return after screen sharing stopped');`;

const smoothnessBefore = `  console.log('MEET_UI_OK desktop resize keeps meeting fixed and participant dock inside the viewport');

  await host.locator('#leaveBtn').click();`;

const smoothnessAfter = `  console.log('MEET_UI_OK desktop resize keeps meeting fixed and participant dock inside the viewport');

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await host.locator('#micBtn').click();
    await host.waitForFunction(() => window.DominionStarMeetingEngine?.snapshot?.().mediaState?.audio === false, null, { timeout: 5000 });
    await guest.waitForFunction(() => {
      const mic = document.querySelector('[data-row="host-ui"] .participant-mic-action');
      return Boolean(mic && mic.classList.contains('is-off'));
    }, null, { timeout: 5000 });
    await host.locator('#micBtn').click();
    await host.waitForFunction(() => window.DominionStarMeetingEngine?.snapshot?.().mediaState?.audio === true, null, { timeout: 5000 });
    await guest.waitForFunction(() => {
      const mic = document.querySelector('[data-row="host-ui"] .participant-mic-action');
      return Boolean(mic && !mic.classList.contains('is-off'));
    }, null, { timeout: 5000 });

    await host.locator('#camBtn').click();
    await host.waitForFunction(() => window.DominionStarMeetingEngine?.snapshot?.().mediaState?.video === false, null, { timeout: 5000 });
    await guest.waitForFunction(() => document.querySelector('[data-tile="host-ui"]')?.classList.contains('camera-off') === true, null, { timeout: 5000 });
    await host.locator('#camBtn').click();
    await host.waitForFunction(() => window.DominionStarMeetingEngine?.snapshot?.().mediaState?.video === true, null, { timeout: 5000 });
    await guest.waitForFunction(() => document.querySelector('[data-tile="host-ui"]')?.classList.contains('camera-off') === false, null, { timeout: 5000 });

    await host.locator('#shareBtn').click();
    await host.waitForFunction(() => document.body.classList.contains('local-presentation-active'), null, { timeout: 5000 });
    await guest.waitForFunction(() => document.body.classList.contains('presentation-active'), null, { timeout: 5000 });
    const stressViewerTrackBefore = await guest.evaluate(() => document.getElementById('stageVideo')?.srcObject?.getVideoTracks?.()[0]?.id || '');
    assert(stressViewerTrackBefore, 'smoothness cycle ' + cycle + ' did not produce a viewer presentation track');

    await host.locator('#pauseShareBtn').click();
    await host.waitForFunction(() => document.getElementById('pauseShareBtn')?.textContent === 'Resume Share', null, { timeout: 5000 });
    const stressPausedViewer = await guest.evaluate(() => {
      const video = document.getElementById('stageVideo');
      const track = video?.srcObject?.getVideoTracks?.()[0];
      return {
        id: track?.id || '',
        readyState: track?.readyState || '',
        status: document.getElementById('shareStatusText')?.textContent?.trim() || ''
      };
    });
    assert(stressPausedViewer.id === stressViewerTrackBefore && stressPausedViewer.readyState === 'live',
      'smoothness cycle ' + cycle + ' pause removed the frozen viewer presentation');
    assert(stressPausedViewer.status === 'Preview Host is sharing',
      'smoothness cycle ' + cycle + ' exposed private Pause Share state to the viewer');

    await host.locator('#pauseShareBtn').click();
    await host.waitForFunction(() => document.getElementById('pauseShareBtn')?.textContent === 'Pause Share', null, { timeout: 5000 });

    for (const size of [
      { width: 900, height: 620 },
      { width: 720, height: 560 },
      { width: 1280, height: 780 }
    ]) {
      await host.setViewportSize(size);
      await host.waitForTimeout(100);
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
        'smoothness cycle ' + cycle + ' became a scrolling webpage at ' + size.width + 'x' + size.height);
      if (geometry.dock) {
        assert(geometry.dock.left >= -1 && geometry.dock.top >= -1 && geometry.dock.right <= geometry.width + 1 && geometry.dock.bottom <= geometry.height + 1,
          'smoothness cycle ' + cycle + ' participant dock escaped the viewport at ' + size.width + 'x' + size.height);
      }
      assert(await host.locator('#shareStatusBar').isVisible(),
        'smoothness cycle ' + cycle + ' lost the floating share toolbar during resize');
    }

    await host.locator('#stopShareBtn').click();
    await guest.waitForFunction(() => !document.body.classList.contains('presentation-active'), null, { timeout: 5000 });
    await host.waitForFunction(() => !document.body.classList.contains('local-presentation-active'), null, { timeout: 5000 });
    assert(await host.locator('#meetingToolbar').isVisible(), 'smoothness cycle ' + cycle + ' did not restore the meeting toolbar');
    assert((await host.locator('#participantCount').textContent()).trim() === '2', 'smoothness cycle ' + cycle + ' lost a participant on the host');
    assert((await guest.locator('#participantCount').textContent()).trim() === '2', 'smoothness cycle ' + cycle + ' lost a participant on the guest');
  }
  console.log('MEET_UI_OK repeated media, share, private pause and resize stress cycles remain stable');

  await host.locator('#leaveBtn').click();`;

let source = await readFile(sourcePath, 'utf8');
for (const [label, before, after] of [
  ['waiting-room overlay assertion', waitingBefore, waitingAfter],
  ['professional authority and device controls', authorityBefore, authorityAfter],
  ['presentation toolbar replacement', presentationBefore, presentationAfter],
  ['presentation toolbar restoration', stopBefore, stopAfter],
  ['smooth repeated meeting lifecycle', smoothnessBefore, smoothnessAfter]
]) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) throw new Error(`Expected exactly one ${label} patch point, found ${occurrences}.`);
  source = source.replace(before, after);
}

await writeFile(runtimePath, source, 'utf8');

try {
  await import(`${pathToFileURL(runtimePath).href}?professional-meeting-contract=1`);
} finally {
  await unlink(runtimePath).catch(() => {});
}
