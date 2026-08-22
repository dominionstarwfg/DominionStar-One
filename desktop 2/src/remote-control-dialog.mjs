import { BrowserWindow, dialog, ipcMain } from 'electron';

const TRUSTED_HOSTS = new Set(['dominionstarld.com', 'www.dominionstarld.com']);

function isTrustedMeetingRenderer(event) {
  try {
    const url = new URL(String(event?.sender?.getURL?.() || ''));
    const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return url.protocol === 'https:' && TRUSTED_HOSTS.has(url.hostname.toLowerCase()) && route === '/meet';
  } catch {
    return false;
  }
}

function parentWindow(event) {
  return BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

ipcMain.handle('desktop:remote-control-prompt', async (event, payload = {}) => {
  if (!isTrustedMeetingRenderer(event)) return { accepted: false, reason: 'untrusted-route' };
  const requester = String(payload.displayName || 'A meeting participant').trim().slice(0, 80) || 'A meeting participant';
  const result = await dialog.showMessageBox(parentWindow(event), {
    type: 'question',
    title: 'Remote Control Request',
    message: `${requester} is requesting control of your shared screen.`,
    detail: 'If you approve, they can move the pointer, click, scroll, and type until you revoke control or stop sharing. Approve only people you know and trust.',
    buttons: ['Deny', 'Approve'],
    defaultId: 1,
    cancelId: 0,
    noLink: true
  });
  return { accepted: result.response === 1 };
});

ipcMain.handle('desktop:remote-control-error', async (event, message = '') => {
  if (!isTrustedMeetingRenderer(event)) return false;
  await dialog.showMessageBox(parentWindow(event), {
    type: 'warning',
    title: 'Remote Control Unavailable',
    message: 'DominionStar Meet could not enable remote control.',
    detail: String(message || 'Check macOS Accessibility permission and try again.').slice(0, 500),
    buttons: ['OK'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  return true;
});
