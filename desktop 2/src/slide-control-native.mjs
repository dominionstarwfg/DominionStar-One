import { app, ipcMain, systemPreferences } from 'electron';

const TRUSTED_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);
let enabled = false;
let lastCommandAt = 0;
let commandQueue = Promise.resolve();

function trustedMeetSender(event) {
  try {
    const url = new URL(String(event?.sender?.getURL?.() || ''));
    const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return url.protocol === 'https:' && TRUSTED_HOSTS.has(url.hostname.toLowerCase()) && route === '/meet';
  } catch {
    return false;
  }
}

function accessibilityGranted(prompt = false) {
  if (process.platform !== 'darwin') return true;
  try { return Boolean(systemPreferences.isTrustedAccessibilityClient(Boolean(prompt))); }
  catch { return false; }
}

ipcMain.handle('desktop:slide-control-permission', event => {
  if (!trustedMeetSender(event)) return { ok: false, reason: 'untrusted-route' };
  const ok = accessibilityGranted(true);
  return { ok, reason: ok ? '' : 'accessibility-required' };
});

ipcMain.on('desktop:slide-control-state', (event, state = {}) => {
  if (!trustedMeetSender(event)) return;
  enabled = Boolean(state?.active);
  if (!enabled) lastCommandAt = 0;
});

ipcMain.handle('desktop:slide-control-command', async (event, command = '') => {
  if (!trustedMeetSender(event) || !enabled) return false;
  const safe = String(command || '').toLowerCase();
  if (!['previous', 'next'].includes(safe)) return false;
  if (!accessibilityGranted(false)) return false;
  const now = Date.now();
  if (now - lastCommandAt < 90) return false;
  lastCommandAt = now;
  commandQueue = commandQueue.then(async () => {
    const native = await import('@nut-tree-fork/nut-js');
    await native.keyboard.type(safe === 'next' ? native.Key.Right : native.Key.Left);
    return true;
  }, async () => {
    const native = await import('@nut-tree-fork/nut-js');
    await native.keyboard.type(safe === 'next' ? native.Key.Right : native.Key.Left);
    return true;
  });
  try { return Boolean(await commandQueue); }
  catch { return false; }
});

app.on('before-quit', () => { enabled = false; });

export const slideControlNative = Object.freeze({
  version: '1.0.0',
  accessibilityGranted,
  isEnabled: () => enabled
});
