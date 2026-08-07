#!/usr/bin/env node
// 迁移长线/SellPut 历史交易数据到 SQLite
// Usage: node scripts/migrate-long-sellput-data.mjs
import fs from 'fs';
import path from 'path';
import { homedir } from 'node:os';
import Database from 'better-sqlite3';

function migrateDir(dirName, dbFileName) {
  const dir = path.join(homedir(), dirName);
  const dbPath = process.env[dbFileName.toUpperCase().replace(/-/g, '_') + '_PATH'] || path.join(dir, dbFileName);
  if (!fs.existsSync(dir)) { console.log(`${dirName}: 目录不存在，跳过`); return; }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS trader_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);

  const files = ['positions', 'orders', 'stats', 'experience', 'pool'];
  let total = 0;
  for (const key of files) {
    const f = path.join(dir, key + '.json');
    if (!fs.existsSync(f)) continue;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    db.prepare('INSERT OR REPLACE INTO trader_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(data));
    const cnt = Array.isArray(data) ? data.length : 'object';
    total++;
    console.log(`  ✅ ${dirName}/${key}.json (${cnt})`);
  }

  // signals
  const sigDir = path.join(dir, 'signals');
  if (fs.existsSync(sigDir)) {
    for (const f of fs.readdirSync(sigDir)) {
      if (!f.endsWith('.json')) continue;
      const symbol = f.replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(sigDir, f), 'utf8'));
      db.prepare('INSERT OR REPLACE INTO trader_store (key, value) VALUES (?, ?)').run('signals_' + symbol, JSON.stringify(data));
      total++;
      console.log(`  ✅ ${dirName}/signals/${f}`);
    }
  }

  // journal (sellput)
  const jDir = path.join(dir, 'journal');
  if (fs.existsSync(jDir)) {
    const entries = fs.readdirSync(jDir).filter(f => f.endsWith('.json'));
    for (const f of entries) {
      const data = JSON.parse(fs.readFileSync(path.join(jDir, f), 'utf8'));
      const key = 'journal_' + f.replace('.json', '');
      db.prepare('INSERT OR REPLACE INTO trader_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(data));
      total++;
    }
    if (entries.length) console.log(`  ✅ ${dirName}/journal (${entries.length} 条)`);
  }

  console.log(`${dirName}: 共迁移 ${total} 键 → ${dbPath}`);
  db.close();
}

console.log('=== 迁移长线 ===');
migrateDir('.donew-trader-long', 'long.db');
console.log('\n=== 迁移 SellPut ===');
migrateDir('.donew-agent', 'agent.db');
console.log('\n完成');
