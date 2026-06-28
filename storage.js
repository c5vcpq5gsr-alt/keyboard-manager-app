const Database = require('better-sqlite3');
const fs = require('fs/promises');
const path = require('path');

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};
const MAX_PHOTO_SIZE = 30 * 1024 * 1024;
const MAX_BACKUP_SIZE = 500 * 1024 * 1024;
const MAX_ITEMS = {
  boards: 10000,
  keycapSets: 10000,
  artisanSets: 10000,
  switchSets: 10000,
  photos: 50000
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

function photoOwner(photo) {
  const ownerType = photo.ownerType || 'board';
  const ownerId = photo.ownerId || photo.boardId;
  if (!['board', 'keycapSet', 'artisanSet', 'switchSet'].includes(ownerType)) throw new Error('Invalid photo owner type');
  validateId(ownerId);
  return { ownerType, ownerId, boardId: ownerType === 'board' ? ownerId : (photo.boardId || '') };
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
      CREATE TABLE IF NOT EXISTS keycap_sets (
        id TEXT PRIMARY KEY,
        keycap_set_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS artisan_sets (
        id TEXT PRIMARY KEY,
        artisan_set_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS switch_sets (
        id TEXT PRIMARY KEY,
        switch_set_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        owner_type TEXT NOT NULL DEFAULT 'board',
        owner_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        added_at INTEGER NOT NULL,
        file_name TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS photos_board_id ON photos(board_id);
    `);
    const photoColumns = db.prepare('PRAGMA table_info(photos)').all().map(row => row.name);
    if (!photoColumns.includes('owner_type')) {
      db.prepare("ALTER TABLE photos ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'board'").run();
    }
    if (!photoColumns.includes('owner_id')) {
      db.prepare('ALTER TABLE photos ADD COLUMN owner_id TEXT').run();
    }
    db.prepare("UPDATE photos SET owner_type = 'board' WHERE owner_type IS NULL OR owner_type = ''").run();
    db.prepare("UPDATE photos SET owner_id = board_id WHERE owner_id IS NULL OR owner_id = ''").run();
    db.prepare('CREATE INDEX IF NOT EXISTS photos_owner ON photos(owner_type, owner_id)').run();
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

  function getKeycapSet(id) {
    const row = db.prepare('SELECT keycap_set_json FROM keycap_sets WHERE id = ?').get(id);
    return row ? JSON.parse(row.keycap_set_json) : null;
  }

  function getArtisanSet(id) {
    const row = db.prepare('SELECT artisan_set_json FROM artisan_sets WHERE id = ?').get(id);
    return row ? JSON.parse(row.artisan_set_json) : null;
  }

  function getSwitchSet(id) {
    const row = db.prepare('SELECT switch_set_json FROM switch_sets WHERE id = ?').get(id);
    return row ? JSON.parse(row.switch_set_json) : null;
  }

  async function getPhoto(id) {
    const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
    if (!row) return null;
    const buffer = await fs.readFile(path.join(photoDirectory, row.file_name));
    return {
      id: row.id,
      boardId: row.board_id,
      ownerType: row.owner_type || 'board',
      ownerId: row.owner_id || row.board_id,
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
    if (store === 'keycapSets') return getKeycapSet(key);
    if (store === 'artisanSets') return getArtisanSet(key);
    if (store === 'switchSets') return getSwitchSet(key);
    if (store === 'photos') return getPhoto(key);
    return null;
  }

  async function putPhoto(photo) {
    validateId(photo.id);
    const owner = photoOwner(photo);
    const parsed = parseDataUrl(photo.dataUrl);
    if (parsed.buffer.length > MAX_PHOTO_SIZE) throw new Error('Photo exceeds 30 MB');
    const fileName = `${photo.id}${MIME_EXTENSIONS[parsed.type]}`;
    const tempFileName = `${fileName}.tmp-${process.pid}-${Date.now()}`;
    const old = db.prepare('SELECT * FROM photos WHERE id = ?').get(photo.id);
    await fs.writeFile(path.join(photoDirectory, tempFileName), parsed.buffer);
    let databaseWritten = false;
    try {
      db.prepare(`
        INSERT INTO photos (id, board_id, owner_type, owner_id, name, type, width, height, added_at, file_name)
        VALUES (@id, @boardId, @ownerType, @ownerId, @name, @type, @width, @height, @addedAt, @fileName)
        ON CONFLICT(id) DO UPDATE SET
          board_id=excluded.board_id, owner_type=excluded.owner_type, owner_id=excluded.owner_id,
          name=excluded.name, type=excluded.type,
          width=excluded.width, height=excluded.height, added_at=excluded.added_at,
          file_name=excluded.file_name
      `).run({
        id: photo.id,
        boardId: owner.boardId,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        name: photo.name || '',
        type: parsed.type,
        width: photo.width || null,
        height: photo.height || null,
        addedAt: photo.addedAt || Date.now(),
        fileName
      });
      databaseWritten = true;
      await fs.rename(path.join(photoDirectory, tempFileName), path.join(photoDirectory, fileName));
    } catch (error) {
      await fs.rm(path.join(photoDirectory, tempFileName), { force: true });
      if (databaseWritten) {
        if (old) {
          db.prepare(`
            INSERT INTO photos (id, board_id, owner_type, owner_id, name, type, width, height, added_at, file_name)
            VALUES (@id, @board_id, @owner_type, @owner_id, @name, @type, @width, @height, @added_at, @file_name)
            ON CONFLICT(id) DO UPDATE SET
              board_id=excluded.board_id, owner_type=excluded.owner_type, owner_id=excluded.owner_id,
              name=excluded.name, type=excluded.type,
              width=excluded.width, height=excluded.height, added_at=excluded.added_at,
              file_name=excluded.file_name
          `).run(old);
        } else {
          db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
        }
      }
      throw error;
    }
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
    if (store === 'keycapSets') {
      validateId(value.id);
      db.prepare('INSERT INTO keycap_sets (id, keycap_set_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET keycap_set_json=excluded.keycap_set_json')
        .run(value.id, JSON.stringify(value));
      return value.id;
    }
    if (store === 'artisanSets') {
      validateId(value.id);
      db.prepare('INSERT INTO artisan_sets (id, artisan_set_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET artisan_set_json=excluded.artisan_set_json')
        .run(value.id, JSON.stringify(value));
      return value.id;
    }
    if (store === 'switchSets') {
      validateId(value.id);
      db.prepare('INSERT INTO switch_sets (id, switch_set_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET switch_set_json=excluded.switch_set_json')
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
    if (store === 'keycapSets') return db.prepare('DELETE FROM keycap_sets WHERE id = ?').run(key).changes;
    if (store === 'artisanSets') return db.prepare('DELETE FROM artisan_sets WHERE id = ?').run(key).changes;
    if (store === 'switchSets') return db.prepare('DELETE FROM switch_sets WHERE id = ?').run(key).changes;
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
    if (store === 'keycapSets') return db.prepare('SELECT keycap_set_json FROM keycap_sets').all().map(row => JSON.parse(row.keycap_set_json));
    if (store === 'artisanSets') return db.prepare('SELECT artisan_set_json FROM artisan_sets').all().map(row => JSON.parse(row.artisan_set_json));
    if (store === 'switchSets') return db.prepare('SELECT switch_set_json FROM switch_sets').all().map(row => JSON.parse(row.switch_set_json));
    if (store === 'photos') {
      const rows = db.prepare('SELECT id FROM photos').all();
      return Promise.all(rows.map(row => getPhoto(row.id)));
    }
    return [];
  }

  async function photosByBoard(boardId) {
    ensureReady();
    const rows = db.prepare("SELECT id FROM photos WHERE owner_type = 'board' AND owner_id = ?").all(boardId);
    return Promise.all(rows.map(row => getPhoto(row.id)));
  }

  async function photosByOwner(ownerType, ownerId) {
    ensureReady();
    if (!['board', 'keycapSet', 'artisanSet', 'switchSet'].includes(ownerType)) throw new Error('Invalid photo owner type');
    validateId(ownerId);
    const rows = db.prepare('SELECT id FROM photos WHERE owner_type = ? AND owner_id = ?').all(ownerType, ownerId);
    return Promise.all(rows.map(row => getPhoto(row.id)));
  }

  async function replaceAllInternal(appValue, boards, photos, keycapSets = [], artisanSets = [], switchSets = []) {
    ensureReady();
    if (![boards, photos, keycapSets, artisanSets, switchSets].every(Array.isArray)) {
      throw new Error('Invalid import payload');
    }
    if (!appValue || typeof appValue !== 'object') {
      throw new Error('Invalid app metadata');
    }
    if (boards.length > MAX_ITEMS.boards || keycapSets.length > MAX_ITEMS.keycapSets || artisanSets.length > MAX_ITEMS.artisanSets || switchSets.length > MAX_ITEMS.switchSets || photos.length > MAX_ITEMS.photos) {
      throw new Error('Import exceeds item limits');
    }
    if (Buffer.byteLength(JSON.stringify({ appValue, boards, keycapSets, artisanSets, switchSets }), 'utf8') > 100 * 1024 * 1024) {
      throw new Error('Import metadata exceeds size limits');
    }
    const incoming = [];
    let totalSize = 0;
    for (const photo of photos) {
      validateId(photo.id);
      const owner = photoOwner(photo);
      const parsed = parseDataUrl(photo.dataUrl);
      totalSize += parsed.buffer.length;
      if (parsed.buffer.length > MAX_PHOTO_SIZE || totalSize > MAX_BACKUP_SIZE) throw new Error('Photo import exceeds size limits');
      incoming.push({ photo, owner, parsed, fileName: `${photo.id}${MIME_EXTENSIONS[parsed.type]}` });
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
        db.prepare('DELETE FROM keycap_sets').run();
        db.prepare('DELETE FROM artisan_sets').run();
        db.prepare('DELETE FROM switch_sets').run();
        db.prepare('DELETE FROM app_meta').run();
        db.prepare('INSERT INTO app_meta (key, value_json) VALUES (?, ?)').run('app', JSON.stringify(appValue));
        const boardStmt = db.prepare('INSERT INTO boards (id, board_json) VALUES (?, ?)');
        for (const board of boards) {
          validateId(board.id);
          boardStmt.run(board.id, JSON.stringify(board));
        }
        const keycapStmt = db.prepare('INSERT INTO keycap_sets (id, keycap_set_json) VALUES (?, ?)');
        for (const keycapSet of keycapSets) {
          validateId(keycapSet.id);
          keycapStmt.run(keycapSet.id, JSON.stringify(keycapSet));
        }
        const artisanStmt = db.prepare('INSERT INTO artisan_sets (id, artisan_set_json) VALUES (?, ?)');
        for (const artisanSet of artisanSets) {
          validateId(artisanSet.id);
          artisanStmt.run(artisanSet.id, JSON.stringify(artisanSet));
        }
        const switchStmt = db.prepare('INSERT INTO switch_sets (id, switch_set_json) VALUES (?, ?)');
        for (const switchSet of switchSets) {
          validateId(switchSet.id);
          switchStmt.run(switchSet.id, JSON.stringify(switchSet));
        }
        const photoStmt = db.prepare('INSERT INTO photos (id, board_id, owner_type, owner_id, name, type, width, height, added_at, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const { photo, owner, parsed, fileName } of incoming) {
          photoStmt.run(photo.id, owner.boardId, owner.ownerType, owner.ownerId, photo.name || '', parsed.type, photo.width || null, photo.height || null, photo.addedAt || Date.now(), fileName);
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

  function replaceAll(appValue, boards, photos, keycapSets = [], artisanSets = [], switchSets = []) {
    const operation = replaceQueue.then(() => replaceAllInternal(appValue, boards, photos, keycapSets, artisanSets, switchSets));
    replaceQueue = operation.catch(() => {});
    return operation;
  }

  function counts() {
    ensureReady();
    return {
      boards: db.prepare('SELECT COUNT(*) AS count FROM boards').get().count,
      keycapSets: db.prepare('SELECT COUNT(*) AS count FROM keycap_sets').get().count,
      artisanSets: db.prepare('SELECT COUNT(*) AS count FROM artisan_sets').get().count,
      switchSets: db.prepare('SELECT COUNT(*) AS count FROM switch_sets').get().count,
      photos: db.prepare('SELECT COUNT(*) AS count FROM photos').get().count,
      hasMeta: Boolean(db.prepare('SELECT 1 FROM app_meta WHERE key = ?').get('app'))
    };
  }

  function close() {
    if (db) db.close();
    db = null;
  }

  return { initialize, get, put, remove, all, photosByBoard, photosByOwner, replaceAll, counts, close };
}

module.exports = { createStorage };
