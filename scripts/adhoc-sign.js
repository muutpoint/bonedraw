// electron-builder afterPack hook (macOS): sign the app ad hoc.
// Without a paid Apple Developer certificate the app can't be notarised, but an ad-hoc signature keeps its
// signature consistent, which Apple Silicon needs to start it at all. Gatekeeper still asks on first open.
const { execFileSync } = require('child_process');
const path = require('path');
exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
