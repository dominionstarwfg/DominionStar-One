import { app, session } from 'electron';
import { supportsNativeMacPicker } from './macos-native-capture-authority.mjs';

const DESKTOP_PARTITION = 'persist:dominionstar-meet';

function installMacSystemPickerSession() {
  if (!supportsNativeMacPicker()) return false;
  const desktopSession = session.fromPartition(DESKTOP_PARTITION);

  // Electron documents that when useSystemPicker is true and the native picker
  // is available on macOS 15+, this callback is bypassed and macOS owns source
  // selection. Keep a defensive cancellation callback for any unsupported edge
  // case instead of falling back into the custom enumerator that froze physical
  // Mac QA.
  desktopSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({});
  }, { useSystemPicker: true });
  return true;
}

app.whenReady().then(() => setImmediate(installMacSystemPickerSession)).catch(() => {});

export { installMacSystemPickerSession };
export const DominionMacSystemPickerSession = Object.freeze({
  partition: DESKTOP_PARTITION,
  supported: supportsNativeMacPicker
});
