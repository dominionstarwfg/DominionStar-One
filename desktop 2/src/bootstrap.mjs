import { app, BrowserWindow, Menu, MenuItem } from 'electron';

let quitting = false;

function destroyDesktopWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try { win.destroy(); } catch {}
    }
  }
}

function ensureMacQuitCommand() {
  if (process.platform !== 'darwin') return;
  const menu = Menu.getApplicationMenu();
  const appMenu = menu?.items?.[0]?.submenu;
  if (!appMenu) return;
  if (appMenu.items.some((item) => item.role === 'quit')) return;

  appMenu.append(new MenuItem({ type: 'separator' }));
  appMenu.append(new MenuItem({
    role: 'quit',
    label: `Quit ${app.name || 'DominionStar Meet'}`,
    accelerator: 'Command+Q'
  }));
}

app.on('before-quit', () => {
  if (quitting) return;
  quitting = true;
  destroyDesktopWindows();
});

await import('./main-v2.mjs');
await import('./presenter-dock.mjs');
await import('./share-lifecycle.mjs');
await import('./remote-control-dialog.mjs');
await import('./screen-permission-lifecycle.mjs');

app.whenReady().then(() => {
  // main-v2 installs the production menu during its ready path. Add the native
  // macOS Quit command after that menu exists so closing a window and quitting
  // the application remain two distinct, deterministic actions.
  setImmediate(ensureMacQuitCommand);
}).catch(() => {});
