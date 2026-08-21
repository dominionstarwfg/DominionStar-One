export const FRESH_NAVIGATION_OPTIONS = Object.freeze({
  extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n'
});

const preparedSessions = new WeakSet();
const guardianFilteredSessions = new WeakSet();

function installNativeGuardianAuthority(desktopSession) {
  if (!desktopSession || guardianFilteredSessions.has(desktopSession)) return;
  guardianFilteredSessions.add(desktopSession);

  // Desktop Guardian is packaged with the native release. The web site may
  // continue to ship Guardian observers for browsers, but no mutable or stale
  // hosted guardian script may decide whether a valid native desktop client
  // can open Meet.
  desktopSession.webRequest.onBeforeRequest({
    urls: [
      'https://dominionstarld.com/assets/js/runtime/guardian-*.js*',
      'https://www.dominionstarld.com/assets/js/runtime/guardian-*.js*'
    ]
  }, (_details, callback) => callback({ cancel: true }));
}

// Refresh only web-delivery caches. Authentication cookies, local/account
// storage, IndexedDB and desktop preferences intentionally survive. This is a
// best-effort maintenance step: clearing cache must never be allowed to block
// a meeting navigation. The actual load also carries no-cache headers.
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
  try {
    await refreshHostedMeetingAssets(window.webContents.session, target.origin);
  } catch (error) {
    // Cache/service-worker cleanup is not application availability. A timeout
    // or platform-specific cleanup error must not strand the user on the
    // offline fallback without ever attempting the requested Meet URL.
    try {
      console.warn('DominionStar hosted-runtime cleanup failed; continuing with no-cache navigation.', String(error?.message || error));
    } catch {}
  }
  return window.loadURL(target.toString(), FRESH_NAVIGATION_OPTIONS);
}
