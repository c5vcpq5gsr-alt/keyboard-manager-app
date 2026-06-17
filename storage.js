const Database = require('better-sqlite3');
const fs = require('fs/promises');
const path = require('path');

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match || !MIME_EXTENSIONS[match[1]]) throw new Error('Unsupported photo data');
  return { type: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function validateId(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(id || ''))) throw new Error('Invalid storage id');
  return id;
}

function createStorage(userDataPath) {
  const databasePath = path.join(userDataPath, 'keyboard-manager.sqlite');
  const photoDirectory = path.join(userDataPath, 'photos');
  let db;
  let replaceQueue = Promise.resolve();

  async function initialize() {
    await fs.mkdir(photoDirectory, { recursive: true });
    db = new Database(databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        board_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        added_at INTEGER NOT NULL,
        file_name TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS photos_board_id ON photos(board_id);
    `);
    return { mode: 'SQLite + Fotoordner', databasePath, photoDirectory };
  }

  function ensureReady() {
    if (!db) throw new Error('Storage is not initialized');
  }

  function getMeta(key) {
    const row = db.prepare('SELECT value_json FROM app_meta WHERE key = ?').get(key);
    return row ? { key, value: JSON.parse(row.value_json) } : null;
  }

  function getBoard(id) {
    const row = db.prepare('SELECT board_json FROM boards WHERE id = ?').get(id);
    return row ? JSON.parse(row.board_json) : null;
  }

  async function getPhoto(id) {
    const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
    if (!row) return null;
    const buffer = await fs.readFile(path.join(photoDirectory, row.file_name));
    return {
      id: row.id,
      boardId: row.board_id,
      name: row.name,
      type: row.type,
      width: row.width,
      height: row.height,
      addedAt: row.added_at,
      dataUrl: `data:${row.type};base64,${buffer.toString('base64')}`
    };
  }

  async function get(store, key) {
    ensureReady();
    if (store === 'meta') return getMeta(key);
    if (store === 'boards') return getBoard(key);
    if (store === 'photos') return getPhoto(key);
    return null;
  }

  async function putPhoto(photo) {
    validateId(photo.id);
    validateId(photo.boardId);
    const parsed = parseDataUrl(photo.dataUrl);
    if (parsed.buffer.length > 30 * 1024 * 1024) throw new Error('Photo exceeds 30 MB');
    const fileName = `${photo.id}${MIME_EXTENSIONS[parsed.type]}`;
    const old = db.prepare('SELECT file_name FROM photos WHERE id = ?').get(photo.id);
    await fs.writeFile(path.join(photoDirectory, fileName), parsed.buffer);
    db.prepare(`
      INSERT INTO photos (id, board_id, name, type, width, height, added_at, file_name)
      VALUES (@id, @boardId, @name, @type, @width, @height, @addedAt, @fileName)
      ON CONFLICT(id) DO UPDATE SET
        board_id=excluded.board_id, name=excluded.name, type=excluded.type,
        width=excluded.width, height=excluded.height, added_at=excluded.added_at,
        file_name=excluded.file_name
    `).run({
      id: photo.id,
      boardId: photo.boardId,
      name: photo.name || '',
      type: parsed.type,
      width: photo.width || null,
      height: photo.height || null,
      addedAt: photo.addedAt || Date.now(),
      fileName
    });
    if (old?.file_name && old.file_name !== fileName) {
      await fs.rm(path.join(photoDirectory, old.file_name), { force: true });
    }
    return photo.id;
  }

  async function put(store, value) {
    ensureReady();
    if (store === 'meta') {
      db.prepare('INSERT INTO app_meta (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json')
        .run(value.key, JSON.stringify(value.value));
      return value.key;
    }
    if (store === 'boards') {
      validateId(value.id);
      db.prepare('INSERT INTO boards (id, board_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET board_json=excluded.board_json')
        .run(value.id, JSON.stringify(value));
      return value.id;
    }
    if (store === 'photos') return putPhoto(value);
    throw new Error('Unknown store');
  }

  async function remove(store, key) {
    ensureReady();
    if (store === 'meta') return db.prepare('DELETE FROM app_meta WHERE key = ?').run(key).changes;
    if (store === 'boards') return db.prepare('DELETE FROM boards WHERE id = ?').run(key).changes;
    if (store === 'photos') {
      const row = db.prepare('SELECT file_name FROM photos WHERE id = ?').get(key);
      db.prepare('DELETE FROM photos WHERE id = ?').run(key);
      if (row) await fs.rm(path.join(photoDirectory, row.file_name), { force: true });
      return Boolean(row);
    }
    return false;
  }

  async function all(store) {
    ensureReady();
    if (store === 'boards') return db.prepare('SELECT board_json FROM boards').all().map(row => JSON.parse(row.board_json));
    if (store === 'photos') {
      const rows = db.prepare('SELECT id FROM photos').all();
      return Promise.all(rows.map(row => getPhoto(row.id)));
    }
    return [];
  }

  async function photosByBoard(boardId) {
    ensureReady();
    const rows = db.prepare('SELECT id FROM photos WHERE board_id = ?').all(boardId);
    return Promise.all(rows.map(row => getPhoto(row.id)));
  }

  async function replaceAllInternal(appValue, boards, photos) {
    ensureReady();
    const incoming = [];
    for (const photo of photos) {
      validateId(photo.id);
      validateId(photo.boardId);
      const parsed = parseDataUrl(photo.dataUrl);
      if (parsed.buffer.length > 30 * 1024 * 1024) throw new Error('Photo exceeds 30 MB');
      incoming.push({ photo, parsed, fileName: `${photo.id}${MIME_EXTENSIONS[parsed.type]}` });
    }

    const suffix = Date.now();
    const staging = path.join(userDataPath, `photos-staging-${suffix}`);
    const backup = path.join(userDataPath, `photos-backup-${suffix}`);
    await fs.mkdir(staging, { recursive: true });
    let movedCurrentPhotos = false;
    let databaseCommitted = false;
    try {
      for (const item of incoming) await fs.writeFile(path.join(staging, item.fileName), item.parsed.buffer);
      await fs.rename(photoDirectory, backup);
      movedCurrentPhotos = true;
      await fs.rename(staging, photoDirectory);

      db.transaction(() => {
        db.prepare('DELETE FROM photos').run();
        db.prepare('DELETE FROM boards').run();
        db.prepare('DELETE FROM app_meta').run();
        db.prepare('INSERT INTO app_meta (key, value_json) VALUES (?, ?)').run('app', JSON.stringify(appValue));
        const boardStmt = db.prepare('INSERT INTO boards (id, board_json) VALUES (?, ?)');
        for (const board of boards) {
          validateId(board.id);
          boardStmt.run(board.id, JSON.stringify(board));
        }
        const photoStmt = db.prepare('INSERT INTO photos (id, board_id, name, type, width, height, added_at, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const { photo, parsed, fileName } of incoming) {
          photoStmt.run(photo.id, photo.boardId, photo.name || '', parsed.type, photo.width || null, photo.height || null, photo.addedAt || Date.now(), fileName);
        }
      })();
      databaseCommitted = true;
      await fs.rm(backup, { recursive: true, force: true }).catch(() => {});
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true });
      if (movedCurrentPhotos && !databaseCommitted) {
        await fs.rm(photoDirectory, { recursive: true, force: true });
        await fs.rename(backup, photoDirectory);
      }
      throw error;
    }
  }

  function replaceAll(appValue, boards, photos) {
    const operation = replaceQueue.then(() => replaceAllInternal(appValue, boards, photos));
    replaceQueue = operation.catch(() => {});
    return operation;
  }

  function counts() {
    ensureReady();
    return {
      boards: db.prepare('SELECT COUNT(*) AS count FROM boards').get().count,
      photos: db.prepare('SELECT COUNT(*) AS count FROM photos').get().count,
      hasMeta: Boolean(db.prepare('SELECT 1 FROM app_meta WHERE key = ?').get('app'))
    };
  }

  function close() {
    if (db) db.close();
    db = null;
  }

  return { initialize, get, put, remove, all, photosByBoard, replaceAll, counts, close };
}

module.exports = { createStorage };
