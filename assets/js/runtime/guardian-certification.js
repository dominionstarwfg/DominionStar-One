(() => {
  'use strict';

  // Production certification belongs to the signed desktop release pipeline,
  // not to a mutable hosted script. Guardian may observe and report runtime
  // health, but it must never lock a valid installed DominionStar Meet client
  // behind an update-required screen.
  const desktop = window.dominionDesktop;
  const detail = Object.freeze({
    mode: desktop?.isDesktop ? 'native-authoritative' : 'observe-only',
    isDesktop: Boolean(desktop?.isDesktop),
    version: String(desktop?.appVersion || desktop?.version || ''),
    bridgeVersion: Number(desktop?.bridgeVersion || 0)
  });

  window.DominionGuardianCertification = Object.freeze({
    ...detail,
    blocking: false,
    certifiedBy: desktop?.isDesktop ? 'native-release' : 'web-runtime'
  });

  try {
    window.dispatchEvent(new CustomEvent('dominionstar:guardian-certification', { detail }));
  } catch (_) {}
})();
