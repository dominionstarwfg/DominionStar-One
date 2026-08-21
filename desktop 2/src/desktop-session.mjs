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

function sameOriginNavigationActive(window, target) {
  try {
    const current = new URL(String(window?.webContents?.getURL?.() || ''));
    return current.protocol === 'https:' && current.origin === target.origin;
  } catch {
    return false;
  }
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
      console.warn('DOMINIONSTAR_HOSTED_CLEANUP_WARNING', JSON.stringify({
        origin: target.origin,
        message: String(error?.message || error)
      }));
    } catch {}
  }

  try {
    return await window.loadURL(target.toString(), FRESH_NAVIGATION_OPTIONS);
  } catch (error) {
    // Chromium reports ERR_ABORTED when one trusted DominionStar navigation is
    // superseded by another trusted same-origin navigation (for example,
    // Meet Home handing a signed-out desktop client to the account chooser).
    // That is a valid transition, not an offline/network failure.
    if (String(error?.code || '') === 'ERR_ABORTED') {
      await new Promise(resolve => setTimeout(resolve, 25));
      if (sameOriginNavigationActive(window, target)) {
        try {
          console.info('DOMINIONSTAR_HOSTED_NAVIGATION_SUPERSEDED', JSON.stringify({
            requested: target.toString(),
            current: String(window.webContents.getURL?.() || '')
          }));
        } catch {}
        return true;
      }
    }

    // Preserve Electron's actual network/navigation failure in CI and support
    // logs. The caller still owns recovery/offline presentation.
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
