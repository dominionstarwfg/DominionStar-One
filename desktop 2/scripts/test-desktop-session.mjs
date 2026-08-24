import assert from 'node:assert/strict';
import { FRESH_NAVIGATION_OPTIONS, loadFreshPage, refreshHostedMeetingAssets, normalizeDesktopHostedUrl } from '../src/desktop-session.mjs';

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
  ['clearStorageData', { origin:'https://dominionstarld.com', storages:['serviceworkers','cachestorage'] }]
]);
assert.ok(guardianFilter?.urls?.some(url => url.includes('guardian-*.js*')), 'All mutable hosted guardian scripts must be filtered for native desktop');

const navigations = [];
const window = {
  isDestroyed: () => false,
  webContents: { session: desktopSession },
  loadURL: (...args) => { navigations.push(args); return Promise.resolve(); }
};
await loadFreshPage(window, 'https://dominionstarld.com/meet-home/?desktop=1');
assert.deepEqual(navigations, [['https://dominionstarld.com/meet-home/?desktop=1', FRESH_NAVIGATION_OPTIONS]]);
assert.equal(calls.length, 2, 'Hosted runtime cleanup must run once per persistent Electron session');
assert.match(FRESH_NAVIGATION_OPTIONS.extraHeaders, /pragma: no-cache/i);
assert.match(FRESH_NAVIGATION_OPTIONS.extraHeaders, /cache-control: no-cache/i);

const preview = normalizeDesktopHostedUrl('https://deploy-preview-83--melodious-buttercream-a99450.netlify.app/meet-home/?desktop=1');
assert.equal(preview.searchParams.get('ntl-drawer-state'), 'hidden', 'Every Netlify QA preview URL must explicitly hide review chrome before load');
const production = normalizeDesktopHostedUrl('https://dominionstarld.com/meet-home/?desktop=1');
assert.equal(production.searchParams.has('ntl-drawer-state'), false, 'Production URLs must not receive QA-only Netlify parameters');

const previewLoads=[];
const previewSession={webRequest:{onBeforeRequest(){}},clearCache:async()=>{},clearStorageData:async()=>{}};
const previewWindow={isDestroyed:()=>false,webContents:{session:previewSession},loadURL:(...args)=>{previewLoads.push(args);return Promise.resolve();}};
await loadFreshPage(previewWindow,'https://deploy-preview-83--melodious-buttercream-a99450.netlify.app/meet/?desktop=1');
assert.equal(new URL(previewLoads[0][0]).searchParams.get('ntl-drawer-state'),'hidden','loadFreshPage must normalize the actual URL sent to Electron');

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
} finally { console.warn = originalWarn; }
assert.deepEqual(failedCleanupNavigation, ['https://dominionstarld.com/meet/?desktop=1',FRESH_NAVIGATION_OPTIONS], 'A cache cleanup failure must never prevent the requested Meet URL from loading');

const redirectSession = { webRequest:{onBeforeRequest(){}}, clearCache:async()=>{}, clearStorageData:async()=>{} };
const redirectWindow = {
  isDestroyed: () => false,
  webContents: { session: redirectSession, getURL: () => '' },
  loadURL: async () => {
    const error = new Error("ERR_ABORTED (-3) loading 'https://dominionstarld.com/member-login/?desktop=1'");
    error.code = 'ERR_ABORTED'; error.errno = -3; throw error;
  }
};
const originalInfo = console.info;
console.info = () => {};
try {
  const result = await loadFreshPage(redirectWindow, 'https://dominionstarld.com/meet-home/?desktop=1');
  assert.equal(result, true, 'A superseding Electron auth/account redirect must never be converted into an offline failure, even before getURL updates');
} finally { console.info = originalInfo; }

let realFailureRejected = false;
const realFailureWindow = {
  isDestroyed: () => false,
  webContents: { session: redirectSession, getURL: () => '' },
  loadURL: async () => { const error=new Error('ERR_NAME_NOT_RESOLVED');error.code='ERR_NAME_NOT_RESOLVED';error.errno=-105;throw error; }
};
const originalError = console.error;
console.error = () => {};
try { await loadFreshPage(realFailureWindow, 'https://dominionstarld.com/meet-home/?desktop=1'); }
catch (error) { realFailureRejected = error?.code === 'ERR_NAME_NOT_RESOLVED'; }
finally { console.error = originalError; }
assert.equal(realFailureRejected, true, 'Real network failures must still propagate to the caller');

console.log('Desktop hosted-runtime authority tests passed.');
