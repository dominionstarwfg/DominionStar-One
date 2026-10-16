// Static branch guard only. This does NOT prove physical visual acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../ui/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const html=read('index.html');
const fallback=read('profile-photo-fallback.js');
const participant=read('zoom-participants-reference-2.0.41.js');
const loaded=(html.match(/<script src="\.\/profile-photo-fallback\.js"><\/script>/g)||[]).length;
assert.equal(loaded,1,'Load identity fallback exactly once');
assert.ok(html.indexOf('./profile-photo-fallback.js')<html.indexOf('./app.js'),'Load identity fallback before live meeting app');
assert.match(fallback,/setTilePhoto\(tile\.querySelector\('\.remote-peer-fallback'\),person\.avatarUrl,person\.displayName\)/,
  'Remote fallback must show participant name, not initials');
assert.match(fallback,/const localDock=q\('#localVideoDockTile \.remote-peer-fallback'\);if\(localDock\)setTilePhoto\(localDock,avatarUrl,name/,
  'Local fallback must use full display name');
assert.match(participant,/\.person-copy strong\{[^}]*flex-direction:column!important/,
  'Roster name and role must occupy separate lines');
assert.match(participant,/\.participant-name-text\{[^}]*width:100%!important/,
  'Participant name should occupy available row width');
assert.match(participant,/\.participant-you\[hidden\]\{display:none!important\}/,
  'Non-host role label must remain hidden when not needed');
assert.match(participant,/position:absolute!important;width:318px!important/,
  'Preserve existing approved participant panel width');
assert.match(participant,/height:390px!important/,
  'Preserve existing approved participant panel height');
assert.match(participant,/grid-template-columns:30px minmax\(0,1fr\) auto auto!important/,
  'Preserve approved row/media layout');
console.log('PASS identity fallback registration, full-name display contract, original panel geometry');
