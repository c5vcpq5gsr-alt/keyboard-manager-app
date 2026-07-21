const { execFileSync } = require('node:child_process');
const path = require('node:path');

const signingIdentity =
  process.env.MAC_SIGNING_IDENTITY ||
  'Developer ID Application: Philipp John Hild (G6JH37W285)';

function notarizationCredentials() {
  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID) {
    const args = [
      '--key',
      process.env.APPLE_API_KEY,
      '--key-id',
      process.env.APPLE_API_KEY_ID
    ];
    if (process.env.APPLE_API_ISSUER) {
      args.push('--issuer', process.env.APPLE_API_ISSUER);
    }
    return args;
  }

  if (process.env.APPLE_KEYCHAIN_PROFILE) {
    const args = ['--keychain-profile', process.env.APPLE_KEYCHAIN_PROFILE];
    if (process.env.APPLE_KEYCHAIN) {
      args.push('--keychain', process.env.APPLE_KEYCHAIN);
    }
    return args;
  }

  throw new Error(
    'Configure APPLE_KEYCHAIN_PROFILE locally or App Store Connect API key credentials in CI'
  );
}

function notarizeDmg(event) {
  const dmg = event?.file;
  if (!dmg || path.extname(dmg).toLowerCase() !== '.dmg') {
    return;
  }

  const credentials = notarizationCredentials();
  console.log(`Signing DMG: ${path.basename(dmg)}`);
  execFileSync(
    'codesign',
    ['--force', '--timestamp', '--sign', signingIdentity, dmg],
    { stdio: 'inherit' }
  );

  console.log(`Notarizing DMG: ${path.basename(dmg)}`);
  execFileSync(
    'xcrun',
    ['notarytool', 'submit', dmg, ...credentials, '--wait'],
    { stdio: 'inherit' }
  );

  execFileSync('xcrun', ['stapler', 'staple', dmg], { stdio: 'inherit' });
  execFileSync('xcrun', ['stapler', 'validate', dmg], { stdio: 'inherit' });
}

exports.default = notarizeDmg;
