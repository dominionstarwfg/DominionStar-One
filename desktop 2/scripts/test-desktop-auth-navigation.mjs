import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = fs.readFileSync(path.join(root, 'src/main.mjs'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'src/launcher.html'), 'utf8');

assert.ok(
  main.includes("const MEMBER_LOGIN_URL = `${APP_ORIGIN}/member-login/?desktop=1`;"),
  'Native account chooser must use the current Member Portal route'
);
assert.ok(
  launcher.includes('https://dominionstarld.com/member-login/?desktop=1'),
  'Desktop launcher must use the current Member Portal route'
);
assert.ok(
  main.includes("if (url.startsWith('file:') || isDominionStarUrl(url)) return;"),
  'Trusted DominionStar redirects must remain inside the persistent Electron session during sign-in'
);
assert.ok(
  !main.includes("if (isDesktopRoute(url) || url.startsWith('file:')) return;"),
  'Desktop must not externalize same-origin authentication redirects'
);
assert.ok(
  !main.includes('shell.openExternal(target.toString());\n        loadFreshPage(mainWindow,MEET_HOME_URL);'),
  'Successful member authentication must not be handed to a second browser session'
);

console.log('DominionStar desktop authentication-navigation regression test passed.');
