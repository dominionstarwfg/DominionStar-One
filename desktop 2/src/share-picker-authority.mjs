import { desktopCapturer, session } from 'electron';

const SOURCE_ENUMERATION_TIMEOUT_MS = 4500;
let sourceEnumerationInFlight = null;
let installed = false;

const timeoutResult = () => new Promise(resolve => {
  const timer = setTimeout(() => resolve([]), SOURCE_ENUMERATION_TIMEOUT_MS);
  timer.unref?.();
});

function installBoundedDesktopCapturer() {
  const originalGetSources = desktopCapturer.getSources.bind(desktopCapturer);
  desktopCapturer.getSources = (options = {}) => {
    if (!sourceEnumerationInFlight) {
      const nativeRequest = Promise.resolve()
        .then(() => originalGetSources(options))
        .then(value => Array.isArray(value) ? value : []);
      const tracked = nativeRequest.finally(() => {
        if (sourceEnumerationInFlight === tracked) sourceEnumerationInFlight = null;
      });
      sourceEnumerationInFlight = tracked;
    }
    return Promise.race([sourceEnumerationInFlight, timeoutResult()]);
  };
}

function installDominionStarSessionPicker() {
  const originalFromPartition = session.fromPartition.bind(session);
  session.fromPartition = (partition, options) => {
    const desktopSession = originalFromPartition(partition, options);
    if (desktopSession.__dominionStarCustomSharePickerBound) return desktopSession;
    const originalSetDisplayMediaRequestHandler = desktopSession.setDisplayMediaRequestHandler.bind(desktopSession);
    Object.defineProperty(desktopSession, '__dominionStarCustomSharePickerBound', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
    desktopSession.setDisplayMediaRequestHandler = (handler, handlerOptions = {}) =>
      originalSetDisplayMediaRequestHandler(handler, { ...handlerOptions, useSystemPicker: false });
    return desktopSession;
  };
}

export function installSharePickerAuthority() {
  if (installed) return true;
  installBoundedDesktopCapturer();
  installDominionStarSessionPicker();
  installed = true;
  return true;
}

export function sharePickerAuthoritySnapshot() {
  return Object.freeze({
    installed,
    visiblePicker: 'dominionstar-custom-picker',
    nativeSystemPicker: false,
    enumerationSingleFlight: true,
    enumerationTimeoutMs: SOURCE_ENUMERATION_TIMEOUT_MS
  });
}

installSharePickerAuthority();
