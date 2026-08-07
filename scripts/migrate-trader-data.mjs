#!/usr/bin/env node
// 迁移短线交易历史数据到 SQLite (kline.db → trader_store)
// Usage: node scripts/migrate-trader-data.mjs
import fs from 'fs';
import path from 'path';
import { homedir } from 'node:os';
import Database from 'better-sqlite3';

const AGENT_DIR = path.join(homedir(), '.donew-trader');
const DB_PATH = process.env.KLINE_DB_PATH || path.join(AGENT_DIR, 'kline.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS trader_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const files = {
  positions: path.join(AGENT_DIR, 'positions.json'),
  orders: path.join(AGENT_DIR, 'orders.json'),
  stats: path.join(AGENT_DIR, 'stats.json'),
};

let total = 0;
for (const [key, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.log(`跳过 ${key}: 文件不存在`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  db.prepare('INSERT OR REPLACE INTO trader_store (key, value) VALUES (?, ?)')
    .run(key, JSON.stringify(data));
  const cnt = Array.isArray(data) ? data.length : 'object';
  total++;
  console.log(`✅ ${key}: ${cnt} 已导入`);
}

// 迁移 signals 目录
const signalsDir = path.join(AGENT_DIR, 'signals');
if (fs.existsSync(signalsDir)) {
  for (const f of fs.readdirSync(signalsDir)) {
    if (!f.endsWith('.json')) continue;
    const symbol = f.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(signalsDir, f), 'utf8'));
    db.prepare('INSERT OR REPLACE INTO trader_store (key, value) VALUES (?, ?)')
      .run('signals_' + symbol, JSON.stringify(data));
    total++;
    console.log(`✅ signals_${symbol}: ${data.length} 条已导入`);
  }
}

console.log(`\n完成: 共迁移 ${total} 个键到 ${DB_PATH}`);
console.log('\n=== 验证 ===');
for (const row of db.prepare('SELECT key, length(value) as bytes FROM trader_store').all()) {
  console.log(`${row.key}: ${row.bytes} bytes`);
}
db.close();
