(() => {
  'use strict';

  try {
    const rawHash = String(window.location.hash || '');
    const params = new URLSearchParams(rawHash.replace(/^#/,''));
    const accessToken = params.get('access_token') || '';
    const refreshToken = params.get('refresh_token') || '';
    const error = params.get('error') || params.get('error_code') || '';
    const errorDescription = params.get('error_description') || '';

    if (!accessToken && !refreshToken && !error) return;

    const callback = `dominionstar://auth/callback${rawHash}`;

    // Never leave OAuth credentials visible in the browser chrome while the
    // external-protocol handoff is being attempted. Keep the original fragment
    // only in memory for the one-time DominionStar deep-link navigation.
    try {
      history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
    } catch {}

    const renderReturnSurface = () => {
      const existing = document.getElementById('dominionstarDesktopOAuthReturn');
      if (existing) return existing;

      const shell = document.createElement('div');
      shell.id = 'dominionstarDesktopOAuthReturn';
      shell.setAttribute('role','status');
      shell.setAttribute('aria-live','polite');
      shell.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:28px;background:#070b12;color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

      const panel = document.createElement('div');
      panel.style.cssText = 'width:min(520px,94vw);padding:34px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#111824;box-shadow:0 26px 90px rgba(0,0,0,.55);text-align:center;';

      const title = document.createElement('h1');
      title.textContent = error ? 'Google sign-in could not complete' : 'Returning to DominionStar Meet';
      title.style.cssText = 'margin:0 0 10px;font-size:25px;line-height:1.2;';

      const copy = document.createElement('p');
      copy.textContent = error
        ? (errorDescription || 'The authentication provider returned an error. Return to DominionStar Meet and try again.')
        : 'Your Google sign-in is complete. Open DominionStar Meet to continue.';
      copy.style.cssText = 'margin:0 0 22px;color:#b9c3d1;line-height:1.55;';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = error ? 'Return to DominionStar Meet' : 'Open DominionStar Meet';
      button.style.cssText = 'min-height:46px;padding:0 20px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-weight:800;font-size:15px;cursor:pointer;';
      button.addEventListener('click', () => {
        window.location.href = callback;
      });

      panel.append(title, copy, button);
      shell.append(panel);
      document.body.innerHTML = '';
      document.body.append(shell);
      return shell;
    };

    const surface = renderReturnSurface();

    // Try the seamless desktop handoff immediately. Some browsers require a
    // user gesture for an external custom scheme; the visible button above is
    // the deterministic fallback instead of abandoning the user on the site.
    setTimeout(() => {
      try { window.location.href = callback; }
      catch {
        surface?.setAttribute('data-auto-return','failed');
      }
    }, 0);
  } catch {}
})();
