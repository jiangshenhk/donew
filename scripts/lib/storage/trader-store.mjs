// trader-store.mjs — 共享 SQLite key-value 存储原语
// 只负责 SQLite trader_store 的 get/put，不打开数据库、不建表、不内置 JSON fallback
// 通过注入 getDb/ensureReady/SQL 保留三个机器人现有行为差异

export function createTraderKvStore({
  getDb,                 // () => 已存在的连接或 null
  ensureReady = null,    // 可选；短线注入 ensureStoreTable
  selectSql = 'SELECT value FROM trader_store WHERE key=?',
  upsertSql,
  parse = JSON.parse,
  stringify = JSON.stringify,
}) {
  return {
    // 无连接、ensure失败、key缺失、查询失败、JSON解析失败均返回 null
    get(key) {
      try {
        const db = getDb();
        if (!db) return null;
        if (ensureReady && !ensureReady()) return null;
        const row = db.prepare(selectSql).get(key);
        if (!row) return null;
        return parse(row.value);
      } catch {
        return null;
      }
    },

    // 无连接、ensure失败、序列化失败、SQL失败均返回 false；成功返回 true
    put(key, value) {
      try {
        const db = getDb();
        if (!db) return false;
        if (ensureReady && !ensureReady()) return false;
        const serialized = stringify(value);
        db.prepare(upsertSql).run(key, serialized);
        return true;
      } catch {
        return false;
      }
    },
  };
}
