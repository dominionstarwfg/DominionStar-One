import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, 'browser-two-client-meet-acceptance.mjs');
const runtimePath = join(here, '.browser-two-client-meet-acceptance.runtime.mjs');

const before = `  await guest.locator('#meeting').waitFor({ state: 'visible', timeout: 10000 });
  await guest.locator('#waitingRoomGate').waitFor({ state: 'visible', timeout: 10000 });`;

const after = `  await guest.waitForFunction(() => {
    const meeting = document.getElementById('meeting');
    return Boolean(
      meeting &&
      !meeting.hidden &&
      meeting.classList.contains('waiting-room-active') &&
      meeting.getAttribute('aria-busy') === 'true'
    );
  }, null, { timeout: 10000 });
  await guest.locator('#waitingRoomGate').waitFor({ state: 'visible', timeout: 10000 });`;

const source = await readFile(sourcePath, 'utf8');
const occurrences = source.split(before).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected exactly one waiting-room harness assertion to update, found ${occurrences}.`);
}

const patched = source.replace(before, after);
await writeFile(runtimePath, patched, 'utf8');

try {
  await import(`${pathToFileURL(runtimePath).href}?waiting-room-overlay=1`);
} finally {
  await unlink(runtimePath).catch(() => {});
}
