export const FRESH_NAVIGATION_OPTIONS = Object.freeze({
  extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n'
});

const preparedSessions = new WeakSet();
const guardianFilteredSessions = new WeakSet();
const NETLIFY_PREVIEW_HOST = /(?:^|\.)netlify\.app$/i;

export function normalizeDesktopHostedUrl(value) {
  const target = new URL(String(value || ''));
  // Netlify officially supports ntl-drawer-state=hidden for automated/embedded
  // Deploy Preview clients. DominionStar Meet is a desktop application, not a
  // review surface, so every preview navigation is normalized before render.
  if (NETLIFY_PREVIEW_HOST.test(target.hostname)) {
    target.searchParams.set('ntl-drawer-state', 'hidden');
  }
  return target;
}

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
  const target = normalizeDesktopHostedUrl(url);
  try {
    await refreshHostedMeetingAssets(window.webContents.session, target.origin);
  } catch (error) {
    // Cache/service-worker cleanup is maintenance, not availability. A cleanup
    // timeout or platform-specific cache error must never block the real Meet
    // navigation.
    try {
      console.warn('DOMINIONSTAR_HOSTED_CLEANUP_WARNING', JSON.stringify({
        origin: target.origin,
        message: String(error?.message || error)
      }));
    } catch {}
  }

  try {
    return await window.loadURL(target.toString(), FRESH_NAVIGATION_OPTIONS);
  } catch (error) {
    // Chromium/Electron uses ERR_ABORTED (-3) when the requested page is
    // superseded by a redirect or another main-frame navigation. DominionStar
    // already enforces its navigation allow-list in the BrowserWindow, so this
    // condition must not be translated into the offline screen. On real Macs
    // the auth/account handoff can take longer than CI, leaving getURL() blank
    // for a short period even though the trusted redirect is proceeding.
    if (String(error?.code || '') === 'ERR_ABORTED' || Number(error?.errno) === -3) {
      try {
        console.info('DOMINIONSTAR_HOSTED_NAVIGATION_SUPERSEDED', JSON.stringify({
          requested: target.toString(),
          current: String(window.webContents?.getURL?.() || '')
        }));
      } catch {}
      return true;
    }

    try {
      console.error('DOMINIONSTAR_HOSTED_NAVIGATION_FAILED', JSON.stringify({
        url: target.toString(),
        code: String(error?.code || ''),
        errno: Number(error?.errno || 0),
        message: String(error?.message || error)
      }));
    } catch {}
    throw error;
  }
}
