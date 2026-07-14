const { app, BrowserWindow, dialog, ipcMain, Menu, net, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');
const AdmZip = require('adm-zip');
const { createStorage } = require('./storage');
const { createInventoryXlsxBuffer, validateInventoryReport } = require('./inventory-export');
const {
  buildUpdateResult,
  compareVersions,
  fetchLatestRelease,
  isTrustedReleaseUrl,
  parseVersion,
  publicUpdateResult
} = require('./update-service');

const trustedWebContents = new Set();
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_REQUEST_TIMEOUT_MS = 12 * 1000;
let storage;
let latestUpdateResult = null;
let updateCheckPromise = null;

function updateCachePath() {
  return path.join(app.getPath('userData'), 'update-check.json');
}

function runtimeUpdateInfo() {
  return {
    currentVersion: app.getVersion(),
    platform: process.platform,
    portable: process.platform === 'win32' && Boolean(process.env.PORTABLE_EXECUTABLE_FILE)
  };
}

function validateCachedUpdateResult(value) {
  return Boolean(
    value &&
    parseVersion(value.latestVersion) &&
    isTrustedReleaseUrl(value.downloadUrl) &&
    isTrustedReleaseUrl(value.releaseUrl)
  );
}

async function readUpdateCache() {
  try {
    const cache = JSON.parse(await fs.readFile(updateCachePath(), 'utf8'));
    if (!Number.isFinite(cache.checkedAt) || !validateCachedUpdateResult(cache.result)) return null;
    return cache;
  } catch (_error) {
    return null;
  }
}

async function writeUpdateCache(checkedAt, result) {
  try {
    await fs.writeFile(updateCachePath(), JSON.stringify({ checkedAt, result }), { encoding: 'utf8', mode: 0o600 });
  } catch (_error) {
    // A failed cache write must not turn a successful update check into an error.
  }
}

function refreshCachedResultForRuntime(result) {
  const currentVersion = app.getVersion();
  return {
    ...result,
    currentVersion,
    updateAvailable: compareVersions(result.latestVersion, currentVersion) > 0
  };
}

async function performUpdateCheck(force = false) {
  if (updateCheckPromise) return updateCheckPromise;

  updateCheckPromise = (async () => {
    const cached = await readUpdateCache();
    const now = Date.now();
    if (!force && cached && now - cached.checkedAt < UPDATE_CHECK_INTERVAL_MS) {
      latestUpdateResult = refreshCachedResultForRuntime(cached.result);
      return publicUpdateResult(latestUpdateResult, cached.checkedAt, true);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS);
    try {
      const release = await fetchLatestRelease((...args) => net.fetch(...args), { signal: controller.signal });
      latestUpdateResult = buildUpdateResult(release, runtimeUpdateInfo());
      await writeUpdateCache(now, latestUpdateResult);
      return publicUpdateResult(latestUpdateResult, now, false);
    } finally {
      clearTimeout(timeout);
    }
  })();

  try {
    return await updateCheckPromise;
  } finally {
    updateCheckPromise = null;
  }
}

async function openLatestUpdateDownload() {
  if (!latestUpdateResult) {
    const cached = await readUpdateCache();
    if (cached) latestUpdateResult = refreshCachedResultForRuntime(cached.result);
  }
  if (!latestUpdateResult) await performUpdateCheck(true);

  const target = latestUpdateResult?.downloadUrl;
  if (!isTrustedReleaseUrl(target)) throw new Error('No trusted update download is available');
  await shell.openExternal(target);
  return { opened: true, assetName: latestUpdateResult.assetName || '' };
}

function isTrustedSender (event) {
  return event.senderFrame === event.sender.mainFrame &&
    trustedWebContents.has(event.sender.id);
}

function openContextMenu (win, params) {
  const editFlags = params.editFlags || {};
  let template;

  if (params.isEditable) {
    template = [
      { label: 'Rückgängig', role: 'undo', enabled: Boolean(editFlags.canUndo) },
      { label: 'Wiederholen', role: 'redo', enabled: Boolean(editFlags.canRedo) },
      { type: 'separator' },
      { label: 'Ausschneiden', role: 'cut', enabled: Boolean(editFlags.canCut) },
      { label: 'Kopieren', role: 'copy', enabled: Boolean(editFlags.canCopy) },
      { label: 'Einfügen', role: 'paste', enabled: Boolean(editFlags.canPaste) },
      { type: 'separator' },
      { label: 'Alles auswählen', role: 'selectAll', enabled: Boolean(editFlags.canSelectAll) }
    ];
  } else if (params.selectionText) {
    template = [
      { label: 'Kopieren', role: 'copy', enabled: Boolean(editFlags.canCopy) }
    ];
  }

  if (template) {
    Menu.buildFromTemplate(template).popup({ window: win });
  }
}

function createWindow () {
  const indexPath = path.join(__dirname, 'index.html');
  const indexUrl = pathToFileURL(indexPath).toString();
  const win = new BrowserWindow({
    width: 1800,
    height: 1200,
    title: 'Keyboard Manager',
    backgroundColor: '#070b14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const webContentsId = win.webContents.id;
  trustedWebContents.add(webContentsId);
  win.webContents.once('destroyed', () => trustedWebContents.delete(webContentsId));
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== indexUrl) event.preventDefault();
  });
  win.webContents.on('context-menu', (_event, params) => {
    openContextMenu(win, params);
  });
  win.loadFile(indexPath);

  // DevTools nur im Dev-Modus
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  storage = createStorage(app.getPath('userData'));
  return storage.initialize();
}).then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => storage?.close());

function trustedHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender');
    return handler(...args);
  });
}

trustedHandler('app:info', () => ({ version: app.getVersion(), isPackaged: app.isPackaged }));
trustedHandler('updates:check', options => performUpdateCheck(Boolean(options?.force)));
trustedHandler('updates:download', () => openLatestUpdateDownload());
trustedHandler('storage:get', (store, key) => storage.get(store, key));
trustedHandler('storage:put', (store, value) => storage.put(store, value));
trustedHandler('storage:delete', (store, key) => storage.remove(store, key));
trustedHandler('storage:all', store => storage.all(store));
trustedHandler('storage:photos-by-board', boardId => storage.photosByBoard(boardId));
trustedHandler('storage:photos-by-owner', (ownerType, ownerId) => storage.photosByOwner(ownerType, ownerId));
trustedHandler('storage:replace-all', payload => storage.replaceAll(payload.appValue, payload.boards, payload.photos, payload.keycapSets || [], payload.artisanSets || [], payload.switchSets || []));
trustedHandler('storage:info', () => storage.counts());
trustedHandler('shell:open-external', async url => {
  const parsed = new URL(String(url || ''));
  if (parsed.protocol !== 'https:') throw new Error('Unsupported external URL');
  await shell.openExternal(parsed.toString());
  return true;
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function inventoryDialogText(language, format) {
  const isEnglish = language === 'en';
  if (format === 'pdf') {
    return {
      title: isEnglish ? 'Save inventory report as PDF' : 'Bestandsbericht als PDF speichern',
      filterName: isEnglish ? 'PDF document' : 'PDF-Dokument'
    };
  }
  return {
    title: isEnglish ? 'Save inventory list as Excel workbook' : 'Bestandsliste als Excel-Arbeitsmappe speichern',
    filterName: isEnglish ? 'Excel workbook' : 'Excel-Arbeitsmappe'
  };
}

function inventoryDefaultPath(format) {
  const date = new Date().toISOString().slice(0, 10);
  return `keyboard-manager-bestand-${date}.${format}`;
}

function ensureFileExtension(filePath, extension) {
  return path.extname(filePath).toLowerCase() === `.${extension}` ? filePath : `${filePath}.${extension}`;
}

async function createInventoryPdfBuffer(report) {
  const reportWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  reportWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  reportWindow.webContents.on('will-navigate', event => event.preventDefault());
  try {
    await reportWindow.loadFile(path.join(__dirname, 'inventory-report.html'));
    const encoded = Buffer.from(JSON.stringify(report), 'utf8').toString('base64');
    await reportWindow.webContents.executeJavaScript(`window.renderInventoryReport(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('${encoded}'), character => character.charCodeAt(0)))))`);
    const title = escapeHtml(report.title);
    const created = escapeHtml(new Intl.DateTimeFormat(report.language === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium' }).format(new Date(report.createdAt)));
    return await reportWindow.webContents.printToPDF({
      pageSize: 'A4',
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      margins: { top: 0.48, bottom: 0.48, left: 0.34, right: 0.34 },
      headerTemplate: `<div style="box-sizing:border-box;width:100%;padding:0 9mm;font:8px Arial,sans-serif;color:#667085"><span>${title}</span></div>`,
      footerTemplate: `<div style="box-sizing:border-box;width:100%;padding:0 9mm;display:flex;justify-content:space-between;font:8px Arial,sans-serif;color:#667085"><span>Keyboard Manager · ${created}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      generateTaggedPDF: true,
      generateDocumentOutline: true
    });
  } finally {
    if (!reportWindow.isDestroyed()) reportWindow.destroy();
  }
}

trustedHandler('inventory:export', async payload => {
  const report = validateInventoryReport(payload);
  const format = report.format;
  const dialogText = inventoryDialogText(report.language, format);
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: dialogText.title,
    defaultPath: inventoryDefaultPath(format),
    filters: [{ name: dialogText.filterName, extensions: [format] }]
  });
  if (canceled || !filePath) return false;
  const outputPath = ensureFileExtension(filePath, format);
  const buffer = format === 'pdf'
    ? await createInventoryPdfBuffer(report)
    : await createInventoryXlsxBuffer(report);
  await fs.writeFile(outputPath, buffer);
  return true;
});

function safePhotoName(photo) {
  const extension = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' })[photo.type];
  if (!extension || !/^[a-zA-Z0-9_-]+$/.test(photo.id)) throw new Error('Invalid photo metadata');
  return `photos/${photo.id}${extension}`;
}

function photoBuffer(dataUrl, expectedType) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match || match[1] !== expectedType) throw new Error('Invalid photo data');
  return Buffer.from(match[2], 'base64');
}

trustedHandler('backup:export', async data => {
  const zip = new AdmZip();
  const manifest = {
    schemaVersion: 6,
    format: 'keyboard-manager-zip',
    meta: data.meta,
    lists: data.lists,
    gallery: data.gallery,
    boards: data.boards,
    keycapSets: data.keycapSets || [],
    artisanSets: data.artisanSets || [],
    switchSets: data.switchSets || [],
    photos: []
  };
  let totalSize = 0;
  for (const photo of data.photos || []) {
    const file = safePhotoName(photo);
    const buffer = photoBuffer(photo.dataUrl, photo.type);
    totalSize += buffer.length;
    if (buffer.length > 30 * 1024 * 1024 || totalSize > 500 * 1024 * 1024) throw new Error('Backup exceeds size limits');
    zip.addFile(file, buffer);
    manifest.photos.push({
      id: photo.id,
      boardId: photo.boardId,
      ownerType: photo.ownerType || 'board',
      ownerId: photo.ownerId || photo.boardId,
      name: photo.name,
      type: photo.type,
      width: photo.width,
      height: photo.height,
      addedAt: photo.addedAt,
      file
    });
  }
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  const { filePath } = await dialog.showSaveDialog({
    title: 'ZIP-Backup speichern',
    defaultPath: 'keyboard-manager-backup.zip',
    filters: [{ name: 'Keyboard Manager ZIP-Backup', extensions: ['zip'] }]
  });
  if (!filePath) return false;
  await fs.writeFile(filePath, zip.toBuffer());
  return true;
});

trustedHandler('backup:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Backup importieren',
    filters: [
      { name: 'Keyboard Manager Backups', extensions: ['zip', 'json'] }
    ],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const filePath = filePaths[0];
  const stat = await fs.stat(filePath);
  if (stat.size > 500 * 1024 * 1024) throw new Error('Backup exceeds 500 MB');
  if (path.extname(filePath).toLowerCase() === '.json') {
    return { kind: 'json', content: await fs.readFile(filePath, 'utf8') };
  }

  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const manifestEntry = entries.find(entry => entry.entryName === 'manifest.json');
  if (!manifestEntry || manifestEntry.header.size > 10 * 1024 * 1024) throw new Error('ZIP manifest missing or too large');
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  if (![3, 4, 5, 6].includes(manifest.schemaVersion) || manifest.format !== 'keyboard-manager-zip' || !Array.isArray(manifest.photos)) throw new Error('Unsupported ZIP backup');
  const entryMap = new Map(entries.map(entry => [entry.entryName, entry]));
  let totalSize = 0;
  const photos = manifest.photos.map(photo => {
    if (photo.file !== safePhotoName(photo)) throw new Error('Invalid photo path in backup');
    const entry = entryMap.get(photo.file);
    if (!entry || entry.isDirectory || entry.header.size > 30 * 1024 * 1024) throw new Error('Photo missing or too large');
    const buffer = entry.getData();
    totalSize += buffer.length;
    if (totalSize > 500 * 1024 * 1024) throw new Error('Backup exceeds size limits');
    return { ...photo, dataUrl: `data:${photo.type};base64,${buffer.toString('base64')}` };
  });
  return { kind: 'zip', content: JSON.stringify({ ...manifest, photos }) };
});
