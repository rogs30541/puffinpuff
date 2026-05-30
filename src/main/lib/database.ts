import { app } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let saveTimer: NodeJS.Timeout | null = null;

const SAVE_DEBOUNCE_MS = 500;

function dbPath(): string {
  return join(app.getPath('userData'), 'puffinpuff.db');
}

function wasmPath(): string {
  return join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const wasmBuf = readFileSync(wasmPath());
  const wasmBinary = wasmBuf.buffer.slice(
    wasmBuf.byteOffset,
    wasmBuf.byteOffset + wasmBuf.byteLength
  );
  SQL = await initSqlJs({ wasmBinary });

  const path = dbPath();
  mkdirSync(join(path, '..'), { recursive: true });

  if (existsSync(path)) {
    const buffer = readFileSync(path);
    const data = new Uint8Array(buffer.byteLength);
    data.set(buffer);
    db = new SQL.Database(data);
  } else {
    db = new SQL.Database();
  }

  applySchema(db);
  console.log(`[db] initialized at ${path}`);
  return db;
}

function applySchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      display_name TEXT NOT NULL,
      external_id TEXT NOT NULL,
      access_token_encrypted BLOB,
      refresh_token_encrypted BLOB,
      expires_at INTEGER,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(platform, external_id)
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);

    -- v2：發布紀錄與草稿
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      description TEXT,
      hashtags TEXT,
      privacy TEXT,
      file_path TEXT,
      file_name TEXT,
      thumbnail_path TEXT,
      content_json TEXT,
      status TEXT NOT NULL,
      job_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

    CREATE TABLE IF NOT EXISTS post_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      account_id INTEGER,
      account_name TEXT,
      status TEXT NOT NULL,
      remote_id TEXT,
      remote_url TEXT,
      error_message TEXT,
      finished_at INTEGER,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE(post_id, platform)
    );

    CREATE INDEX IF NOT EXISTS idx_targets_post ON post_targets(post_id);
  `);

  const versionRow = queryOne<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = versionRow?.version ?? 0;
  if (currentVersion < 1) {
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      1,
      Date.now()
    ]);
  }
  if (currentVersion < 2) {
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      2,
      Date.now()
    ]);
  }
  if (currentVersion < 3) {
    // v3：加 scheduled_at 欄位（排程功能）
    try {
      database.run('ALTER TABLE posts ADD COLUMN scheduled_at INTEGER');
    } catch (e) {
      // 欄位已存在 → 忽略
      console.log('[db] alter posts add scheduled_at:', (e as Error).message);
    }
    database.run('CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at) WHERE scheduled_at IS NOT NULL');
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      3,
      Date.now()
    ]);
  }

  if (currentVersion < 4) {
    // v4：Meta long-lived user token，獨立存放用於每日自動續期
    database.run(`
      CREATE TABLE IF NOT EXISTS meta_user_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fb_user_id TEXT UNIQUE NOT NULL,
        fb_user_name TEXT,
        access_token_encrypted BLOB NOT NULL,
        expires_at INTEGER NOT NULL,
        last_refresh_at INTEGER,
        last_refresh_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_meta_user_tokens_expires ON meta_user_tokens(expires_at);
    `);
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      4,
      Date.now()
    ]);
  }

  if (currentVersion < 5) {
    // v5：posts 加 post_type 欄位（區分影片 / 圖文）
    // 預設 'video'，舊資料保持 video 不影響
    try {
      database.run("ALTER TABLE posts ADD COLUMN post_type TEXT NOT NULL DEFAULT 'video'");
    } catch (e) {
      console.log('[db] alter posts add post_type:', (e as Error).message);
    }
    database.run('CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type)');
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      5,
      Date.now()
    ]);
  }

  if (currentVersion < 6) {
    // v6：watched_folders 表（v0.4.1 資料夾監聽自動排程）
    database.run(`
      CREATE TABLE IF NOT EXISTS watched_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_path TEXT UNIQUE NOT NULL,
        label TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        template_json TEXT NOT NULL,
        next_schedule_at INTEGER NOT NULL,
        interval_hours REAL NOT NULL DEFAULT 24,
        last_processed_at INTEGER,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_watched_enabled ON watched_folders(enabled);
    `);
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      6,
      Date.now()
    ]);
  }

  if (currentVersion < 7) {
    // v7：post_targets 加觸及數據欄位（v0.4.2）
    const cols = [
      'views INTEGER',
      'likes_count INTEGER',
      'comments_count INTEGER',
      'shares_count INTEGER',
      'reach INTEGER',
      'stats_fetched_at INTEGER',
      'stats_error TEXT'
    ];
    for (const col of cols) {
      try {
        database.run(`ALTER TABLE post_targets ADD COLUMN ${col}`);
      } catch (e) {
        // 欄位已存在或其他失敗 → 忽略
        console.log(`[db] alter post_targets add ${col}:`, (e as Error).message);
      }
    }
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      7,
      Date.now()
    ]);
  }

  if (currentVersion < 8) {
    // v8：tunnel 設定（v0.5.0 named tunnel 支援）
    //   - app_settings：通用 key-value 設定（含 tunnel_mode）
    //   - tunnel_configs：named tunnel 加密 token + hostname
    database.run(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tunnel_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL UNIQUE,
        encrypted_token BLOB NOT NULL,
        public_hostname TEXT NOT NULL,
        last_verified_at INTEGER,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      8,
      Date.now()
    ]);
  }

  if (currentVersion < 9) {
    // v9：v0.6.0 PostMode tri-state — 把現有 image post 中是 carousel 的（content_json 有 imageCarouselPaths.length >= 2）
    // 升級成 'carousel'，其他 image 保持 'image'，影片保持 'video'。
    // posts.post_type 欄位是 TEXT 不需 ALTER，只需 data migration。
    try {
      const rows = database.exec(
        "SELECT id, content_json FROM posts WHERE post_type = 'image' AND content_json IS NOT NULL"
      );
      if (rows.length > 0 && rows[0].values) {
        for (const row of rows[0].values) {
          const postId = row[0] as number;
          const contentJson = row[1] as string;
          try {
            const parsed = JSON.parse(contentJson);
            const carouselPaths = parsed?.imageCarouselPaths;
            if (Array.isArray(carouselPaths) && carouselPaths.length >= 1) {
              // 主圖 + carouselPaths >= 1 個 → 至少 2 張 → carousel
              execute("UPDATE posts SET post_type = 'carousel' WHERE id = ?", [postId]);
            }
          } catch {
            /* 略過解析失敗 */
          }
        }
      }
    } catch (e) {
      console.warn('[db] v9 carousel migration failed:', (e as Error).message);
    }
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      9,
      Date.now()
    ]);
  }

  if (currentVersion < 10) {
    // v10：v0.6.1 內文範本（content_templates）
    //   - 讓使用者把常用的標題模板/描述/hashtag/平台設定存起來，下次套用即可
    database.run(`
      CREATE TABLE IF NOT EXISTS content_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        mode TEXT NOT NULL DEFAULT 'any',
        title_template TEXT,
        description TEXT,
        hashtags TEXT,
        privacy TEXT,
        per_platform_json TEXT,
        target_accounts_json TEXT,
        use_count INTEGER NOT NULL DEFAULT 0,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_templates_mode ON content_templates(mode);
      CREATE INDEX IF NOT EXISTS idx_templates_last_used ON content_templates(last_used_at DESC);
    `);
    execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      10,
      Date.now()
    ]);
  }
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  stmt.bind(params as never);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T | null {
  const rows = query<T>(sql, params);
  return rows[0] ?? null;
}

export function execute(sql: string, params: unknown[] = []): void {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  stmt.bind(params as never);
  stmt.step();
  stmt.free();
  scheduleSave();
}

export function insertAndGetId(sql: string, params: unknown[] = []): number {
  execute(sql, params);
  const row = queryOne<{ id: number }>('SELECT last_insert_rowid() AS id');
  return row?.id ?? -1;
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDatabaseNow, SAVE_DEBOUNCE_MS);
}

function saveDatabaseNow(): void {
  if (!db) return;
  try {
    const data = db.export();
    writeFileSync(dbPath(), data);
  } catch (e) {
    console.error('[db] save failed:', e);
  }
}

/** 強制立即落盤（取消 debounce + 同步寫硬碟），給關鍵寫入如排程建立用 */
export function flushDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveDatabaseNow();
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveDatabaseNow();
  db?.close();
  db = null;
  console.log('[db] closed');
}
