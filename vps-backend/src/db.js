import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from './config.js';

const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_prices (
    symbol TEXT NOT NULL,
    category TEXT,
    name TEXT,
    price REAL,
    previous_close REAL,
    change_percent TEXT,
    market_time TEXT,
    currency TEXT,
    exchange TEXT,
    market_state TEXT,
    sma5 REAL,
    sma10 REAL,
    vs5_pct TEXT,
    vs10_pct TEXT,
    bar_count INTEGER,
    quote_source TEXT DEFAULT 'yahoo-chart',
    previous_close_source TEXT,
    previous_close_date TEXT,
    latest_bar_date TEXT,
    market_date TEXT,
    previous_close_gap_note TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    error TEXT,
    PRIMARY KEY (symbol, updated_at)
  );

  CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol_updated
    ON stock_prices(symbol, updated_at DESC);

  CREATE TABLE IF NOT EXISTS jin10_news (
    id TEXT PRIMARY KEY,
    time TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    categories TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_jin10_news_time ON jin10_news(time DESC);

  CREATE TABLE IF NOT EXISTS fetch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
