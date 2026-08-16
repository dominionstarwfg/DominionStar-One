export const FRESH_NAVIGATION_OPTIONS = Object.freeze({
  extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n'
});

const preparedSessions = new WeakSet();
const guardianFilteredSessions = new WeakSet();

function installNativeGuardianAuthority(desktopSession) {
  if (!desktopSession || guardianFilteredSessions.has(desktopSession)) return;
  guardianFilteredSessions.add(desktopSession);

  // Desktop Guardian is packaged with the signed/native release. The web site
  // may continue to ship Guardian observers for browsers, but no mutable or
  // stale hosted guardian script is allowed to decide whether a valid native
  // desktop client can open Meet.
  desktopSession.webRequest.onBeforeRequest({
    urls: [
      'https://dominionstarld.com/assets/js/runtime/guardian-*.js*',
      'https://www.dominionstarld.com/assets/js/runtime/guardian-*.js*'
    ]
  }, (_details, callback) => callback({ cancel: true }));
}

// Refresh only web-delivery caches. Authentication cookies, local/account
// storage, IndexedDB and desktop preferences intentionally survive. This runs
// after the native startup shell is already visible, so a slow cache cleanup
// can never make the desktop application look as if it failed to open.
export async function refreshHostedMeetingAssets(desktopSession, origin) {
  if (!desktopSession) throw new TypeError('A desktop session is required');
  installNativeGuardianAuthority(desktopSession);
  if (preparedSessions.has(desktopSession)) return;

  await Promise.race([
    (async () => {
      await desktopSession.clearCache();
      await desktopSession.clearStorageData({
        origin,
        storages: ['serviceworkers', 'cachestorage']
      });
    })(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('hosted-runtime-refresh-timeout')), 4000);
    })
  ]);

  preparedSessions.add(desktopSession);
}

export async function loadFreshPage(window, url) {
  if (!window || window.isDestroyed()) return undefined;
  const target = new URL(url);
  await refreshHostedMeetingAssets(window.webContents.session, target.origin);
  return window.loadURL(target.toString(), FRESH_NAVIGATION_OPTIONS);
}
