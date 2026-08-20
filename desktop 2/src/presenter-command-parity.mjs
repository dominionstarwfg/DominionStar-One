import { app, BrowserWindow, ipcMain, screen } from 'electron';

let layoutMode = 0;
let displayListenersInstalled = false;

function presenterSender(event) {
  try {
    const url = new URL(String(event?.sender?.getURL?.() || ''));
    return url.protocol === 'file:' && /presenter-toolbar\.html$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function meetingWindow() {
  return BrowserWindow.getAllWindows().find(win => {
    try {
      if (win.isDestroyed()) return false;
      const url = new URL(String(win.webContents?.getURL?.() || ''));
      const route = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
      return url.protocol === 'https:' && route === '/meet';
    } catch {
      return false;
    }
  }) || null;
}

function participantDockWindow() {
  return BrowserWindow.getAllWindows().find(win => {
    try {
      const url = new URL(String(win.webContents?.getURL?.() || ''));
      return url.protocol === 'file:' && /presenter-dock\.html$/i.test(url.pathname);
    } catch {
      return false;
    }
  }) || null;
}

function showMeeting() {
  const win = meetingWindow();
  if (!win || win.isDestroyed()) return false;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents?.send?.('desktop:presenter-command', 'show-meeting');
  return true;
}

function layoutFor(mode, area) {
  const layouts = [
    {
      mode: 'stack',
      width: Math.round(Math.min(360, Math.max(300, area.width * 0.18))),
      height: Math.round(Math.min(720, Math.max(560, area.height * 0.74)))
    },
    {
      mode: 'speaker',
      width: Math.round(Math.min(440, Math.max(340, area.width * 0.22))),
      height: Math.round(Math.min(300, Math.max(220, area.height * 0.28)))
    },
    {
      mode: 'grid',
      width: Math.round(Math.min(620, Math.max(480, area.width * 0.31))),
      height: Math.round(Math.min(560, Math.max(400, area.height * 0.48)))
    }
  ];
  return layouts[Math.max(0, Math.min(layouts.length - 1, Number(mode) || 0))];
}

function applyLayout(mode = layoutMode, { animate = true } = {}) {
  if (!app.isReady()) return false;
  const dock = participantDockWindow();
  if (!dock || dock.isDestroyed()) return false;
  const display = screen.getDisplayMatching(dock.getBounds());
  const area = display.workArea;
  const next = layoutFor(mode, area);
  const current = dock.getBounds();
  const x = Math.max(area.x, Math.min(current.x, area.x + area.width - next.width));
  const y = Math.max(area.y, Math.min(current.y, area.y + area.height - next.height));
  dock.setBounds({ x, y, width: next.width, height: next.height }, animate);
  dock.webContents?.send?.('desktop:presenter-dock-layout', next.mode);
  return true;
}

function cycleLayout() {
  layoutMode = (layoutMode + 1) % 3;
  return applyLayout(layoutMode);
}

function reflowForDisplayChange() {
  if (!app.isReady()) return false;
  const dock = participantDockWindow();
  if (!dock || dock.isDestroyed() || !dock.isVisible()) return false;
  return applyLayout(layoutMode, { animate: false });
}

function installDisplayListeners() {
  if (displayListenersInstalled || !app.isReady()) return false;
  displayListenersInstalled = true;
  screen.on('display-metrics-changed', reflowForDisplayChange);
  screen.on('display-added', reflowForDisplayChange);
  screen.on('display-removed', reflowForDisplayChange);
  return true;
}

ipcMain.on('desktop:presenter-command', (event, command = '') => {
  if (!presenterSender(event)) return;
  const safe = String(command || '');
  if (safe === 'show-meeting') {
    showMeeting();
    return;
  }
  if (safe === 'layout') {
    cycleLayout();
    return;
  }
  if (safe === 'annotate') {
    meetingWindow()?.webContents?.send?.('desktop:presenter-command', 'annotate');
  }
});

if (app.isReady()) installDisplayListeners();
else app.whenReady().then(installDisplayListeners).catch(() => {});

export const presenterCommandParity = Object.freeze({
  showMeeting,
  cycleLayout,
  applyLayout,
  reflowForDisplayChange,
  installDisplayListeners,
  layoutMode: () => layoutMode
});
