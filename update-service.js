const GITHUB_OWNER = 'c5vcpq5gsr-alt';
const GITHUB_REPOSITORY = 'keyboard-manager-app';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/latest`;
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/latest`;

function parseVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  };
}

function comparePrerelease(left, right) {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;

    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) > Number(b) ? 1 : -1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a > b ? 1 : -1;
  }
  return 0;
}

function compareVersions(leftValue, rightValue) {
  const left = parseVersion(leftValue);
  const right = parseVersion(rightValue);
  if (!left || !right) throw new Error('Invalid semantic version');

  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function isTrustedReleaseUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const repositoryPath = `/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/`;
    return url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname.startsWith(repositoryPath);
  } catch (_error) {
    return false;
  }
}

function chooseDownloadAsset(assets, platform, portable = false) {
  const candidates = Array.isArray(assets) ? assets.filter(asset => (
    asset &&
    typeof asset.name === 'string' &&
    isTrustedReleaseUrl(asset.browser_download_url)
  )) : [];

  if (platform === 'darwin') {
    return candidates.find(asset => /\.dmg$/i.test(asset.name)) || null;
  }

  if (platform === 'win32') {
    if (portable) {
      return candidates.find(asset => /\.exe$/i.test(asset.name) && !/setup/i.test(asset.name)) || null;
    }
    return candidates.find(asset => /setup.*\.exe$/i.test(asset.name)) || null;
  }

  return null;
}

function releaseVersion(release) {
  const version = String(release?.tag_name || '').trim().replace(/^v/i, '');
  if (!parseVersion(version)) throw new Error('Latest GitHub release has an invalid version tag');
  return version;
}

function buildUpdateResult(release, runtime) {
  if (!release || release.draft || release.prerelease) {
    throw new Error('Latest GitHub release is not a published stable release');
  }

  const currentVersion = String(runtime?.currentVersion || '').trim();
  if (!parseVersion(currentVersion)) throw new Error('Installed app version is invalid');

  const latestVersion = releaseVersion(release);
  const asset = chooseDownloadAsset(release.assets, runtime?.platform, Boolean(runtime?.portable));
  const releaseUrl = isTrustedReleaseUrl(release.html_url) ? release.html_url : GITHUB_RELEASES_URL;

  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    releaseName: String(release.name || `Keyboard Manager v${latestVersion}`).slice(0, 160),
    releaseNotes: String(release.body || '').trim().slice(0, 6000),
    publishedAt: String(release.published_at || ''),
    assetName: asset?.name || '',
    downloadUrl: asset?.browser_download_url || releaseUrl,
    downloadAvailable: Boolean(asset),
    releaseUrl
  };
}

async function fetchLatestRelease(fetchImpl, options = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('No HTTP client available');
  const response = await fetchImpl(GITHUB_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Keyboard-Manager-Update-Check',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    signal: options.signal
  });

  if (!response.ok) throw new Error(`GitHub update check failed (${response.status})`);
  return response.json();
}

function publicUpdateResult(result, checkedAt, cached = false) {
  return {
    currentVersion: result.currentVersion,
    latestVersion: result.latestVersion,
    updateAvailable: result.updateAvailable,
    releaseName: result.releaseName,
    releaseNotes: result.releaseNotes,
    publishedAt: result.publishedAt,
    assetName: result.assetName,
    downloadAvailable: result.downloadAvailable,
    checkedAt,
    cached
  };
}

module.exports = {
  GITHUB_API_URL,
  GITHUB_RELEASES_URL,
  buildUpdateResult,
  chooseDownloadAsset,
  compareVersions,
  fetchLatestRelease,
  isTrustedReleaseUrl,
  parseVersion,
  publicUpdateResult
};
