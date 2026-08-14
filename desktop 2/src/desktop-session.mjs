export const FRESH_NAVIGATION_OPTIONS = Object.freeze({
  extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n'
});

// Refresh only web-delivery caches. Authentication cookies, account storage,
// IndexedDB, and desktop preferences must survive an application update.
export async function refreshHostedMeetingAssets(desktopSession, origin) {
  if (!desktopSession) throw new TypeError('A desktop session is required');
  await desktopSession.clearCache();
  await desktopSession.clearStorageData({
    origin,
    storages: ['serviceworkers', 'cachestorage']
  });
}

export function loadFreshPage(window, url) {
  if (!window || window.isDestroyed()) return undefined;
  return window.loadURL(url, FRESH_NAVIGATION_OPTIONS);
}
