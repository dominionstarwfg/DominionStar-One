const { execFileSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appOutDir = context.appOutDir;
  execFileSync('/usr/bin/xattr', ['-cr', appOutDir], { stdio: 'inherit' });

  const forbidden = execFileSync(
    '/usr/bin/xattr',
    ['-lr', appOutDir],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
  );

  if (/com\.apple\.(FinderInfo|ResourceFork)|com\.apple\.fileprovider\./.test(forbidden)) {
    throw new Error('Forbidden macOS extended attributes remain after packaging.');
  }

  console.log('DOMINIONSTAR_AFTER_PACK_XATTR_OK', appOutDir);
};
