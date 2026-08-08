// optional-sqlite.mjs — 可选 SQLite 打开流程（共享）
// 只共享：创建父目录、加载构造器、打开连接、设置 WAL、调用 setup、失败返回 null
// 不接收 schema、不决定 DB 路径、不关闭/迁移现有 DB

import fs from 'node:fs';
import path from 'node:path';

export async function openOptionalSqlite({
  dbPath,
  loadDatabase = () => import('better-sqlite3').then(m => m.default),
  fsImpl = fs,
  journalMode = 'WAL',
  setup = null,                 // (db) => 执行调用方 schema SQL
}) {
  try {
    fsImpl.mkdirSync(path.dirname(dbPath), { recursive: true });
    const Database = await loadDatabase();
    const db = new Database(dbPath);
    if (journalMode) db.pragma(`journal_mode = ${journalMode}`);
    if (setup) setup(db);
    return db;
  } catch {
    return null;
  }
}
