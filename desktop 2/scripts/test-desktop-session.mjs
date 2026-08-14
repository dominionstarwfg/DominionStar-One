import assert from 'node:assert/strict';
import { FRESH_NAVIGATION_OPTIONS, loadFreshPage, refreshHostedMeetingAssets } from '../src/desktop-session.mjs';

const calls = [];
const desktopSession = {
  clearCache: async () => calls.push(['clearCache']),
  clearStorageData: async options => calls.push(['clearStorageData', options])
};

await refreshHostedMeetingAssets(desktopSession, 'https://dominionstarld.com');
assert.deepEqual(calls, [
  ['clearCache'],
  ['clearStorageData', {
    origin: 'https://dominionstarld.com',
    storages: ['serviceworkers', 'cachestorage']
  }]
]);

const navigations = [];
const window = {
  isDestroyed: () => false,
  loadURL: (...args) => { navigations.push(args); return Promise.resolve(); }
};
await loadFreshPage(window, 'https://dominionstarld.com/meet-home/?desktop=1');
assert.deepEqual(navigations, [[
  'https://dominionstarld.com/meet-home/?desktop=1',
  FRESH_NAVIGATION_OPTIONS
]]);
assert.match(FRESH_NAVIGATION_OPTIONS.extraHeaders, /pragma: no-cache/i);
assert.match(FRESH_NAVIGATION_OPTIONS.extraHeaders, /cache-control: no-cache/i);

console.log('Desktop hosted-session cache tests passed.');
