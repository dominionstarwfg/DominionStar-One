import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, 'browser-two-client-meet-acceptance.mjs');
const runtimePath = join(here, '.browser-meet-smoothness-acceptance.runtime.mjs');

const marker = `  console.log('MEET_UI_OK desktop resize keeps meeting fixed and participant dock inside the viewport');

  await host.locator('#leaveBtn').click();`;

const stress = `  console.log('MEET_UI_OK desktop resize keeps meeting fixed and participant dock inside the viewport');

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
    const viewerTrackBeforePause = await guest.evaluate(() => document.getElementById('stageVideo')?.srcObject?.getVideoTracks?.()[0]?.id || '');
    assert(viewerTrackBeforePause, 'smoothness cycle ' + cycle + ' did not produce a viewer presentation track');
    assert(await host.locator('#shareStatusBar').isVisible(), 'smoothness cycle ' + cycle + ' did not expose the presenter toolbar');

    await host.locator('#pauseShareBtn').click();
    await host.waitForFunction(() => document.getElementById('pauseShareBtn')?.textContent === 'Resume Share', null, { timeout: 5000 });
    const pausedViewer = await guest.evaluate(() => {
      const video = document.getElementById('stageVideo');
      const track = video?.srcObject?.getVideoTracks?.()[0];
      return {
        id: track?.id || '',
        readyState: track?.readyState || '',
        status: document.getElementById('shareStatusText')?.textContent?.trim() || ''
      };
    });
    assert(pausedViewer.id === viewerTrackBeforePause && pausedViewer.readyState === 'live',
      'smoothness cycle ' + cycle + ' pause removed the frozen viewer presentation');
    assert(pausedViewer.status === 'Preview Host is sharing',
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
  console.log('DOMINIONSTAR_MEET_SMOOTHNESS_STRESS_OK');

  await host.locator('#leaveBtn').click();`;

let source = await readFile(sourcePath, 'utf8');
const occurrences = source.split(marker).length - 1;
if (occurrences !== 1) throw new Error(`Expected exactly one smoothness injection point, found ${occurrences}.`);
source = source.replace(marker, stress);
await writeFile(runtimePath, source, 'utf8');

try {
  await import(`${pathToFileURL(runtimePath).href}?smoothness-stress=1`);
} finally {
  await unlink(runtimePath).catch(() => {});
}
