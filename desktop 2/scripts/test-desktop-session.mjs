import assert from 'node:assert/strict';
import { FRESH_NAVIGATION_OPTIONS, loadFreshPage, refreshHostedMeetingAssets } from '../src/desktop-session.mjs';

const calls = [];
let guardianFilter = null;
const desktopSession = {
  webRequest: {
    onBeforeRequest(filter, listener) {
      guardianFilter = filter;
      assert.equal(typeof listener, 'function');
    }
  },
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
assert.ok(guardianFilter?.urls?.some(url => url.includes('guardian-*.js*')), 'All mutable hosted guardian scripts must be filtered for native desktop');

const navigations = [];
const window = {
  isDestroyed: () => false,
  webContents: { session: desktopSession },
  loadURL: (...args) => { navigations.push(args); return Promise.resolve(); }
};
await loadFreshPage(window, 'https://dominionstarld.com/meet-home/?desktop=1');
assert.deepEqual(navigations, [[
  'https://dominionstarld.com/meet-home/?desktop=1',
  FRESH_NAVIGATION_OPTIONS
]]);
assert.equal(calls.length, 2, 'Hosted runtime cleanup must run once per persistent Electron session');
assert.match(FRESH_NAVIGATION_OPTIONS.extraHeaders, /pragma: no-cache/i);
assert.match(FRESH_NAVIGATION_OPTIONS.extraHeaders, /cache-control: no-cache/i);

console.log('Desktop hosted-runtime authority tests passed.');
