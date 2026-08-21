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

let failedCleanupNavigation = null;
const cleanupFailureSession = {
  webRequest: { onBeforeRequest() {} },
  clearCache: async () => { throw new Error('simulated-cache-cleanup-failure'); },
  clearStorageData: async () => {}
};
const cleanupFailureWindow = {
  isDestroyed: () => false,
  webContents: { session: cleanupFailureSession },
  loadURL: (...args) => { failedCleanupNavigation = args; return Promise.resolve('loaded'); }
};
const originalWarn = console.warn;
console.warn = () => {};
try {
  const result = await loadFreshPage(cleanupFailureWindow, 'https://dominionstarld.com/meet/?desktop=1');
  assert.equal(result, 'loaded');
} finally {
  console.warn = originalWarn;
}
assert.deepEqual(failedCleanupNavigation, [
  'https://dominionstarld.com/meet/?desktop=1',
  FRESH_NAVIGATION_OPTIONS
], 'A cache cleanup failure must never prevent the requested Meet URL from loading');

const redirectSession = {
  webRequest: { onBeforeRequest() {} },
  clearCache: async () => {},
  clearStorageData: async () => {}
};
let redirectCurrentUrl = 'https://dominionstarld.com/member-login/?desktop=1';
const redirectWindow = {
  isDestroyed: () => false,
  webContents: {
    session: redirectSession,
    getURL: () => redirectCurrentUrl
  },
  loadURL: async () => {
    const error = new Error("ERR_ABORTED (-3) loading 'https://dominionstarld.com/member-login/?desktop=1'");
    error.code = 'ERR_ABORTED';
    error.errno = -3;
    throw error;
  }
};
const originalInfo = console.info;
console.info = () => {};
try {
  const result = await loadFreshPage(redirectWindow, 'https://dominionstarld.com/meet-home/?desktop=1');
  assert.equal(result, true, 'A trusted same-origin sign-in redirect must be treated as a valid superseding navigation');
} finally {
  console.info = originalInfo;
}

redirectCurrentUrl = 'https://example.com/';
let foreignAbortRejected = false;
const originalError = console.error;
console.error = () => {};
try {
  await loadFreshPage(redirectWindow, 'https://dominionstarld.com/meet-home/?desktop=1');
} catch (error) {
  foreignAbortRejected = error?.code === 'ERR_ABORTED';
} finally {
  console.error = originalError;
}
assert.equal(foreignAbortRejected, true, 'ERR_ABORTED must remain a failure when navigation leaves the trusted origin');

console.log('Desktop hosted-runtime authority tests passed.');
