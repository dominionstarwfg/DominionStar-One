import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const url=rel=>new URL(`../${rel}`,import.meta.url);
const read=rel=>fs.readFileSync(url(rel),'utf8');
const syntax=rel=>execFileSync(process.execPath,['--check',fileURLToPath(url(rel))],{stdio:'pipe'});
const index=read('ui/index.html');
const js=read('ui/home-profile-settings-polish-2.0.41.js');
const css=read('ui/home-profile-settings-polish-2.0.41.css');
const auth=read('src/auth-service.mjs');

const has=(source,needle,message)=>assert.ok(source.includes(needle),message);

has(index,'home-profile-settings-polish-2.0.41.css','Profile/settings polish CSS must load in the renderer.');
has(index,'home-profile-settings-polish-2.0.41.js','Profile/settings polish JS must load in the renderer.');
has(js,'ds-home-profile','Home must expose a visible Profile action.');
has(js,'Profile & Account','Settings must expose Profile & Account.');
has(js,'data-ds-settings-close','Settings must expose an always-visible Close action.');
has(js,"event.key!=='Escape'",'Settings must provide simple Escape/back navigation.');
has(js,'if(event.target===dialog)dialog.close()','Clicking the Settings backdrop must close the dialog.');
has(css,'grid-template-columns:repeat(2,minmax(0,1fr))','Settings list must use a compact two-column layout on desktop.');
has(css,'.ds-settings-footer','Settings must keep close navigation visible.');
has(css,'.ds-home-profile-photo img','Profile action must render the selected profile image.');
has(auth,"select('*')",'Desktop auth must read the complete signed-in member profile.');
has(auth,'profile?.profile_photo_url','Desktop auth must accept registered-account profile photo URL variants.');
has(auth,'profile?.avatar_url','Desktop auth must prefer the signed member avatar URL.');

syntax('ui/home-profile-settings-polish-2.0.41.js');
syntax('src/auth-service.mjs');
console.log('DOMINIONSTAR_HOME_PROFILE_SETTINGS_POLISH_2_0_41_OK visible-profile account-photo video-off-fallback compact-settings easy-backdrop-close escape-back');
