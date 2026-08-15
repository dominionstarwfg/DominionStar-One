import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainPath = path.join(root, 'src/main.mjs');
let main = fs.readFileSync(mainPath, 'utf8');
const original = main;

const replacements = [
  [
    "const MEMBER_LOGIN_URL = `${APP_ORIGIN}/meet-login/?desktop=1&mode=member`;",
    "const MEMBER_LOGIN_URL = `${APP_ORIGIN}/member-login/?desktop=1`;"
  ],
  [
    "if (isDesktopRoute(url) || url.startsWith('file:')) return;",
    "if (url.startsWith('file:') || isDominionStarUrl(url)) return;"
  ],
  [
    "if (isDesktopRoute(url)) {\n      loadFreshPage(mainWindow,url);\n    } else if (/^https?:/.test(url)) {",
    "if (isDominionStarUrl(url)) {\n      loadFreshPage(mainWindow,url);\n    } else if (/^https?:/.test(url)) {"
  ],
  [
    "        shell.openExternal(target.toString());\n        loadFreshPage(mainWindow,MEET_HOME_URL);",
    "        loadFreshPage(mainWindow,MEET_HOME_URL);"
  ]
];

for (const [from, to] of replacements) {
  if (main.includes(from)) main = main.replace(from, to);
  if (!main.includes(to)) throw new Error(`Desktop auth-navigation normalization failed: ${to}`);
}

if (main !== original) {
  fs.writeFileSync(mainPath, main);
  console.log('Normalized DominionStar desktop authentication/navigation source.');
} else {
  console.log('DominionStar desktop authentication/navigation source already normalized.');
}
