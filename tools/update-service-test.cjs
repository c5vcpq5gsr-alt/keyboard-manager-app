const assert = require('node:assert/strict');
const {
  GITHUB_API_URL,
  buildUpdateResult,
  chooseDownloadAsset,
  compareVersions,
  fetchLatestRelease,
  isTrustedReleaseUrl,
  parseVersion,
  publicUpdateResult
} = require('../update-service');

const assets = [
  {
    name: 'Keyboard.Manager-2.0.0-arm64.dmg',
    browser_download_url: 'https://github.com/c5vcpq5gsr-alt/keyboard-manager-app/releases/download/v2.0.0/Keyboard.Manager-2.0.0-arm64.dmg'
  },
  {
    name: 'Keyboard.Manager.2.0.0.exe',
    browser_download_url: 'https://github.com/c5vcpq5gsr-alt/keyboard-manager-app/releases/download/v2.0.0/Keyboard.Manager.2.0.0.exe'
  },
  {
    name: 'Keyboard.Manager.Setup.2.0.0.exe',
    browser_download_url: 'https://github.com/c5vcpq5gsr-alt/keyboard-manager-app/releases/download/v2.0.0/Keyboard.Manager.Setup.2.0.0.exe'
  },
  {
    name: 'malicious.dmg',
    browser_download_url: 'https://example.com/malicious.dmg'
  }
];

const release = {
  tag_name: 'v2.0.0',
  name: 'Keyboard Manager v2.0.0',
  body: 'Update notes',
  draft: false,
  prerelease: false,
  published_at: '2026-07-14T20:00:00Z',
  html_url: 'https://github.com/c5vcpq5gsr-alt/keyboard-manager-app/releases/tag/v2.0.0',
  assets
};

assert.deepEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3, prerelease: [] });
assert.equal(parseVersion('not-a-version'), null);
assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
assert.equal(compareVersions('1.3.1', '1.3.1'), 0);
assert.equal(compareVersions('2.0.0-beta.2', '2.0.0-beta.10'), -1);
assert.equal(compareVersions('2.0.0', '2.0.0-beta.10'), 1);

assert.equal(chooseDownloadAsset(assets, 'darwin').name, 'Keyboard.Manager-2.0.0-arm64.dmg');
assert.equal(chooseDownloadAsset(assets, 'win32', false).name, 'Keyboard.Manager.Setup.2.0.0.exe');
assert.equal(chooseDownloadAsset(assets, 'win32', true).name, 'Keyboard.Manager.2.0.0.exe');
assert.equal(chooseDownloadAsset(assets, 'linux'), null);
assert.equal(isTrustedReleaseUrl(assets[0].browser_download_url), true);
assert.equal(isTrustedReleaseUrl('https://github.com/another/repo/releases/download/v1/file.dmg'), false);

const result = buildUpdateResult(release, { currentVersion: '1.3.1', platform: 'darwin', portable: false });
assert.equal(result.updateAvailable, true);
assert.equal(result.latestVersion, '2.0.0');
assert.equal(result.assetName, 'Keyboard.Manager-2.0.0-arm64.dmg');
assert.equal(result.downloadAvailable, true);

const clientResult = publicUpdateResult(result, 1234, false);
assert.equal(clientResult.checkedAt, 1234);
assert.equal('downloadUrl' in clientResult, false);
assert.equal('releaseUrl' in clientResult, false);

(async () => {
  let requestedUrl = '';
  const fetched = await fetchLatestRelease(async (url, options) => {
    requestedUrl = url;
    assert.equal(options.headers['User-Agent'], 'Keyboard-Manager-Update-Check');
    return { ok: true, status: 200, json: async () => release };
  });
  assert.equal(requestedUrl, GITHUB_API_URL);
  assert.equal(fetched.tag_name, 'v2.0.0');
  console.log('update service ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
