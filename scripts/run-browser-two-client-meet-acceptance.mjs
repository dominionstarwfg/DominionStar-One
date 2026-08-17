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
  assert(!/(^|\\n)Waiting Room($|\\n)/.test(cohostParticipantToolsText), 'co-host participant menu exposed Waiting Room enable/disable authority');
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

let source = await readFile(sourcePath, 'utf8');
for (const [label, before, after] of [
  ['waiting-room overlay assertion', waitingBefore, waitingAfter],
  ['professional authority and device controls', authorityBefore, authorityAfter],
  ['presentation toolbar replacement', presentationBefore, presentationAfter],
  ['presentation toolbar restoration', stopBefore, stopAfter]
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
