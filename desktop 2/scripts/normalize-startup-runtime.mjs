import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainPath = path.join(root, 'src/main.mjs');
const rawMain = fs.readFileSync(mainPath, 'utf8');
const lineEnding = rawMain.includes('\r\n') ? '\r\n' : '\n';
let main = rawMain.replace(/\r\n/g, '\n');
const original = main;

const replacements = [
  [
    "let currentDesktopLayout;\n\nconst windowStatePath",
    "let currentDesktopLayout;\nconst HOSTED_STARTUP_TIMEOUT_MS = 12000;\nconst STARTUP_PROBE_PATH = String(process.env.DOMINIONSTAR_STARTUP_PROBE || '');\n\nfunction writeStartupProbe(stage) {\n  if (!STARTUP_PROBE_PATH) return;\n  const record = { stage, version: app.getVersion(), platform: process.platform, arch: process.arch, pid: process.pid, at: new Date().toISOString() };\n  try { fs.appendFileSync(STARTUP_PROBE_PATH, `${JSON.stringify(record)}\\n`); } catch {}\n}\n\nconst windowStatePath"
  ],
  [
    "    minWidth: 420,\n    minHeight: 300,\n    show: false,\n    frame: true,",
    "    minWidth: 420,\n    minHeight: 300,\n    show: true,\n    frame: true,"
  ],
  [
    "  mainWindow.once('ready-to-show', () => {if(saved?.maximized)mainWindow?.maximize();mainWindow?.show();publishDesktopLayout();});",
    "  mainWindow.once('ready-to-show', () => {if(saved?.maximized)mainWindow?.maximize();publishDesktopLayout();writeStartupProbe('window-ready');});"
  ],
  [
    "  if (initialUrl && isDominionStarUrl(initialUrl)) {\n    await loadFreshPage(mainWindow, initialUrl).catch(loadOffline);\n  } else {\n    await mainWindow.loadFile(path.join(__dirname, 'launcher.html'), {\n      query: { memberLogin: MEMBER_LOGIN_URL, meet: MEET_URL }\n    }).catch(loadOffline);\n  }\n}",
    "  writeStartupProbe('window-created');\n  await mainWindow.loadFile(path.join(__dirname, 'startup.html')).catch(loadOffline);\n  if (!mainWindow || mainWindow.isDestroyed()) return;\n  if (!mainWindow.isVisible()) mainWindow.show();\n  writeStartupProbe('local-shell-shown');\n\n  if (STARTUP_PROBE_PATH) {\n    await new Promise(resolve => setTimeout(resolve, 750));\n    writeStartupProbe('event-loop-responsive');\n    setTimeout(() => app.quit(), 25);\n    return;\n  }\n\n  if (initialUrl && isDominionStarUrl(initialUrl)) {\n    let timeout;\n    try {\n      await Promise.race([\n        loadFreshPage(mainWindow, initialUrl),\n        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('hosted-startup-timeout')), HOSTED_STARTUP_TIMEOUT_MS); })\n      ]);\n    } catch {\n      try { mainWindow.webContents.stop(); } catch {}\n      loadOffline();\n    } finally {\n      clearTimeout(timeout);\n    }\n  } else {\n    await mainWindow.loadFile(path.join(__dirname, 'launcher.html'), {\n      query: { memberLogin: MEMBER_LOGIN_URL, meet: MEET_URL }\n    }).catch(loadOffline);\n  }\n}"
  ],
  [
    "  await createWindow(deepLink ? resolveDeepLink(deepLink) : MEET_HOME_URL);\n  initializeDesktopUpdater",
    "  await createWindow(deepLink ? resolveDeepLink(deepLink) : MEET_HOME_URL);\n  if (STARTUP_PROBE_PATH) return;\n  initializeDesktopUpdater"
  ]
];

for (const [from, to] of replacements) {
  if (main.includes(from)) main = main.replace(from, to);
  if (!main.includes(to)) throw new Error(`Desktop startup normalization failed: ${to.slice(0, 120)}`);
}

if (main !== original) {
  fs.writeFileSync(mainPath, main.replace(/\n/g, lineEnding));
  console.log('Normalized DominionStar desktop startup runtime.');
} else {
  console.log('DominionStar desktop startup runtime already normalized.');
}
