(() => {
  try {
    const params = new URLSearchParams(String(window.location.hash || '').replace(/^#/,''));
    if (!params.get('access_token') || !params.get('refresh_token')) return;
    window.location.replace(`dominionstar://auth/callback${window.location.hash}`);
  } catch {}
})();
