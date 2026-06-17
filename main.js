const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const AdmZip = require('adm-zip');
const { createStorage } = require('./storage');

const trustedWebContents = new Set();
let storage;

function isTrustedSender (event) {
  return event.senderFrame === event.sender.mainFrame &&
    trustedWebContents.has(event.sender.id);
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1800,
    height: 1200,
    backgroundColor: '#070b14',
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 },
      vibrancy: 'under-window',
      visualEffectState: 'active'
    } : {}),
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
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.loadFile(path.join(__dirname, 'index.html'));

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

trustedHandler('storage:get', (store, key) => storage.get(store, key));
trustedHandler('storage:put', (store, value) => storage.put(store, value));
trustedHandler('storage:delete', (store, key) => storage.remove(store, key));
trustedHandler('storage:all', store => storage.all(store));
trustedHandler('storage:photos-by-board', boardId => storage.photosByBoard(boardId));
trustedHandler('storage:replace-all', payload => storage.replaceAll(payload.appValue, payload.boards, payload.photos));
trustedHandler('storage:info', () => storage.counts());

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
    schemaVersion: 3,
    format: 'keyboard-manager-zip',
    meta: data.meta,
    lists: data.lists,
    gallery: data.gallery,
    boards: data.boards,
    photos: []
  };
  let totalSize = 0;
  for (const photo of data.photos || []) {
    const file = safePhotoName(photo);
    const buffer = photoBuffer(photo.dataUrl, photo.type);
    totalSize += buffer.length;
    if (buffer.length > 30 * 1024 * 1024 || totalSize > 500 * 1024 * 1024) throw new Error('Backup exceeds size limits');
    zip.addFile(file, buffer);
    manifest.photos.push({ id: photo.id, boardId: photo.boardId, name: photo.name, type: photo.type, width: photo.width, height: photo.height, addedAt: photo.addedAt, file });
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
  if (manifest.schemaVersion !== 3 || manifest.format !== 'keyboard-manager-zip' || !Array.isArray(manifest.photos)) throw new Error('Unsupported ZIP backup');
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
