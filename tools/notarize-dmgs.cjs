const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
);
const productName = packageJson.build?.productName || packageJson.name;
const artifactPrefix = `${productName}-${packageJson.version}`;
const signingIdentity =
  process.env.MAC_SIGNING_IDENTITY ||
  'Developer ID Application: Philipp John Hild (G6JH37W285)';

const dmgs = fs
  .readdirSync(distDir)
  .filter((name) => name.startsWith(artifactPrefix) && name.endsWith('.dmg'))
  .map((name) => path.join(distDir, name))
  .sort();

if (dmgs.length === 0) {
  throw new Error(`No DMGs matching ${artifactPrefix}*.dmg found in ${distDir}`);
}

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

const credentials = notarizationCredentials();

for (const dmg of dmgs) {
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
