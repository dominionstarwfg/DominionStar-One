const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function plistBuddy(command, plistPath) {
  return execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plistPath], {
    encoding: 'utf8'
  }).trim();
}

function setOrAddBoolean(plistPath, keyPath, value) {
  try {
    plistBuddy(`Set ${keyPath} ${value ? 'true' : 'false'}`, plistPath);
  } catch {
    plistBuddy(`Add ${keyPath} bool ${value ? 'true' : 'false'}`, plistPath);
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const product = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${product}.app`);
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(plistPath)) {
    throw new Error(`DominionStar macOS Info.plist missing after pack: ${plistPath}`);
  }

  // Electron's stock macOS Info.plist enables arbitrary network loads. The
  // DominionStar desktop runtime uses HTTPS and only needs local networking for
  // local-device scenarios, so harden the final staged app before artifacts are
  // created. Doing this in afterPack operates on the actual app bundle rather
  // than relying on a config merge to override Electron's base plist.
  setOrAddBoolean(plistPath, ':NSAppTransportSecurity:NSAllowsArbitraryLoads', false);
  setOrAddBoolean(plistPath, ':NSAppTransportSecurity:NSAllowsLocalNetworking', true);

  const arbitrary = plistBuddy('Print :NSAppTransportSecurity:NSAllowsArbitraryLoads', plistPath);
  const local = plistBuddy('Print :NSAppTransportSecurity:NSAllowsLocalNetworking', plistPath);
  if (arbitrary !== 'false') {
    throw new Error(`DominionStar macOS ATS hardening failed: NSAllowsArbitraryLoads=${arbitrary}`);
  }
  if (local !== 'true') {
    throw new Error(`DominionStar macOS local-network entitlement failed: NSAllowsLocalNetworking=${local}`);
  }

  const retiredDock = path.join(
    appPath,
    'Contents',
    'Resources',
    'desktop-runtime',
    'assets',
    'js',
    'meet',
    'dock-polish-2030.js'
  );
  if (fs.existsSync(retiredDock)) {
    throw new Error(`Retired dock authority was packaged: ${retiredDock}`);
  }

  console.log(
    `DOMINIONSTAR_MAC_AFTER_PACK_HARDENED arch=${context.arch} arbitraryLoads=${arbitrary} localNetworking=${local} retiredDock=absent`
  );
};
