const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, net, shell } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-update-test-${process.pid}-${Date.now()}`));
app.getVersion = () => '1.3.1';

const downloadUrl = 'https://github.com/c5vcpq5gsr-alt/keyboard-manager-app/releases/download/v99.0.0/Keyboard.Manager-99.0.0-arm64.dmg';
let openedUrl = '';
const screenshotArg = process.argv.find(argument => argument.startsWith('--screenshot='));
const screenshotPath = screenshotArg ? screenshotArg.slice('--screenshot='.length) : '';

net.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    tag_name: 'v99.0.0',
    name: 'Keyboard Manager v99.0.0',
    body: 'A test release with update details.',
    draft: false,
    prerelease: false,
    published_at: '2026-07-14T20:00:00Z',
    html_url: 'https://github.com/c5vcpq5gsr-alt/keyboard-manager-app/releases/tag/v99.0.0',
    assets: [{ name: 'Keyboard.Manager-99.0.0-arm64.dmg', browser_download_url: downloadUrl }]
  })
});

shell.openExternal = async url => {
  openedUrl = url;
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error('Timed out waiting for update UI');
}

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      await waitFor(async () => window.webContents.executeJavaScript("document.getElementById('sideVersion').textContent !== '…'"));
      const displayedVersion = await window.webContents.executeJavaScript("document.getElementById('sideVersion').textContent");
      assert.equal(displayedVersion, app.getVersion());

      await window.webContents.executeJavaScript("document.getElementById('btnUpdateCheck').click()");
      await waitFor(async () => window.webContents.executeJavaScript("document.getElementById('updateBack').classList.contains('open') && !document.getElementById('updateDownload').hidden"));

      const updateUi = await window.webContents.executeJavaScript(`({
        message: document.getElementById('updateMessage').textContent,
        latest: document.getElementById('updateLatestVersion').textContent,
        notes: document.getElementById('updateNotes').textContent,
        label: document.getElementById('sideUpdateLabel').textContent
      })`);
      assert.match(updateUi.message, /99\.0\.0/);
      assert.equal(updateUi.latest, 'v99.0.0');
      assert.match(updateUi.notes, /test release/);
      assert.equal(updateUi.label, 'Update verfügbar');

      if (screenshotPath) {
        await delay(150);
        const screenshot = await window.webContents.capturePage();
        fs.writeFileSync(screenshotPath, screenshot.toPNG());
      }

      await window.webContents.executeJavaScript("document.getElementById('btnLanguage').click()");
      await waitFor(async () => window.webContents.executeJavaScript("document.getElementById('updateTitle').textContent === 'Software update'"));
      const englishUi = await window.webContents.executeJavaScript(`({
        message: document.getElementById('updateMessage').textContent,
        download: document.getElementById('updateDownload').textContent
      })`);
      assert.match(englishUi.message, /Version 99\.0\.0 is available/);
      assert.equal(englishUi.download, 'Download latest version');

      await window.webContents.executeJavaScript("document.getElementById('updateDownload').click()");
      await waitFor(() => Boolean(openedUrl));
      assert.equal(openedUrl, downloadUrl);

      console.log('update integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      try {
        console.error(await window.webContents.executeJavaScript(`JSON.stringify({
          open: document.getElementById('updateBack').classList.contains('open'),
          current: document.getElementById('updateCurrentVersion').textContent,
          message: document.getElementById('updateMessage').textContent,
          latest: document.getElementById('updateLatestVersion').textContent,
          downloadHidden: document.getElementById('updateDownload').hidden,
          label: document.getElementById('sideUpdateLabel').textContent
        })`));
      } catch (_diagnosticError) {}
      app.exit(1);
    }
  });
});

require('../main.js');
