#!/usr/bin/env node
// short-term-trader.mjs — Short-Term K-line Trader v2.0.6  (2026-08-06: K线过期检测/dashboard K线状态显示/旧K线阻断信号)
// 5分钟K线短线交易机器人，DeepSeek AI + 技术指标分析
// 纸面模拟交易：QQQ / IBIT / MSTR
// 数据存储：~/.donew-trader/（独立于仓库，不 commit）
//
// Usage: node scripts/short-term-trader.mjs [run|dashboard|stats|positions|setup|env|version]
// Env:   DEEPSEEK_API_KEY（必需）

import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import http from 'node:http';

// ─── Constants ───────────────────────────────────────────────

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const AGENT_DIR = path.join(homedir(), '.donew-trader');
const ENV_FILE = path.join(AGENT_DIR, '.env');
const CONFIG_FILE = path.join(AGENT_DIR, 'config.json');
const POSITIONS_FILE = path.join(AGENT_DIR, 'positions.json');
const ORDERS_FILE = path.join(AGENT_DIR, 'orders.json');
const STATS_FILE = path.join(AGENT_DIR, 'stats.json');
const SIGNALS_DIR = path.join(AGENT_DIR, 'signals');
const KLINE_DIR = path.join(AGENT_DIR, 'kline');
const DASHBOARD_FILE = path.join(AGENT_DIR, 'dashboard.html');
const RUN_LOCK_FILE   = path.join(AGENT_DIR, 'short-term-trader.lock');

// ─── SQLite 统一缓存（K线）────────────────────────
let klineDb = null;
async function initKlineDb() {
  if (klineDb) return klineDb;
  try {
    const dbPath = process.env.KLINE_DB_PATH || path.join(AGENT_DIR, 'kline.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS kline_5m (
        symbol TEXT NOT NULL,
        t INTEGER NOT NULL,
        o REAL, h REAL, l REAL, c REAL, v REAL,
        source TEXT DEFAULT 'yahoo',
        saved_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (symbol, t)
      );
      CREATE INDEX IF NOT EXISTS idx_kline_5m_symbol_t ON kline_5m(symbol, t DESC);
    `);
    klineDb = db;
  } catch {
    klineDb = null;
  }
  return klineDb;
}

function loadKlineFromDb(symbol) {
  try {
    if (!klineDb) return null;
    const rows = klineDb.prepare('SELECT t,o,h,l,c,v FROM kline_5m WHERE symbol=? ORDER BY t ASC').all(symbol);
    if (!rows.length) return null;
    return { bars: rows.map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v })) };
  } catch { return null; }
}

function saveKlineToDb(symbol, bars) {
  try {
    if (!klineDb || !bars?.length) return;
    const insert = klineDb.prepare('INSERT OR REPLACE INTO kline_5m (symbol,t,o,h,l,c,v) VALUES (?,?,?,?,?,?,?)');
    const tx = klineDb.transaction((items) => {
      for (const b of items) insert.run(symbol, b.t, b.o, b.h, b.l, b.c, b.v);
    });
    tx(bars);
    const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
    klineDb.prepare('DELETE FROM kline_5m WHERE symbol=? AND t<?').run(symbol, cutoff);
  } catch { /* 写库失败不阻塞 */ }
}

const VERSION = 'v2.3.0';
const VERSION_NOTE = '2026-08-07 | 持仓/订单/统计/信号全部入SQLite统一存储';
const RANGE = '5d';
const INTERVAL = '5m';
const AI_TIMEOUT = 30000;
const NTFY_TOPIC = 'dudiaozhangtest112233';
const NTFY_TOKEN = 'tk_yw31dbl7scelalsvk3rhc0fhqvei6';
const NTFY_SERVER = 'https://ntfy.sh';

const DEFAULT_CONFIG = {
  symbols: ['QQQ','IBIT','MSTR','TSLA','EEM','BTC-USD','UGL','FUTU','QLD','INTC'],
  capital: 100000,
  positionSize: 10000,
  maxPositions: 5,
  model: 'deepseek-v4-flash',
};

const USA_MARKET_OPEN = { hour: 9, minute: 30 };
const USA_MARKET_CLOSE = { hour: 16, minute: 0 };

// ─── Helpers ──────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJson(fpath) {
  try { return JSON.parse(fs.readFileSync(fpath, 'utf-8')); }
  catch { return null; }
}

function saveJson(fpath, data) {
  ensureDir(path.dirname(fpath));
  const tmp = `${fpath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, fpath);
  } finally {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
  }
}

function readApiKey() {
  const env = process.env.DEEPSEEK_API_KEY;
  if (env) return env;
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = content.match(/DEEPSEEK_API_KEY\s*=\s*(.+)/);
    return match ? match[1].trim().replace(/["']/g, '') : null;
  } catch { return null; }
}

function acquireRunLock() {
  const staleMs = 30 * 60 * 1000;
  const create = () => {
    const fd = fs.openSync(RUN_LOCK_FILE, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
  };
  try { create(); }
  catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = loadJson(RUN_LOCK_FILE) || {};
    const age = Date.now() - (Date.parse(existing.startedAt) || fs.statSync(RUN_LOCK_FILE).mtimeMs);
    const liveProcess = processExists(Number(existing.pid));
    if (liveProcess || (!existing.pid && age <= staleMs)) {
      console.log(`\u26A0 \u5DF2\u6709\u4EFB\u52A1\u8FD0\u884C\u4E2D (PID ${existing.pid}, ${Math.floor(age/1000)}s\u524D)`);
      return null;
    }
    fs.unlinkSync(RUN_LOCK_FILE);
    create();
  }
  return () => {
    try {
      const current = loadJson(RUN_LOCK_FILE);
      if (!current || Number(current.pid) === process.pid) fs.unlinkSync(RUN_LOCK_FILE);
    } catch {}
  };
}

function processExists(pid) {
  if (!pid || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function fmtNodeDate(t) { var d = new Date(t), p = function(n){ return (n < 10 ? '0' : '') + n; }; return p(d.getMonth()+1) + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }

function fmtTimeET(ts) {
  const d = new Date(ts instanceof Date ? ts : ts * 1000);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
}

function fmtTimeShort(ts) {
  const d = new Date(ts instanceof Date ? ts : ts * 1000);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
}

function hkNow() {
  const d = new Date();
  const hk = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  return hk;
}

function etNow() {
  const now = new Date();
  const opts = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
  const get = (t) => parts.find(p => p.type === t)?.value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-05:00`);
}

function num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
}

function yahooSymbol(symbol) {
  const value = String(symbol || '').trim().toUpperCase();
  if (['BTC', 'BTCUSD', 'BTC/USD', 'XBTUSD'].includes(value)) return 'BTC-USD';
  return value;
}

// ─── Market Hours ──────────────────────────────────────────────

function etTimeParts() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  return { weekday: get('weekday'), hour: parseInt(get('hour'), 10), minute: parseInt(get('minute'), 10) };
}

function isMarketOpen() {
  const et = etTimeParts();
  if (et.weekday === 'Sat' || et.weekday === 'Sun') return false;
  const totalMin = et.hour * 60 + et.minute;
  const openMin = USA_MARKET_OPEN.hour * 60 + USA_MARKET_OPEN.minute;
  const closeMin = USA_MARKET_CLOSE.hour * 60 + USA_MARKET_CLOSE.minute;
  return totalMin >= openMin && totalMin < closeMin;
}

function isMarketDay() {
  const et = etTimeParts();
  return et.weekday !== 'Sat' && et.weekday !== 'Sun';
}

function is24hSymbol(symbol) {
  return /BTC|ETH|SOL|DOGE|USDT/i.test(symbol);
}

function isHkSymbol(symbol) {
  return /\.HK$/i.test(symbol);
}

// 港股交易时段：周一至五 09:30-16:00 香港时间（含午休，简化处理）
function hkTimeParts() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  return { weekday: get('weekday'), hour: parseInt(get('hour'), 10), minute: parseInt(get('minute'), 10) };
}

function isHkMarketOpen() {
  const hk = hkTimeParts();
  if (hk.weekday === 'Sat' || hk.weekday === 'Sun') return false;
  const totalMin = hk.hour * 60 + hk.minute;
  return totalMin >= 570 && totalMin < 960; // 09:30 - 16:00
}

// ─── Data Management ───────────────────────────────────────────

function loadConfig() {
  const saved = loadJson(CONFIG_FILE);
  if (saved && Array.isArray(saved.symbols)) return saved;
  saveJson(CONFIG_FILE, DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) { saveJson(CONFIG_FILE, config); }

// ─── SQLite 交易数据存储（统一入数据库）────────────
function ensureStoreTable() {
  try {
    if (!klineDb) return false;
    klineDb.exec(`
      CREATE TABLE IF NOT EXISTS trader_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    return true;
  } catch { return false; }
}

function loadFromStore(key, fallback) {
  try {
    if (!ensureStoreTable()) return fallback;
    const row = klineDb.prepare('SELECT value FROM trader_store WHERE key=?').get(key);
    if (!row) return fallback;
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function saveToStore(key, data) {
  try {
    if (!ensureStoreTable()) return false;
    klineDb.prepare('INSERT OR REPLACE INTO trader_store (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))')
      .run(key, JSON.stringify(data));
    return true;
  } catch { return false; }
}

function loadPositions() {
  const dbData = loadFromStore('positions', null);
  if (dbData) return dbData;
  return loadJson(POSITIONS_FILE) || [];
}
function savePositions(data) {
  const saved = saveToStore('positions', data);
  if (!saved) saveJson(POSITIONS_FILE, data);
}

function loadOrders() {
  const dbData = loadFromStore('orders', null);
  if (dbData) return dbData;
  return loadJson(ORDERS_FILE) || [];
}
function saveOrders(data) {
  const saved = saveToStore('orders', data);
  if (!saved) saveJson(ORDERS_FILE, data);
}

function loadStats() {
  const dbData = loadFromStore('stats', null);
  if (dbData && typeof dbData.totalTrades === 'number') return dbData;
  const s = loadJson(STATS_FILE);
  if (s && typeof s.totalTrades === 'number') return s;
  return { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0, netPnL: 0, winRate: 0, maxDrawdown: 0, avgWin: 0, avgLoss: 0, bySymbol: {}, dailyPnL: {}, consecutiveLosses: 0 };
}

function saveStats(data) {
  const saved = saveToStore('stats', data);
  if (!saved) saveJson(STATS_FILE, data);
}

function loadSignals(symbol) {
  const dbData = loadFromStore('signals_' + symbol, null);
  if (dbData) return dbData;
  const fpath = path.join(SIGNALS_DIR, symbol + '.json');
  return loadJson(fpath) || [];
}

function saveSignals(symbol, data) {
  const saved = saveToStore('signals_' + symbol, data);
  if (!saved) {
    const fpath = path.join(SIGNALS_DIR, symbol + '.json');
    saveJson(fpath, data);
  }
}

function normalizeFiveMinuteBars(bars) {
  const buckets = new Map();
  for (const source of (bars || [])) {
    const rawTime = Number(source?.t);
    const open = num(source?.o);
    const high = num(source?.h);
    const low = num(source?.l);
    const close = num(source?.c);
    if (![rawTime, open, high, low, close].every(Number.isFinite)) continue;

    // Yahoo's unfinished latest candle may carry the request second. It still
    // belongs to the five-minute bucket that started before that timestamp.
    const bucketTime = Math.floor(rawTime / 300) * 300;
    const previous = buckets.get(bucketTime);
    if (!previous || rawTime >= previous.rawTime) {
      buckets.set(bucketTime, {
        rawTime,
        bar: { t: bucketTime, o: open, h: high, l: low, c: close, v: num(source?.v) || 0 },
      });
    }
  }
  return [...buckets.values()].map(item => item.bar).sort((a, b) => a.t - b.t);
}

function loadKlineCache(symbol) {
  const dbData = loadKlineFromDb(symbol);
  return dbData?.bars?.length ? dbData : null;
}

function saveKlineCache(symbol, newData) {
  const existing = loadKlineFromDb(symbol);
  const merged = normalizeFiveMinuteBars([
    ...(existing?.bars || []),
    ...(newData?.bars || []),
  ]);
  if (!merged.length) return;
  saveKlineToDb(symbol, merged);
}

// ─── Kline Staleness (5-min) ──────────────────────────────────

function lastBarTimeOfIntraday(bars) {
  return bars?.at(-1)?.t || null;
}

function isFiveMinuteKlineStale(symbol, bars, now = new Date()) {
  if (!bars || bars.length < 1) return { stale: true, reason: '\u65E0K\u7EBF\u6570\u636E' };
  const lastBarT = Number(bars.at(-1).t);
  if (!lastBarT || lastBarT <= 0) return { stale: true, reason: 'K\u7EBF\u65F6\u95F4\u5F02\u5E38' };
  const lastBarMs = lastBarT < 1e12 ? lastBarT * 1000 : lastBarT;
  const nowMs = now.getTime();
  const diffMin = Math.floor((nowMs - lastBarMs) / 60000);
  const isCrypto = /^(BTC|ETH|SOL|XRP)-/.test(symbol);
  if (isCrypto) {
    if (diffMin > 30) return { stale: true, reason: `${diffMin}\u5206\u949F\u672A\u66F4\u65B0`, lastBarTime: new Date(lastBarMs).toISOString() };
    return { stale: false, reason: '', lastBarTime: new Date(lastBarMs).toISOString() };
  }
  const nowEst = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const estHour = nowEst.getHours();
  const estMin = nowEst.getMinutes();
  const estDay = nowEst.getDay();
  const isWeekday = estDay >= 1 && estDay <= 5;
  const inMarketHours = isWeekday && ((estHour > 9 || (estHour === 9 && estMin >= 30)) && estHour < 16);
  if (inMarketHours) {
    if (diffMin > 15) return { stale: true, reason: `${diffMin}\u5206\u949F\u672A\u66F4\u65B0`, lastBarTime: new Date(lastBarMs).toISOString() };
    return { stale: false, reason: '', lastBarTime: new Date(lastBarMs).toISOString() };
  }
  if (diffMin > 600) return { stale: true, reason: '\u975E\u4EA4\u6613\u65F6\u6BB510h+', lastBarTime: new Date(lastBarMs).toISOString() };
  return { stale: false, reason: '\u975E\u4EA4\u6613\u65F6\u6BB5', lastBarTime: new Date(lastBarMs).toISOString() };
}

function recalcStats(orders) {
  const closed = orders.filter(o => o.action === 'CLOSE' && o.pnl != null);
  const wins = closed.filter(o => o.pnl > 0);
  const losses = closed.filter(o => o.pnl < 0);
  const totalPnL = closed.reduce((s, o) => s + (o.pnl || 0), 0);

  let peak = 0; let drawdown = 0; let running = 0;
  for (const o of closed) {
    running += (o.pnl || 0);
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > drawdown) drawdown = dd;
  }

  const bySymbol = {};
  for (const o of closed) {
    if (!bySymbol[o.symbol]) bySymbol[o.symbol] = { trades: 0, wins: 0, losses: 0, pnl: 0 };
    bySymbol[o.symbol].trades++;
    bySymbol[o.symbol].pnl += o.pnl || 0;
    if (o.pnl > 0) bySymbol[o.symbol].wins++;
    if (o.pnl < 0) bySymbol[o.symbol].losses++;
  }

  const avgWin = wins.length ? wins.reduce((s, o) => s + o.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, o) => s + o.pnl, 0) / losses.length : 0;

  let consecutiveLosses = 0; let maxConsec = 0;
  for (const o of closed) {
    if (o.pnl < 0) { consecutiveLosses++; if (consecutiveLosses > maxConsec) maxConsec = consecutiveLosses; }
    else { consecutiveLosses = 0; }
  }

  const dailyPnL = {};
  for (const o of closed) {
    const date = o.closedAt ? o.closedAt.split('T')[0] : o.time.split('T')[0];
    dailyPnL[date] = (dailyPnL[date] || 0) + (o.pnl || 0);
  }

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    totalPnL: Math.round(totalPnL * 100) / 100,
    netPnL: Math.round(totalPnL * 100) / 100,
    winRate: closed.length ? Math.round(wins.length / closed.length * 10000) / 100 : 0,
    maxDrawdown: Math.round(drawdown * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    bySymbol,
    dailyPnL,
    consecutiveLosses: maxConsec,
    currentConsecutive: consecutiveLosses,
  };
}

// ─── Yahoo Finance ──────────────────────────────────────────────

async function fetchYahooBars(symbol) {
  const resolvedSymbol = yahooSymbol(symbol);
  const url = `${YAHOO_BASE}/${encodeURIComponent(resolvedSymbol)}?range=${RANGE}&interval=${INTERVAL}&events=history&includePrePost=false`;
  let timer;
  try {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-trader/1.0)' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      bars.push({
        t: timestamps[i],
        o: num(opens[i]),
        h: num(highs[i]),
        l: num(lows[i]),
        c: num(closes[i]),
        v: num(volumes[i]) || 0,
      });
    }
    return { bars, meta: result.meta };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── Technical Indicators ──────────────────────────────────────

function calcEMA(values, period) {
  if (!values || values.length < period) return values?.[values.length - 1] || null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return Math.round(ema * 100) / 100;
}

function calcMACD(closes) {
  if (!closes || closes.length < 26) return { dif: null, dea: null, hist: null };
  const ema12 = calcEMAForSeries(closes, 12);
  const ema26 = calcEMAForSeries(closes, 26);
  const dif = ema12.map((v, i) => (v != null && ema26[i] != null) ? v - ema26[i] : null).filter(v => v != null);

  const dea = calcEMAForSeries(dif, 9);
  const lastDif = dif[dif.length - 1] || null;
  const lastDea = dea[dea.length - 1] || null;
  const hist = (lastDif != null && lastDea != null) ? (lastDif - lastDea) * 2 : null;

  return {
    dif: lastDif ? Math.round(lastDif * 1000) / 1000 : null,
    dea: lastDea ? Math.round(lastDea * 1000) / 1000 : null,
    hist: hist ? Math.round(hist * 1000) / 1000 : null,
  };
}

function calcEMAForSeries(values, period) {
  const result = new Array(values.length).fill(null);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gains = 0; let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

function calcATR(bars, period = 14) {
  if (!bars || bars.length < period + 1) return null;
  let atr = 0;
  const startIdx = bars.length - period - 1;
  // First ATR: simple average of TR
  for (let i = startIdx + 1; i <= startIdx + period; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    const tr = Math.max(curr.h - curr.l, Math.abs(curr.h - prev.c), Math.abs(curr.l - prev.c));
    atr += tr;
  }
  atr /= period;
  // Smooth remaining
  for (let i = startIdx + period + 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    const tr = Math.max(curr.h - curr.l, Math.abs(curr.h - prev.c), Math.abs(curr.l - prev.c));
    atr = (atr * (period - 1) + tr) / period;
  }
  return Math.round(atr * 1000) / 1000;
}

function findKeyLevels(bars, lookback = 50) {
  if (!bars || bars.length < 10) return { supports: [], resistances: [] };

  const recent = bars.slice(-lookback);
  const highs = recent.map(b => b.h);
  const lows = recent.map(b => b.l);

  // Find local maxima and minima
  const localMax = [];
  const localMin = [];
  for (let i = 3; i < recent.length - 3; i++) {
    const isMax = recent[i].h >= Math.max(...recent.slice(i - 3, i + 4).map(b => b.h));
    const isMin = recent[i].l <= Math.min(...recent.slice(i - 3, i + 4).map(b => b.l));
    if (isMax) localMax.push(recent[i].h);
    if (isMin) localMin.push(recent[i].l);
  }

  // Cluster nearby levels
  const cluster = (values, threshold = 0.005) => {
    if (!values.length) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const clusters = [];
    let current = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const lastMean = current.reduce((a, b) => a + b, 0) / current.length;
      if (Math.abs(sorted[i] - lastMean) / lastMean < threshold) {
        current.push(sorted[i]);
      } else {
        clusters.push(current.reduce((a, b) => a + b, 0) / current.length);
        current = [sorted[i]];
      }
    }
    clusters.push(current.reduce((a, b) => a + b, 0) / current.length);
    return clusters;
  };

  const currentPrice = bars[bars.length - 1].c;
  const supports = cluster(localMin.filter(v => v < currentPrice)).map(v => Math.round(v * 100) / 100).sort((a, b) => b - a).slice(0, 3);
  const resistances = cluster(localMax.filter(v => v > currentPrice)).map(v => Math.round(v * 100) / 100).sort((a, b) => a - b).slice(0, 3);

  return { supports, resistances };
}

function computeIndicators(bars) {
  if (!bars || bars.length < 20) return null;

  const closes = bars.map(b => b.c);
  const last30 = bars.slice(-30);

  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema55 = calcEMA(closes, 55);
  const macd = calcMACD(closes);
  const rsi = calcRSI(closes, 14);
  const atr = calcATR(bars, 14);
  const keyLevels = findKeyLevels(bars, 50);

  // Volume analysis
  const recentVolumes = last30.map(b => b.v);
  const validVolumes = recentVolumes.filter(v => v > 0);
  const avgVolume = validVolumes.length > 0 ? validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length : 0;
  const lastVolume = validVolumes.length > 0 ? validVolumes[validVolumes.length - 1] : 0;
  const volumeRatio = avgVolume > 0 ? Math.round(lastVolume / avgVolume * 100) / 100 : 1;

  return {
    ema9, ema21, ema55,
    macd,
    rsi,
    atr,
    keyLevels,
    volumeRatio,
    price_vs_ema9: (closes[closes.length - 1] - ema9) / ema9 * 100,
    price_vs_ema21: (closes[closes.length - 1] - ema21) / ema21 * 100,
  };
}

// ─── Entry Rules + ATR Risk (New flow) ─────────────────────────

function checkTechnicalEntryRules(indicators) {
  if (!indicators) return { triggered: false, details: {} };
  const details = {
    macd: !!(indicators.macd?.hist != null && indicators.macd.hist > 0),
    rsi: !!(indicators.rsi != null && indicators.rsi > 50),
    ema: !!(indicators.price_vs_ema9 != null && indicators.price_vs_ema9 > 0),
    volume: !!(indicators.volumeRatio != null && indicators.volumeRatio > 0.8),
  };
  const passed = [details.macd, details.rsi, details.ema, details.volume].filter(Boolean).length;
  // EMA + Volume must both pass, and total passed >= 3
  const triggered = details.ema && details.volume && passed >= 3;
  return { triggered, details };
}

function calcAtrStopLevels(entryPrice, atr) {
  const minSlPct = 0.004;
  const slDist = Math.max(2.5 * atr, entryPrice * minSlPct);
  const tpDist = slDist * 2;
  return {
    stopLoss: Math.round((entryPrice - slDist) * 100) / 100,
    takeProfit: Math.round((entryPrice + tpDist) * 100) / 100,
  };
}

// ─── ntfy 通知 ──────────────────────────────────────────────────

async function sendNotify(title, message, tags = '') {
  try {
    const res = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NTFY_TOKEN}`,
        'Title': title.replace(/[^\x00-\x7F]/g, '').trim() || 'donew',
        'Priority': '4',
        ...(tags ? { 'Tags': tags } : {}),
        'Markdown': 'yes',
      },
      body: message,
    });
    if (!res.ok) throw new Error('ntfy ' + res.status);
    console.log('  📲 通知: ' + title);
  } catch (e) {
    console.log('  ⚠️ 通知失败: ' + e.message);
  }
}

// ─── DeepSeek ───────────────────────────────────────────────────

async function callDeepSeek(systemPrompt, userMessage) {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY，请在环境变量或 ~/.donew-trader/.env 中设置');

  const model = loadConfig().model || 'deepseek-v4-flash';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepSeek API HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek 返回空内容');

    return JSON.parse(content);
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') throw new Error('DeepSeek 超时');
    throw error;
  }
}

// ─── Signal Generation ──────────────────────────────────────────

function buildScorePrompt(symbol, indicators) {
  const ind = indicators;
  let posSection = '';
  if (ind.keyLevels) {
    posSection = `
关键价位：
- 支撑位: ${ind.keyLevels.supports.map(v => '$' + v).join(', ') || '暂无'}
- 阻力位: ${ind.keyLevels.resistances.map(v => '$' + v).join(', ') || '暂无'}`;
  }

  return `评估 ${symbol} 当前的5分钟K线技术面质量。

技术指标（当前值）：
- EMA(9): $${ind.ema9}  |  价格相对位置: ${ind.price_vs_ema9 > 0 ? '+' : ''}${ind.price_vs_ema9.toFixed(2)}%
- EMA(21): $${ind.ema21}  |  价格相对位置: ${ind.price_vs_ema21 > 0 ? '+' : ''}${ind.price_vs_ema21.toFixed(2)}%
- EMA(55): $${ind.ema55}
- MACD: DIF=${ind.macd.dif}, DEA=${ind.macd.dea}, HIST=${ind.macd.hist}
- RSI(14): ${ind.rsi}
- ATR(14): ${ind.atr}
- 量比: ${ind.volumeRatio}x${posSection}

请对该做多机会评分（1-10分）：
- 1-3分：趋势不明或风险过高
- 4-6分：中性，不确定
- 7-8分：较好做多机会，趋势+动量确认
- 9-10分：强烈做多信号，多指标共振

严格按 JSON 格式返回：
{
  "score": 1-10的整数,
  "reasoning": "中文评分理由，必须提及量比值和关键指标，不超过80字"
}`;
}

async function scoreSetup(symbol, indicators, openPos) {
  if (!indicators) return { score: 0, reasoning: '技术指标不足' };
  if (openPos) return { score: 0, reasoning: '已有持仓' };

  const systemPrompt = '你是一个专业美股短线技术分析师。仅基于5分钟K线技术指标做评分判断，不参考新闻或基本面。';

  const userPrompt = buildScorePrompt(symbol, indicators);

  try {
    const result = await callDeepSeek(systemPrompt, userPrompt);
    const score = Math.min(10, Math.max(1, Math.round(Number(result.score) || 0)));
    const reasoning = String(result.reasoning || '').slice(0, 150);
    return { score, reasoning };
  } catch (error) {
    return { score: 0, reasoning: `AI调用失败: ${error.message}` };
  }
}

// ─── Trade Execution ────────────────────────────────────────────

function openPosition(symbol, signal, currentBar, atr) {
  const config = loadConfig();
  const price = currentBar.c;
  const rawShares = config.positionSize / price;
  const shares = Math.round(rawShares * 100000) / 100000;
  const cost = Math.round(shares * price * 100) / 100;
  if (cost < 10) {
    console.log(`  ⚠️ ${symbol} 仓位不足（$${cost}），跳过`);
    return null;
  }

  const levels = calcAtrStopLevels(price, atr);
  const position = {
    id: `${symbol}_${Date.now()}`,
    symbol,
    entryPrice: price,
    shares,
    cost,
    stopLoss: levels.stopLoss,
    takeProfit: levels.takeProfit,
    entryTime: new Date(currentBar.t * 1000).toISOString(),
    entrySignal: { score: signal.score, reasoning: signal.reasoning, model: loadConfig().model },
    status: 'OPEN',
  };

  const positions = loadPositions();
  positions.push(position);
  savePositions(positions);

  const order = {
    id: position.id,
    symbol,
    action: 'OPEN',
    side: 'BUY',
    price,
    shares,
    cost: position.cost,
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    score: signal.score,
    reasoning: signal.reasoning,
    time: position.entryTime,
    model: loadConfig().model,
  };
  const orders = loadOrders();
  orders.push(order);
  saveOrders(orders);

  // (email notification removed; use ntfy)

  return position;
}

function closePosition(position, reason, closePrice) {
  const positions = loadPositions();
  const idx = positions.findIndex(p => p.id === position.id);
  if (idx === -1) return;

  const p = positions[idx];
  p.closePrice = closePrice;
  p.closeReason = reason;
  p.closeTime = new Date().toISOString();
  p.status = 'CLOSED';
  p.pnl = Math.round((closePrice - p.entryPrice) * p.shares * 100) / 100;
  p.pnlPct = Math.round((closePrice / p.entryPrice - 1) * 10000) / 100;

  savePositions(positions.filter(p => p.status === 'OPEN'));

  const order = {
    id: position.id,
    symbol: p.symbol,
    action: 'CLOSE',
    side: 'SELL',
    price: closePrice,
    shares: p.shares,
    revenue: Math.round(closePrice * p.shares * 100) / 100,
    pnl: p.pnl,
    pnlPct: p.pnlPct,
    reason,
    time: p.closeTime,
    entryTime: p.entryTime,
    entryPrice: p.entryPrice,
  };
  const orders = loadOrders();
  orders.push(order);
  saveOrders(orders);

  // Update stats
  const stats = recalcStats(orders);
  saveStats(stats);

  return p;
}

function checkExits(positions, bars) {
  if (!positions.length || !bars.length) return [];
  const closed = [];
  const currentBar = bars[bars.length - 1];
  const prevBar = bars.length > 1 ? bars[bars.length - 2] : currentBar;

  for (const pos of positions) {
    // Check if position was just recently opened (less than 10 bars ago)
    const entryBarTime = new Date(pos.entryTime).getTime() / 1000;
    const barsSinceEntry = bars.filter(b => b.t >= entryBarTime).length;
    if (barsSinceEntry < 2) continue; // Don't close within 2 bars of entry (avoid noise)

    // Check stop loss: price crossed below stop
    if (prevBar.c >= pos.stopLoss && currentBar.c < pos.stopLoss) {
      const result = closePosition(pos, '止损触发', pos.stopLoss);
      if (result) closed.push({ ...result, exitType: 'STOP_LOSS' });
    }
    // Check take profit: price crossed above target
    else if (prevBar.c <= pos.takeProfit && currentBar.c > pos.takeProfit) {
      const result = closePosition(pos, '止盈触发', pos.takeProfit);
      if (result) closed.push({ ...result, exitType: 'TAKE_PROFIT' });
    }
    // Check intra-bar crossing
    else if (currentBar.l <= pos.stopLoss) {
      const result = closePosition(pos, '止损触发（穿透）', currentBar.o);
      if (result) closed.push({ ...result, exitType: 'STOP_LOSS_GAP' });
    }
    else if (currentBar.h >= pos.takeProfit) {
      const result = closePosition(pos, '止盈触发（穿透）', currentBar.o);
      if (result) closed.push({ ...result, exitType: 'TAKE_PROFIT_GAP' });
    }
  }

  return closed;
}

// ─── Main Run ────────────────────────────────────────────────────

async function run() {
  console.log(`\n┌──────────────────────────────────────────┐`);
  console.log(`│  📊 Short-Term K-line Trader ${VERSION}    │`);
  console.log(`└──────────────────────────────────────────┘\n`);

  await initKlineDb();

  const config = loadConfig();
  console.log(`监控标的: ${config.symbols.join(', ')}`);
  console.log(`资金: $${config.capital.toLocaleString()} | 单笔: $${config.positionSize.toLocaleString()} | 最大持仓: ${config.maxPositions}\n`);

  const marketOpen = isMarketOpen();
  const has24h = config.symbols.some(is24hSymbol);
  const hasHkOpen = config.symbols.some(s => isHkSymbol(s) && isHkMarketOpen());
  if (!marketOpen && !has24h && !hasHkOpen) {
    const et = etNow();
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    console.log(`⏸️  美股未开市（ET ${dayNames[et.getDay()]} ${et.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })}）`);
    console.log('   开市时间: 周一至周五 9:30 AM - 4:00 PM ET');
    return;
  }
  const hkOpenNow = config.symbols.some(isHkSymbol) && isHkMarketOpen();
  console.log(`${marketOpen ? '🟢 美股开市' : '⏸️ 美股休市'}${hkOpenNow ? '｜🟢 港股开市' : ''} | ET ${fmtTimeShort(etNow())} | 24h标的: ${config.symbols.filter(is24hSymbol).join(', ') || '无'} | 港股: ${config.symbols.filter(isHkSymbol).join(', ') || '无'}\n`);

  const releaseLock = acquireRunLock();
  if (!releaseLock) { console.log('⛔ 已有任务运行中，跳过本轮调度'); return; }

  try {

  const positions = loadPositions();
  console.log(`当前持仓: ${positions.length}/${config.maxPositions}`);

  // Step 1: Fetch K-lines → Technical Rules → AI Score → Decision
  const signals = {};

  for (const symbol of config.symbols) {
    // Skip non-24h symbols when US market is closed (unless HK symbol in HK market hours)
    if (!marketOpen && !is24hSymbol(symbol)) {
      if (isHkSymbol(symbol) && isHkMarketOpen()) {
        console.log(`\n━━ ${symbol} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  🟢 港股开市，运行`);
      } else {
        console.log(`\n━━ ${symbol} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  ⏸️  美股休市，跳过`);
        signals[symbol] = { decision: 'SKIP', reasoning: '美股休市' };
        continue;
      }
    }
    console.log(`\n━━ ${symbol} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    process.stdout.write(`  📡 获取5分钟K线...`);

    const data = await fetchYahooBars(symbol);
    if (!data || !data.bars || data.bars.length < 20) {
      console.log(` ❌ 数据不足`);
      signals[symbol] = { decision: 'SKIP', reasoning: 'K线数据不足' };
      continue;
    }

    console.log(` ✅ ${data.bars.length}根K线`);
    saveKlineCache(symbol, {
      date: new Date().toISOString(), bars: data.bars, meta: data.meta,
      klineFetchedAt: new Date().toISOString(),
      klineFetchOk: true,
      klineError: null,
      klineStale: isFiveMinuteKlineStale(symbol, data.bars),
    });

    // Check kline staleness BEFORE generating any signals
    const klineStale = isFiveMinuteKlineStale(symbol, data.bars);
    if (klineStale?.stale) {
      console.log(`  ⚠️  K线过期 (${klineStale.reason})，跳过AI分析`);
      signals[symbol] = { decision: 'SKIP', reasoning: `K线过期: ${klineStale.reason}` };
      continue;
    }

    const lastBar = data.bars[data.bars.length - 1];
    const openPos = positions.find(p => p.symbol === symbol && p.status === 'OPEN');

    // If already holding, skip entirely (don't compute rules or call AI)
    if (openPos) {
      const pnl = Math.round((lastBar.c - openPos.entryPrice) / openPos.entryPrice * 10000) / 100;
      console.log(`  💼 持有仓位: 入场$${openPos.entryPrice} | 止损$${openPos.stopLoss} | 止盈$${openPos.takeProfit}`);
      console.log(`  📈 当前$${lastBar.c} | 浮盈: ${pnl > 0 ? '+' : ''}${pnl}%`);
      signals[symbol] = { decision: 'SKIP', reasoning: '已有持仓' };
      // Still call AI for score (info only, no trade)
      const indicators = computeIndicators(data.bars);
      if (indicators) {
        process.stdout.write(`  🧠 AI评分...`);
        const ai = await scoreSetup(symbol, indicators, false);
        console.log(` ${ai.score}/10`);
        console.log(`     ${ai.reasoning}`);
        const signalHistory = loadSignals(symbol);
        signalHistory.push({
          time: new Date().toISOString(),
          barTime: fmtTimeET(lastBar.t * 1000),
          price: lastBar.c,
          decision: 'SKIP',
          rulesTriggered: false,
          rules: { macd: false, rsi: false, ema: false, volume: false },
          aiScore: ai.score,
          reasoning: `已有持仓 | ${ai.reasoning}`,
          indicators,
        });
        saveSignals(symbol, signalHistory);
      }
      continue;
    }

    // Compute indicators
    const indicators = computeIndicators(data.bars);
    if (!indicators) {
      signals[symbol] = { decision: 'SKIP', reasoning: '技术指标不足' };
      continue;
    }

    // Step A: Technical rules
    const rules = checkTechnicalEntryRules(indicators);
    const ruleIcons = `MACD:${rules.details.macd?'✅':'❌'} RSI:${rules.details.rsi?'✅':'❌'} EMA:${rules.details.ema?'✅':'❌'} Vol:${rules.details.volume?'✅':'❌'}`;

    if (!rules.triggered) {
      console.log(`  ⏸️  技术规则未触发 | ${ruleIcons}`);
      process.stdout.write(`  🧠 AI评分...`);
      const ai = await scoreSetup(symbol, indicators, false);
      console.log(` ${ai.score}/10`);
      console.log(`     ${ai.reasoning}`);
      const signalHistory = loadSignals(symbol);
      signalHistory.push({
        time: new Date().toISOString(),
        barTime: fmtTimeET(lastBar.t * 1000),
        price: lastBar.c,
        decision: 'SKIP',
        rulesTriggered: false,
        rules: rules.details,
        aiScore: ai.score,
        reasoning: ai.reasoning,
        indicators,
      });
      saveSignals(symbol, signalHistory);
      signals[symbol] = { decision: 'SKIP', reasoning: ai.reasoning };
      continue;
    }

    console.log(`  ✅ 技术规则触发 | ${ruleIcons}`);

    // Step B: AI score
    process.stdout.write(`  🧠 AI评分...`);
    const ai = await scoreSetup(symbol, indicators, null);
    console.log(` ${ai.score}/10`);
    console.log(`     ${ai.reasoning}`);

    const decision = ai.score >= 6 ? 'BUY' : 'SKIP';

    // Save signal
    const signalHistory = loadSignals(symbol);
    const signalRecord = {
      time: new Date().toISOString(),
      barTime: fmtTimeET(lastBar.t * 1000),
      price: lastBar.c,
      decision,
      rulesTriggered: true,
      rules: rules.details,
      aiScore: ai.score,
      reasoning: ai.reasoning,
      atr: indicators.atr,
      indicators,
    };
    if (decision === 'BUY') {
      const levels = calcAtrStopLevels(lastBar.c, indicators.atr);
      signalRecord.entryPrice = lastBar.c;
      signalRecord.stopLoss = levels.stopLoss;
      signalRecord.takeProfit = levels.takeProfit;
      // 手机推送 BUY 信号（去重：同标的同K线只推一次）
      const alreadyNotified = signalHistory.some(s => s.barTime === signalRecord.barTime && s.decision === 'BUY');
      if (!alreadyNotified) {
        await sendNotify(
          `📶 BUY信号 ${symbol} $${lastBar.c.toFixed(2)}`,
          `**${symbol}** 技术规则触发 ✅  AI评分: ${ai.score}/10\n\n价格: $${lastBar.c.toFixed(2)}\n止损: $${levels.stopLoss.toFixed(2)} | 止盈: $${levels.takeProfit.toFixed(2)}\n\n${ai.reasoning}`,
          'chart_with_upwards_trend'
        );
      }
    }
    signalHistory.push(signalRecord);
    saveSignals(symbol, signalHistory);

    signals[symbol] = {
      decision,
      score: ai.score,
      reasoning: ai.reasoning,
      atr: indicators.atr,
    };
  }

  // Step 2: Check exits for existing positions
  console.log('\n━━ 持仓检查 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const allExits = [];
  for (const pos of positions) {
    const klineCache = loadKlineCache(pos.symbol);
    if (klineCache?.bars) {
      const exits = checkExits([pos], klineCache.bars);
      allExits.push(...exits);
    }
  }

  if (allExits.length > 0) {
    for (const exit of allExits) {
      const emoji = exit.pnlPct > 0 ? '💰' : '🩸';
      console.log(`  ${emoji} ${exit.symbol} ${exit.exitType}: $${exit.closePrice} | PnL: $${exit.pnl} (${exit.pnlPct > 0 ? '+' : ''}${exit.pnlPct}%) | ${exit.closeReason}`);
      const isWin = exit.pnl > 0;
      await sendNotify(
        `${isWin ? '💰 止盈' : '🩸 止损'} ${exit.symbol} $${exit.closePrice}`,
        `**${exit.symbol}** ${exit.closeReason}\n\n入场: $${exit.entryPrice.toFixed(2)} → 出场: $${exit.closePrice.toFixed(2)}\nPnL: **$${exit.pnl.toFixed(2)}** (${exit.pnlPct > 0 ? '+' : ''}${exit.pnlPct}%)`,
        isWin ? 'moneybag' : 'skull'
      );
    }
  } else {
    console.log('  无触发离场');
  }

  // Step 3: Execute new BUY signals
  console.log('\n━━ 开仓检查 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  let newPositions = 0;
  const updatedPositions = loadPositions();

  for (const symbol of config.symbols) {
    const signal = signals[symbol];
    if (!signal || signal.decision !== 'BUY') continue;

    if (updatedPositions.length + newPositions >= config.maxPositions) {
      console.log(`  ⚠️  ${symbol}: 已达最大持仓 ${config.maxPositions}，跳过`);
      continue;
    }

    const klineCache = loadKlineCache(symbol);
    if (!klineCache?.bars) { console.log(`  ⚠️ ${symbol}: 无法获取K线缓存，跳过`); continue; }

    const openPos = updatedPositions.find(p => p.symbol === symbol && p.status === 'OPEN');
    if (openPos) {
      console.log(`  ⚠️  ${symbol}: 已有持仓，跳过`);
      continue;
    }

    const currentBar = klineCache.bars[klineCache.bars.length - 1];
    const pos = openPosition(symbol, signal, currentBar, signal.atr);
    if (pos) {
      newPositions++;
      console.log(`  ✅ ${symbol}: 开仓 $${pos.entryPrice.toFixed(2)} × ${pos.shares}股 = $${pos.cost.toFixed(2)}`);
      console.log(`     止损: $${pos.stopLoss.toFixed(2)} | 止盈: $${pos.takeProfit.toFixed(2)} | ATR评分: ${signal.score}/10`);
      const risk = Math.round((pos.entryPrice - pos.stopLoss) * pos.shares * 100) / 100;
      const reward = Math.round((pos.takeProfit - pos.entryPrice) * pos.shares * 100) / 100;
      await sendNotify(
        `OPEN ${symbol} $${pos.entryPrice.toFixed(2)}`,
        `**${symbol}** 买入 × ${pos.shares}股\n\n风险: -$${risk} | 预期收益: +$${reward} (1:2)\nAI评分: ${signal.score}/10`,
        'money_bag'
      );
    } else {
      console.log(`  ⚠️ ${symbol}: 开仓失败`);
    }
  }

  if (newPositions === 0) console.log('  无新开仓');

  // Summary
  console.log('\n━━ 总结 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const stats = loadStats();
  console.log(`  总交易: ${stats.totalTrades} | 胜: ${stats.wins} | 负: ${stats.losses} | 胜率: ${stats.winRate}%`);
  console.log(`  净PnL: $${stats.netPnL.toFixed(2)} | 最大回撤: $${stats.maxDrawdown.toFixed(2)}`);
  const finalPositions = loadPositions();
  if (finalPositions.length > 0) {
    console.log(`  持仓: ${finalPositions.length}个 | ${finalPositions.map(p => p.symbol).join(', ')}`);
  }
  console.log(`  ${fmtNodeDate(new Date())}\n`);

  // Auto-regenerate dashboard
  try {
    const html = buildDashboardHtml();
    const tmp = `${DASHBOARD_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, html, 'utf-8');
    fs.renameSync(tmp, DASHBOARD_FILE);
  } catch { /* silent */ }

  } finally { releaseLock(); }
}

// ─── Dashboard ───────────────────────────────────────────────────

 function buildDashboardHtml() {
  const config = loadConfig();
  const positions = loadPositions();
  const orders = loadOrders();
  const stats = loadStats();
  function fmtNodeDate(t) { var d = new Date(t), p = function(n){ return (n < 10 ? '0' : '') + n; }; return p(d.getMonth()+1) + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }


  // Load signals
  const allSignals = {};
  for (const symbol of config.symbols) {
    const sigs = loadSignals(symbol);
    allSignals[symbol] = Array.isArray(sigs) ? sigs.slice(-200) : sigs;
  }

  // Load kline data (只保留最近400根，避免dashboard过大)
  const allKlines = {};
  for (const symbol of config.symbols) {
    const k = loadKlineCache(symbol);
    allKlines[symbol] = k?.bars ? { ...k, bars: k.bars.slice(-400) } : null;
  }

  const data = { config, positions, orders, stats, signals: allSignals, klines: allKlines, generatedAt: new Date().toISOString() };

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>短线交易机器人 — 仪表板</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='2' y='2' width='28' height='28' rx='6' fill='%2345d483'/><text x='16' y='23' font-size='20' font-family='PingFang SC,sans-serif' font-weight='bold' text-anchor='middle' fill='white'>%E7%9F%AD</text></svg>">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1522; color: #d4dae6; line-height: 1.5; }
.header { background: linear-gradient(135deg, #1a2740 0%, #0f1b2e 100%); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a3a52; }
.header h1 { font-size: 1.5rem; color: #e8edf5; }
.header h1 svg { vertical-align: middle; margin-right: 8px; }
.header-right { display: flex; align-items: center; }
.tabs { display: flex; gap: 2px; padding: 0 24px; background: #131d31; border-bottom: 1px solid #1f2b44; }
.tab { padding: 10px 18px; font-size: .9rem; font-weight: 600; cursor: pointer; color: #6b7fa3; border: none; background: none; border-bottom: 2px solid transparent; transition: all .15s; }
.tab:hover { color: #b0c4e8; }
.tab.active { color: #4da8ff; border-bottom-color: #4da8ff; }
.content { padding: 20px 24px; max-width: 1200px; }
.card { background: #162234; border: 1px solid #2a3a52; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.card h2 { font-size: 15px; color: #c8d6e5; margin-bottom: 12px; font-weight: 600; }
.card h3 { font-size: 13px; color: #8ea3be; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { background: #1a2b42; padding: 8px 12px; text-align: left; font-weight: 600; color: #8ea3be; border-bottom: 2px solid #2a3a52; white-space: nowrap; }
tbody td { padding: 8px 12px; border-bottom: 1px solid #1e3048; }
tbody tr:hover { background: #1a2b42; }
.buy { color: #4caf50; font-weight: 600; }
.sell { color: #f44336; font-weight: 600; }
.hold { color: #ff9800; }
.win { color: #4caf50; }
.loss { color: #f44336; }
.pnl-pos { color: #4caf50; }
.pnl-neg { color: #f44336; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card { background: #1a2b42; border-radius: 8px; padding: 14px; text-align: center; }
.stat-card .label { font-size: 11px; color: #6b7d99; text-transform: uppercase; margin-bottom: 4px; }
.stat-card .value { font-size: 22px; font-weight: 700; color: #e8edf5; }
.stat-card .sub { font-size: 11px; color: #6b7d99; margin-top: 2px; }
.chart-container { border: 1px solid #2a3a52; border-radius: 8px; overflow: hidden; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge-buy { background: rgba(76,175,80,0.2); color: #4caf50; }
.badge-hold { background: rgba(255,152,0,0.2); color: #ff9800; }
.badge-open { background: rgba(77,168,255,0.2); color: #4da8ff; }
.badge-closed { background: rgba(107,125,153,0.2); color: #8ea3be; }
.empty { text-align: center; padding: 40px; color: #6b7d99; font-size: 14px; }
.symbol-selector { display: flex; gap: 8px; margin-bottom: 12px; }
.symbol-btn { padding: 6px 14px; border: 1px solid #2a3a52; border-radius: 6px; background: #1a2b42; color: #8ea3be; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.symbol-btn:hover { border-color: #4da8ff; color: #4da8ff; }
.symbol-btn.active { background: rgba(77,168,255,0.15); border-color: #4da8ff; color: #4da8ff; }
.signal-query-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; position: relative; }
.signal-query-bar input[type=search] { background: #1a2b42; border: 1px solid #2a3a52; color: #d4dae6; padding: 5px 10px; border-radius: 4px; font-size: 12px; width: 180px; }
.signal-query-bar input[type=search]::placeholder { color: #4a5e7a; }
.signal-query-bar select { background: #1a2b42; border: 1px solid #2a3a52; color: #d4dae6; padding: 5px 8px; border-radius: 4px; font-size: 12px; }
.signal-pagination { display: flex; gap: 6px; align-items: center; justify-content: center; padding: 10px 0; font-size: 12px; color: #6b7d99; }
.signal-pagination button { background: #1a2b42; border: 1px solid #2a3a52; color: #8ea3be; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.signal-pagination button:hover:not(:disabled) { border-color: #4da8ff; color: #4da8ff; }
.signal-pagination button:disabled { opacity: 0.4; cursor: default; }
.flex-row { display: flex; gap: 16px; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 280px; }
.version { font-size: 10px; color: #4a5e7a; }
.refresh-info { font-size: 11px; color: #6b7d99; margin-top: 8px; }
</style>
<script src="https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js"></script>
</head>
<body>
<div class="header">
    <h1><svg width="22" height="22" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="6" fill="#45d483"/><text x="16" y="23" font-size="20" font-family="PingFang SC,sans-serif" font-weight="bold" text-anchor="middle" fill="#ffffff">短</text></svg>短线K线交易机器人</h1>
    <span class="header-right">
      <span style="color:#6b7fa3;font-size:.85rem">5m · ${VERSION}</span>      <span style="color:#4a5e7a;font-size:.75rem;margin-left:8px">${VERSION_NOTE}</span>      <span style="cursor:pointer;color:#4da8ff;margin-left:12px;font-size:.85rem" onclick="toggleAutoRefresh()" id="refresh-status">🔄 自动刷新: 关</span>
      <button onclick="location.reload()" style="padding:4px 14px;background:#1a2942;border:1px solid #1f2b44;color:#b0c4e8;border-radius:6px;cursor:pointer;margin-left:10px;font-size:.8rem">🔄 刷新</button>
    </span>
  </div>

<div class="tabs">
  <button class="tab active" onclick="switchTab('positions')">持仓</button>
  <button class="tab" onclick="switchTab('orders')">交易记录</button>
  <button class="tab" onclick="switchTab('signals')">信号记录</button>
  <button class="tab" onclick="switchTab('stats')">统计</button>
  <button class="tab" onclick="switchTab('kline')">K线图</button>
</div>

<div class="content">
  <div id="tab-positions" class="tab-content"></div>
  <div id="tab-orders" class="tab-content" style="display:none"></div>
  <div id="tab-signals" class="tab-content" style="display:none"></div>
  <div id="tab-stats" class="tab-content" style="display:none"></div>
  <div id="tab-kline" class="tab-content" style="display:none"></div>
  <div class="refresh-info">数据生成: ${fmtNodeDate(data.generatedAt)}</div>
</div>

<script>
const DATA = ${JSON.stringify(data, null, 2)};

function fmtUSD(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2); }
function fmtPct(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }
function fmtTime(t) { return new Date(t).toLocaleString('zh-HK', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); }
function fmtDate(t) {
  var d = new Date(t), p = function(n){ return (n < 10 ? '0' : '') + n; };
  return p(d.getMonth()+1) + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function getLatestPrice(symbol) {
  const k = DATA.klines[symbol];
  const bars = k?.bars || k;
  if (!bars || !bars.length) return null;
  return bars[bars.length - 1].c;
}

function calcUnrealizedPnL() {
  let total = 0;
  for (const p of DATA.positions) {
    const price = getLatestPrice(p.symbol);
    if (price == null) continue;
    total += (price - p.entryPrice) * p.shares;
  }
  return total;
}

function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).style.display = 'block';
  document.querySelector('.tab:nth-child(' + (['positions','orders','signals','stats','kline'].indexOf(name)+1) + ')').classList.add('active');
  localStorage.setItem('trader_active_tab', name);
  if (name === 'kline') renderKline();
  if (name === 'stats') renderStats();
}

// ─── Positions Tab ───
function renderPositions() {
  const container = document.getElementById('tab-positions');
  const capital = DATA.config.capital || 100000;
  const unrealizedPnL = calcUnrealizedPnL();
  const totalEquity = capital + (DATA.stats.netPnL || 0) + unrealizedPnL;

  let marketVal = 0;
  for (const p of DATA.positions) {
    const price = getLatestPrice(p.symbol);
    if (price != null) marketVal += price * p.shares;
  }
  const cash = totalEquity - marketVal;

  let html = '<div class="stats-grid">';
  html += '<div class="stat-card"><div class="label">总资产</div><div class="value ' + (totalEquity >= capital ? 'win' : 'loss') + '">$' + fmtUSD(totalEquity) + '</div><div class="sub">本金 $' + capital.toFixed(2) + '</div></div>';
  html += '<div class="stat-card"><div class="label">持仓市值</div><div class="value">$' + fmtUSD(marketVal) + '</div><div class="sub">' + DATA.positions.length + ' 个持仓</div></div>';
  html += '<div class="stat-card"><div class="label">剩余资金</div><div class="value">$' + fmtUSD(cash) + '</div><div class="sub">已实现 $' + fmtUSD(DATA.stats.netPnL || 0) + '</div></div>';
  html += '<div class="stat-card"><div class="label">浮动盈亏</div><div class="value ' + (unrealizedPnL >= 0 ? 'win' : 'loss') + '">$' + fmtUSD(unrealizedPnL) + '</div></div>';
  html += '</div>';

  if (!DATA.positions.length) {
    container.innerHTML = html + '<div class="card"><div class="empty">暂无持仓</div></div>';
    return;
  }
  html += '<div class="card"><h2>当前持仓</h2><table><thead><tr><th>标的</th><th>入场价</th><th>现价</th><th>入场时间</th><th>股数</th><th>市值</th><th>浮动盈亏</th><th>浮动盈亏%</th><th>止损</th><th>止盈</th></tr></thead><tbody>';
  for (const p of DATA.positions) {
    const price = getLatestPrice(p.symbol);
    const marketVal = price != null ? price * p.shares : null;
    const unrealized = price != null ? (price - p.entryPrice) * p.shares : null;
    const unrealizedPct = price != null ? (price / p.entryPrice - 1) * 100 : null;
    const pnlClass = unrealized != null ? (unrealized >= 0 ? 'win' : 'loss') : '';
    html += '<tr>';
    html += '<td><strong>' + p.symbol + '</strong></td>';
    html += '<td>$' + p.entryPrice.toFixed(2) + '</td>';
    html += '<td>' + (price != null ? '$' + price.toFixed(2) : '-') + '</td>';
    html += '<td>' + fmtDate(p.entryTime) + '</td>';
    html += '<td>' + p.shares + '</td>';
    html += '<td>' + (marketVal != null ? '$' + marketVal.toFixed(2) : '-') + '</td>';
    html += '<td class="' + pnlClass + '">' + (unrealized != null ? '$' + fmtUSD(unrealized) : '-') + '</td>';
    html += '<td class="' + pnlClass + '">' + (unrealizedPct != null ? fmtPct(unrealizedPct) : '-') + '</td>';
    html += '<td class="sell">$' + p.stopLoss.toFixed(2) + '</td>';
    html += '<td class="buy">$' + p.takeProfit.toFixed(2) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// ─── Orders Tab ───
function renderOrders() {
  const container = document.getElementById('tab-orders');
  const symbols = [...new Set(DATA.orders.map(o => o.symbol))].sort();

  let html = '<div class="signal-query-bar">';
  html += '<select id="order-symbol" onchange="renderOrders()">';
  html += '<option value="">全部标的</option>';
  symbols.forEach(s => html += '<option value="' + s + '">' + s + '</option>');
  html += '</select>';
  html += '<select id="order-action" onchange="renderOrders()">';
  html += '<option value="">全部方向</option><option value="OPEN">开仓</option><option value="CLOSE">平仓</option>';
  html += '</select>';
  html += '<select id="order-result" onchange="renderOrders()">';
  html += '<option value="">全部结果</option><option value="win">盈利</option><option value="loss">亏损</option>';
  html += '</select>';
  html += '<input id="order-search" type="search" placeholder="搜索原因..." oninput="renderOrders()">';
  html += '<span id="order-count" style="color:#6b7d99;font-size:12px;margin-left:auto"></span>';
  html += '</div><div id="orders-table"></div>';
  container.innerHTML = html;
  renderOrderTable();
}

function renderOrderTable() {
  const symEl = document.getElementById('order-symbol');
  const selSym = symEl ? symEl.value : '';
  const actionEl = document.getElementById('order-action');
  const selAction = actionEl ? actionEl.value : '';
  const resultEl = document.getElementById('order-result');
  const selResult = resultEl ? resultEl.value : '';
  const searchEl = document.getElementById('order-search');
  const search = searchEl ? (searchEl.value || '').toLowerCase() : '';

  let allOrders = [...DATA.orders].reverse();
  if (selSym) allOrders = allOrders.filter(o => o.symbol === selSym);
  if (selAction) allOrders = allOrders.filter(o => o.action === selAction);
  if (selResult === 'win') allOrders = allOrders.filter(o => (o.pnl || 0) > 0);
  if (selResult === 'loss') allOrders = allOrders.filter(o => (o.pnl || 0) < 0);
  if (search) allOrders = allOrders.filter(o => (o.reason || o.closeReason || '').toLowerCase().includes(search));

  const div = document.getElementById('orders-table');
  const cntEl = document.getElementById('order-count');
  if (!allOrders.length) {
    div.innerHTML = '<div class="card"><div class="empty">无匹配记录</div></div>';
    if (cntEl) cntEl.textContent = '';
    return;
  }

  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(allOrders.length / pageSize));
  let page = Math.max(1, (window._orderPage || 1));
  if (page > totalPages) page = 1;
  window._orderPage = page;
  const startIdx = (page - 1) * pageSize;
  const orders = allOrders.slice(startIdx, startIdx + pageSize);

  if (cntEl) cntEl.textContent = '第 ' + page + '/' + totalPages + ' 页  共 ' + allOrders.length + ' 条';

  let html = '<div class="card"><table><thead><tr><th>标的</th><th>方向</th><th>价格</th><th>股数</th><th>金额</th><th>PnL</th><th>原因</th><th>时间</th></tr></thead><tbody>';
  for (const o of orders) {
    const pnlClass = o.pnl ? (o.pnl > 0 ? 'win' : 'loss') : '';
    html += '<tr>';
    html += '<td><strong>' + o.symbol + '</strong></td>';
    html += '<td class="' + (o.action === 'OPEN' ? 'buy' : 'sell') + '">' + (o.action === 'OPEN' ? '开仓' : '平仓') + '</td>';
    html += '<td>$' + o.price.toFixed(2) + '</td>';
    html += '<td>' + o.shares + '</td>';
    html += '<td>$' + (o.cost || o.revenue || 0).toFixed(2) + '</td>';
    html += '<td class="' + pnlClass + '">' + (o.pnl != null ? '$' + fmtUSD(o.pnl) + ' (' + fmtPct(o.pnlPct) + ')' : '-') + '</td>';
    html += '<td>' + (o.reason || o.closeReason || '-') + '</td>';
    html += '<td style="white-space:nowrap">' + fmtDate(o.time) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  html += '<div class="signal-pagination">';
  html += '<button onclick="window._orderPage=1;renderOrderTable()" ' + (page <= 1 ? 'disabled' : '') + '>首页</button>';
  html += '<button onclick="window._orderPage=' + (page - 1) + ';renderOrderTable()" ' + (page <= 1 ? 'disabled' : '') + '>上一页</button>';
  html += '<span>第 ' + page + ' / ' + totalPages + ' 页</span>';
  html += '<button onclick="window._orderPage=' + (page + 1) + ';renderOrderTable()" ' + (page >= totalPages ? 'disabled' : '') + '>下一页</button>';
  html += '<button onclick="window._orderPage=' + totalPages + ';renderOrderTable()" ' + (page >= totalPages ? 'disabled' : '') + '>末页</button>';
  html += '</div></div>';
  div.innerHTML = html;
}

// ─── Signals Tab ───
function renderSignals() {
  const container = document.getElementById('tab-signals');
  const symbols = Object.keys(DATA.signals);
  let html = '<div class="signal-query-bar">';
  html += '<select id="signal-symbol" onchange="renderSignalTable()">';
  html += '<option value="">全部标的</option>';
  symbols.forEach(s => html += '<option value="' + s + '">' + s + '</option>');
  html += '</select>';
  html += '<input id="signal-search" type="search" placeholder="搜索理由/价格..." oninput="renderSignalTable()">';
  html += '<select id="signal-decision" onchange="renderSignalTable()">';
  html += '<option value="">全部决策</option><option value="BUY">BUY</option><option value="SKIP">SKIP</option>';
  html += '</select>';
  html += '<select id="signal-score" onchange="renderSignalTable()">';
  html += '<option value="">全部评分</option>';
  for (let i = 1; i <= 10; i++) html += '<option value="' + i + '">≥' + i + '分</option>';
  html += '</select>';
  html += '<select id="signal-rules" onchange="renderSignalTable()">';
  html += '<option value="">全部规则</option><option value="pass">通过</option><option value="fail">不通过</option>';
  html += '</select>';
  html += '<span style="cursor:pointer;color:#4da8ff;font-size:14px;margin:0 4px" onclick="document.getElementById(\\'rules-hint\\').style.display=document.getElementById(\\'rules-hint\\').style.display===\\'none\\'?\\'block\\':\\'none\\'" title="规则说明">?</span>';
  html += '<div id="rules-hint" style="display:none;background:#1a2b42;border:1px solid #4da8ff;border-radius:6px;padding:8px 12px;font-size:12px;color:#8ea3be;line-height:1.6;position:absolute;z-index:10;margin-top:4px">';
  html += '<b>EMA</b> + <b>量比</b> 必须通过<br>';
  html += '<b>MACD</b> 或 <b>RSI</b> 至少过 1 个<br>';
  html += '总共 ≥ 3/4 → 全过 ✅</div>';
  html += '<span id="signal-count" style="color:#6b7d99;font-size:12px;margin-left:auto"></span>';
  html += '</div>';
  html += '<div id="signals-table"></div>';
  container.innerHTML = html;
  renderSignalTable();
}

window.filterSignals = function(sym) {
  // deprecated, remove
};

function colorReasoning(text) {
  // Match bearish first (green, longer patterns first to avoid substring conflict)
  return text
    .replace(/(缺乏明确做多信号|做多信号不足|做多信号不明确|做多信号弱|做多风险较高|做多风险高|做多机会中性|技术面偏空|趋势不明|方向不明|建议观望)/g, '<span style="color:#45d483;font-weight:600">$1</span>')
    .replace(/(强烈做多|明确做多信号|做多信号明确|做多机会较好|技术面偏多|趋势向上|多头确认)/g, '<span style="color:#ff6b7d;font-weight:600">$1</span>');
}

function renderSignalTable() {
  const symbolEl = document.getElementById('signal-symbol');
  const selSymbol = symbolEl ? symbolEl.value : '';

  // Gather all signals
  let allSignals = [];
  const symbols = selSymbol ? [selSymbol] : Object.keys(DATA.signals);
  for (const sym of symbols) {
    const sigs = DATA.signals[sym] || [];
    for (const s of sigs) {
      allSignals.push({ ...s, _symbol: sym });
    }
  }
  // Sort by time desc
  allSignals.sort((a, b) => new Date(b.time) - new Date(a.time));

  const div = document.getElementById('signals-table');
  const cntEl = document.getElementById('signal-count');
  if (!allSignals.length) {
    div.innerHTML = '<div class="card"><div class="empty">暂无信号记录</div></div>';
    if (cntEl) cntEl.textContent = '';
    return;
  }

  // Filters
  const searchEl = document.getElementById('signal-search');
  const search = searchEl ? (searchEl.value || '').toLowerCase() : '';
  const decisionEl = document.getElementById('signal-decision');
  const decision = decisionEl ? decisionEl.value : '';
  const scoreEl = document.getElementById('signal-score');
  const minScore = scoreEl ? parseInt(scoreEl.value) || 0 : 0;

  let filtered = allSignals;
  if (decision) filtered = filtered.filter(s => {
    const d = s.decision || (s.signal === 'BUY' ? 'BUY' : 'SKIP');
    return d === decision;
  });
  if (minScore > 0) filtered = filtered.filter(s => (s.aiScore || s.confidence || 0) >= minScore);
  if (search) filtered = filtered.filter(s => (s.reasoning || '').toLowerCase().includes(search));
  const rulesEl = document.getElementById('signal-rules');
  const rulesFilter = rulesEl ? rulesEl.value : '';
  if (rulesFilter === 'pass') filtered = filtered.filter(s => s.rulesTriggered === true);
  if (rulesFilter === 'fail') filtered = filtered.filter(s => !s.rulesTriggered);

  // Pagination
  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  let page = Math.max(1, (window._signalPage || 1));
  if (page > totalPages) page = 1;
  window._signalPage = page;
  const startIdx = (page - 1) * pageSize;
  const signals = filtered.slice(startIdx, startIdx + pageSize);

  if (cntEl) cntEl.textContent = '第 ' + page + '/' + totalPages + ' 页  共 ' + filtered.length + ' 条';

  if (!signals.length) {
    div.innerHTML = '<div class="card"><div class="empty">无匹配记录</div></div>';
    return;
  }

  let html = '<div class="card"><table><thead><tr><th>时间</th><th>标的</th><th>价格</th><th>决策</th><th>规则</th><th>评分</th><th>入场价</th><th>止损</th><th>止盈</th><th>理由</th></tr></thead><tbody>';
  for (const s of signals) {
    const d = s.decision || (s.signal === 'BUY' ? 'BUY' : 'SKIP');
    const sigClass = d === 'BUY' ? 'buy' : 'hold';
    const ruleStr = s.rules ? (s.rules.macd?'M':'') + (s.rules.rsi?'R':'') + (s.rules.ema?'E':'') + (s.rules.volume?'V':'') : '-';
    const ruleDetail = s.indicators ? 'MACD:' + (s.indicators.macd?.hist?.toFixed(4)||'?') + ' RSI:' + (s.indicators.rsi||'?') + ' EMA:' + (s.indicators.ema9?.toFixed(2)||'?') + ' 量比:' + (s.indicators.volumeRatio != null ? s.indicators.volumeRatio : '?') + 'x' : '';
    const ruleTitle = ruleDetail ? ' title="' + ruleDetail + '"' : '';
    const aiScoreDisplay = s.aiScore != null ? s.aiScore + '/10' : (s.confidence != null ? s.confidence + '%' : '-');
    const entryPriceDisplay = s.entryPrice || s.entry_price;
    const slDisplay = s.stopLoss || s.stop_loss;
    const tpDisplay = s.takeProfit || s.take_profit;
    html += '<tr>';
    html += '<td style="white-space:nowrap">' + fmtDate(s.time) + '</td>';
    html += '<td>' + (s._symbol || '-') + '</td>';
    html += '<td>$' + (s.price || 0).toFixed(2) + '</td>';
    html += '<td class="' + sigClass + '">' + d + '</td>';
    html += '<td' + ruleTitle + '>' + (s.rulesTriggered ? '✅' : '❌') + ' ' + ruleStr + '</td>';
    html += '<td>' + aiScoreDisplay + '</td>';
    html += '<td>' + (entryPriceDisplay ? '$' + Number(entryPriceDisplay).toFixed(2) : '-') + '</td>';
    html += '<td>' + (slDisplay ? '$' + Number(slDisplay).toFixed(2) : '-') + '</td>';
    html += '<td>' + (tpDisplay ? '$' + Number(tpDisplay).toFixed(2) : '-') + '</td>';
    html += '<td style="max-width:300px;white-space:normal;word-break:break-word;line-height:1.4">' + colorReasoning(s.reasoning || '-') + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  html += '<div class="signal-pagination">';
  html += '<button onclick="window._signalPage=1;renderSignalTable()" ' + (page <= 1 ? 'disabled' : '') + '>首页</button>';
  html += '<button onclick="window._signalPage=' + (page - 1) + ';renderSignalTable()" ' + (page <= 1 ? 'disabled' : '') + '>上一页</button>';
  html += '<span>第 ' + page + ' / ' + totalPages + ' 页</span>';
  html += '<button onclick="window._signalPage=' + (page + 1) + ';renderSignalTable()" ' + (page >= totalPages ? 'disabled' : '') + '>下一页</button>';
  html += '<button onclick="window._signalPage=' + totalPages + ';renderSignalTable()" ' + (page >= totalPages ? 'disabled' : '') + '>末页</button>';
  html += '</div></div>';
  div.innerHTML = html;
}

// ─── Stats Tab ───
function renderStats() {
  const container = document.getElementById('tab-stats');
  const s = DATA.stats;
  const capital = DATA.config.capital || 100000;
  const unrealizedPnL = calcUnrealizedPnL();
  const totalEquity = capital + s.netPnL + unrealizedPnL;
  let html = '<div class="stats-grid">';
  html += '<div class="stat-card"><div class="label">总交易</div><div class="value">' + s.totalTrades + '</div></div>';
  html += '<div class="stat-card"><div class="label">胜率</div><div class="value">' + s.winRate + '%</div><div class="sub">' + s.wins + 'W / ' + s.losses + 'L</div></div>';
  html += '<div class="stat-card"><div class="label">总资产</div><div class="value ' + (totalEquity >= capital ? 'win' : 'loss') + '">$' + fmtUSD(totalEquity) + '</div><div class="sub">本金 $' + capital.toFixed(2) + '</div></div>';
  html += '<div class="stat-card"><div class="label">已实现PnL</div><div class="value ' + (s.netPnL >= 0 ? 'win' : 'loss') + '">$' + fmtUSD(s.netPnL) + '</div></div>';
  html += '<div class="stat-card"><div class="label">浮动盈亏</div><div class="value ' + (unrealizedPnL >= 0 ? 'win' : 'loss') + '">$' + fmtUSD(unrealizedPnL) + '</div></div>';
  html += '<div class="stat-card"><div class="label">平均盈利</div><div class="value win">$' + fmtUSD(s.avgWin) + '</div></div>';
  html += '<div class="stat-card"><div class="label">平均亏损</div><div class="value loss">$' + fmtUSD(s.avgLoss) + '</div></div>';
  html += '<div class="stat-card"><div class="label">最大回撤</div><div class="value loss">$' + fmtUSD(s.maxDrawdown) + '</div></div>';
  html += '<div class="stat-card"><div class="label">连续亏损</div><div class="value">' + s.consecutiveLosses + '</div></div>';
  html += '</div>';

  // Equity curve
  html += '<div class="card"><h2>资产曲线</h2><div id="equity-chart-container" style="width:100%;height:280px"></div></div>';

  // By symbol
  if (s.bySymbol && Object.keys(s.bySymbol).length > 0) {
    html += '<div class="card"><h3>按标的统计</h3><table><thead><tr><th>标的</th><th>交易数</th><th>胜</th><th>负</th><th>PnL</th><th>胜率</th></tr></thead><tbody>';
    for (const [sym, st] of Object.entries(s.bySymbol)) {
      const wr = st.trades > 0 ? Math.round(st.wins / st.trades * 10000) / 100 : 0;
      html += '<tr><td><strong>' + sym + '</strong></td><td>' + st.trades + '</td><td class="win">' + st.wins + '</td><td class="loss">' + st.losses + '</td><td class="' + (st.pnl >= 0 ? 'win' : 'loss') + '">$' + fmtUSD(st.pnl) + '</td><td>' + wr + '%</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  // Daily PnL
  if (s.dailyPnL && Object.keys(s.dailyPnL).length > 0) {
    html += '<div class="card"><h3>每日PnL</h3><table><thead><tr><th>日期</th><th>PnL</th></tr></thead><tbody>';
    for (const [date, pnl] of Object.entries(s.dailyPnL).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 30)) {
      html += '<tr><td>' + date + '</td><td class="' + (pnl >= 0 ? 'win' : 'loss') + '">$' + fmtUSD(pnl) + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  container.innerHTML = html;
  setTimeout(renderEquityCurve, 100);
}

function renderEquityCurve() {
  const container = document.getElementById('equity-chart-container');
  if (!container) return;

  const capital = DATA.config.capital || 100000;
  const orders = DATA.orders.filter(o => o.action === 'CLOSE').sort((a, b) => new Date(a.time) - new Date(b.time));

  const canvas = document.createElement('canvas');
  canvas.width = container.clientWidth;
  canvas.height = 280;
  canvas.style.width = '100%';
  canvas.style.height = '280px';
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const pad = { top: 20, right: 40, bottom: 40, left: 70 };

  const points = [];
  let equity = capital;
  points.push({ time: Date.now() - 86400000, equity }); // start point 1 day ago

  if (orders.length > 0) {
    // Add start-of-first-trade-day point
    const firstTime = new Date(orders[0].time).getTime() - 60000;
    points.push({ time: firstTime, equity: capital });

    for (const o of orders) {
      equity += o.pnl || 0;
      points.push({ time: new Date(o.time).getTime(), equity });
    }
    const unrealized = calcUnrealizedPnL();
    points.push({ time: Date.now(), equity: equity + unrealized });
  } else {
    const unrealized = calcUnrealizedPnL();
    points.push({ time: Date.now(), equity: equity + unrealized });
  }

  const tMin = points[0].time;
  const tMax = points[points.length - 1].time;
  const tRange = tMax - tMin || 86400000;
  const values = points.map(p => p.equity);
  const vMax = Math.max(capital, ...values) * 1.01;
  const vMin = Math.min(capital, ...values) * 0.995;
  const vRange = vMax - vMin || 100;

  const toX = (t) => pad.left + (t - tMin) / tRange * (W - pad.left - pad.right);
  const toY = (v) => pad.top + (vMax - v) / vRange * (H - pad.top - pad.bottom);

  ctx.fillStyle = '#1a2b42';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#1e3048';
  ctx.lineWidth = 0.5;
  ctx.fillStyle = '#6b7d99';
  ctx.font = '10px monospace';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (H - pad.top - pad.bottom) * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const v = vMax - vRange * i / 4;
    ctx.fillText('$' + (v / 1000).toFixed(0) + 'k', 5, y + 4);
  }

  // Baseline at capital
  ctx.strokeStyle = '#3a4a62';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  const yBase = toY(capital);
  ctx.beginPath(); ctx.moveTo(pad.left, yBase); ctx.lineTo(W - pad.right, yBase); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#6b7d99';
  ctx.fillText('初始$' + (capital / 1000).toFixed(0) + 'k', W - pad.right - 60, yBase - 5);

  const lastEquity = points[points.length - 1].equity;
  const isUp = lastEquity >= capital;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, toY(vMax), 0, toY(vMin));
  grad.addColorStop(0, isUp ? 'rgba(69,212,131,0.1)' : 'rgba(255,107,125,0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(toX(points[0].time), toY(capital));
  for (const p of points) ctx.lineTo(toX(p.time), toY(p.equity));
  ctx.lineTo(toX(points[points.length - 1].time), toY(capital));
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = isUp ? '#45d483' : '#ff6b7d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = toX(points[i].time), y = toY(points[i].equity);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // X labels
  ctx.fillStyle = '#6b7d99';
  ctx.font = '9px monospace';
  for (let i = 0; i <= 3; i++) {
    const t = tMin + tRange * i / 3;
    const x = toX(t);
    const d = new Date(t);
    const label = (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
    ctx.fillText(label, x - 25, H - 8);
  }

  // Last value label
  ctx.fillStyle = isUp ? '#45d483' : '#ff6b7d';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('$' + lastEquity.toFixed(0), W - pad.right - 60, toY(lastEquity) - 8);
}

// ─── K-line Tab ───
let _klineChart = null;

function renderKline() {
  const container = document.getElementById('tab-kline');
  const symbols = Object.keys(DATA.klines).filter(s => {
    const k = DATA.klines[s];
    return k && k.bars && k.bars.length >= 5;
  });
  if (!symbols.length) {
    container.innerHTML = '<div class="card"><div class="empty">暂无K线数据，运行 run 后自动获取</div></div>';
    return;
  }
  const hasOrders = symbols.some(s => DATA.orders.some(o => o.symbol === s));
  const savedSym = localStorage.getItem('trader_kline_symbol');
  const defaultSym = (savedSym && symbols.includes(savedSym))
    ? savedSym
    : (hasOrders ? symbols.find(s => DATA.orders.some(o => o.symbol === s)) || symbols[0] : symbols[0]);
  let html = '<div class="symbol-selector">';
  symbols.forEach((s, i) => {
    const cnt = DATA.orders.filter(o => o.symbol === s).length;
    html += '<button class="symbol-btn' + (s === defaultSym ? ' active' : '') + '" onclick="switchKline(\\'' + s + '\\')">' + s + (cnt ? ' (' + cnt + '笔)' : '') + '</button>';
  });
  html += '</div>';
  // K-line status for default symbol
  const kf = DATA.klines[defaultSym];
  const statusClr = kf?.klineStale?.stale ? '#ff6b7d' : (kf?.klineError ? '#ffd54a' : '#45d483');
  const lastTime = kf?.klineStale?.lastBarTime ? kf.klineStale.lastBarTime.slice(0,19) : (kf?.bars?.at(-1)?.t ? new Date(Number(kf.bars.at(-1).t) * 1000).toLocaleString() : '--');
  const statusText = kf?.klineStale?.stale
    ? 'K线已过期: ' + (kf.klineStale.reason || '--') + ' | 最后: ' + lastTime
    : (kf?.klineError ? 'K线失败: ' + kf.klineError : (lastTime !== '--' ? 'K线正常 | 最后: ' + lastTime : 'K线状态未知'));
  html += '<div style="margin:6px 0 10px;font-size:.78rem;color:' + statusClr + '">' + statusText + '</div>';
  html += '<div id="chart-container" class="chart-container"><div id="chart-root" style="width:100%;height:545px"></div></div>';
  container.innerHTML = html;
  if (typeof LightweightCharts === 'undefined') {
    document.getElementById('chart-root').innerHTML = '<div class="empty" style="padding:60px">图表库加载中...请确保网络连接正常</div>';
    return;
  }
  if (defaultSym) setTimeout(() => loadChart(defaultSym), 200);
}

window.switchKline = function(sym) {
  document.querySelectorAll('#tab-kline .symbol-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  localStorage.setItem('trader_kline_symbol', sym);
  loadChart(sym);
};

function loadChart(symbol) {
  const kdata = DATA.klines[symbol];
  const bars = kdata?.bars || [];
  if (!bars.length) return;

  if (_klineChart) { _klineChart.remove(); _klineChart = null; }
  document.getElementById('chart-root').innerHTML = '';

  _klineChart = LightweightCharts.createChart(document.getElementById('chart-root'), {
    layout: { background: { color: '#0d1522' }, textColor: '#6b7fa3' },
    grid: { vertLines: { color: '#1a2942' }, horzLines: { color: '#1a2942' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    timeScale: { borderColor: '#1f2b44', timeVisible: true, secondsVisible: false },
    rightPriceScale: { borderColor: '#1f2b44' },
    localization: {
      timeFormatter: (t) => {
        const d = new Date(Number(t) * 1000);
        const hk = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Hong_Kong', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(d);
        return hk.replace(/\\//g, '-').replace(/, /g, ' ');
      },
    },
  });

  const candleSeries = _klineChart.addCandlestickSeries({
    upColor: '#ff6b7d', downColor: '#45d483',
    borderUpColor: '#ff6b7d', borderDownColor: '#45d483',
    wickUpColor: '#ff6b7d', wickDownColor: '#45d483',
  });

  const chartData = bars
    .map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }))
    .filter(b => Number.isFinite(b.time) && b.time > 0)
    .sort((a, b) => a.time - b.time)
    .filter((b, i, arr) => i === 0 || b.time !== arr[i - 1].time);
  candleSeries.setData(chartData);

  const sigs = (DATA.signals[symbol] || []).filter(s => s.aiScore != null && s.time);
  if (sigs.length) {
    const scoreBuckets = new Map();
    for (const s of sigs) {
      const rawTime = Math.floor(new Date(s.time).getTime() / 1000);
      if (!Number.isFinite(rawTime)) continue;
      const t = Math.floor(rawTime / 300) * 300;
      if (t >= bars[0]?.t && t <= bars[bars.length - 1]?.t) {
        scoreBuckets.set(t, { time: t, value: s.aiScore,
          color: s.aiScore >= 7 ? 'rgba(69,212,131,0.7)' : s.aiScore >= 5 ? 'rgba(255,213,74,0.6)' : 'rgba(255,107,125,0.5)' });
      }
    }
    const scoreData = [...scoreBuckets.values()].sort((a, b) => a.time - b.time).slice(-100);
    if (scoreData.length) {
      const scoreSeries = _klineChart.addHistogramSeries({ priceScaleId: 'score', priceFormat: { type: 'volume' } });
      scoreSeries.setData(scoreData);
      _klineChart.priceScale('score').applyOptions({ scaleMargins: { top: 0.95, bottom: 0 }, visible: true, borderVisible: false });
    }
  }

  const orders = DATA.orders.filter(o => o.symbol === symbol);
  const openPositions = DATA.positions.filter(p => p.symbol === symbol);

  // Build closed positions from CLOSE order + matched OPEN order
  const closedPositions = [];
  const closeOrders = orders.filter(o => o.action === 'CLOSE');
  for (const co of closeOrders) {
    const openOrder = orders.find(o => o.action === 'OPEN' && o.id === co.id);
    if (!openOrder) continue;
    closedPositions.push({
      symbol,
      entryPrice: openOrder.price,
      stopLoss: openOrder.stopLoss,
      takeProfit: openOrder.takeProfit,
      entryTime: openOrder.time,
      closeTime: co.time,
      status: 'CLOSED',
    });
  }
  const allPositions = [...openPositions, ...closedPositions];

  const markers = [];

  // Order markers (snap to nearest 5-min bar)
  for (const o of orders) {
    const rawTime = typeof o.time === 'string' ? Math.floor(new Date(o.time).getTime() / 1000) : o.time;
    const snapped = Math.round(rawTime / 300) * 300;
    let nearest = null, bestDist = Infinity;
    for (const b of bars) {
      const dist = Math.abs(b.t - snapped);
      if (dist < bestDist) { nearest = b; bestDist = dist; }
    }
    if (!nearest) continue;
    if (o.action === 'OPEN') {
      // no marker for OPEN orders
    } else if (o.action === 'CLOSE') {
      const pnlText = o.pnl ? (o.pnl > 0 ? ' +$' : ' -$') + Math.abs(o.pnl).toFixed(0) : '';
      markers.push({
        time: nearest.t, position: 'aboveBar',
        color: o.pnl > 0 ? '#45d483' : '#ff6b7d', shape: o.pnl > 0 ? 'arrowUp' : 'arrowDown',
        text: (o.reason || 'CLOSE') + pnlText, size: 3,
      });
    }
  }

  if (markers.length) {
    markers.sort((a, b) => a.time - b.time);
    candleSeries.setMarkers(markers);
  }

  // ── Trade lines + arrows for all positions (open + closed) ──
  const gray = '#808080';
  const firstBarTime = bars[0].t;
  const lastBarTime = bars[bars.length - 1].t;
  const invBars = [];
  const invMarkers = [];

  for (const pos of allPositions) {
    const entryTime = Math.round(Math.floor(new Date(pos.entryTime).getTime() / 1000) / 300) * 300;
    if (entryTime < firstBarTime - 86400 * 3) continue;
    const isClosed = pos.status === 'CLOSED';
    const endTime = isClosed
      ? Math.round(Math.floor(new Date(pos.closeTime).getTime() / 1000) / 300) * 300
      : lastBarTime;

    // Entry: gray dashed line, time-bounded
    const entryLine = _klineChart.addLineSeries({
      color: gray, lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: false,
    });
    entryLine.setData([
      { time: entryTime, value: pos.entryPrice },
      { time: endTime, value: pos.entryPrice },
    ]);

    // TP: gray line, time-bounded
    const tpLine = _klineChart.addLineSeries({
      color: gray, lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Solid,
      priceLineVisible: false, lastValueVisible: false,
    });
    tpLine.setData([
      { time: entryTime, value: pos.takeProfit },
      { time: endTime, value: pos.takeProfit },
    ]);

    // SL: gray line, time-bounded
    const slLine = _klineChart.addLineSeries({
      color: gray, lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Solid,
      priceLineVisible: false, lastValueVisible: false,
    });
    slLine.setData([
      { time: entryTime, value: pos.stopLoss },
      { time: endTime, value: pos.stopLoss },
    ]);

    // Vertical line: entry → TP (green dashed)
    const vertUp = _klineChart.addLineSeries({
      color: '#45d483', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: false,
    });
    vertUp.setData([
      { time: entryTime, value: pos.entryPrice },
      { time: entryTime, value: pos.takeProfit },
    ]);

    // Vertical line: entry → SL (red dashed)
    const vertDown = _klineChart.addLineSeries({
      color: '#ff6b7d', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: false,
    });
    vertDown.setData([
      { time: entryTime, value: pos.entryPrice },
      { time: entryTime, value: pos.stopLoss },
    ]);

    // Invisible bar markers for arrow + price label
    invBars.push({ time: entryTime, open: pos.takeProfit, high: pos.takeProfit, low: pos.stopLoss, close: pos.stopLoss });
    const arrowSize = isClosed ? 0 : 1;
    invMarkers.push({ time: entryTime, position: 'aboveBar', color: gray, shape: 'arrowDown', text: '$' + pos.takeProfit.toFixed(2), size: arrowSize });
    invMarkers.push({ time: entryTime, position: 'belowBar', color: gray, shape: 'arrowUp', text: '$' + pos.stopLoss.toFixed(2), size: arrowSize });
  }

  if (invBars.length > 0) {
    invBars.sort((a, b) => a.time - b.time);
    const invSeries = _klineChart.addCandlestickSeries({
      upColor: 'transparent', downColor: 'transparent',
      borderUpColor: 'transparent', borderDownColor: 'transparent',
      wickUpColor: 'transparent', wickDownColor: 'transparent',
      priceLineVisible: false, lastValueVisible: false,
    });
    invSeries.setData(invBars);
    if (invMarkers.length) invSeries.setMarkers(invMarkers);
  }

  _klineChart.timeScale().fitContent();
  const totalBars = bars.length;
}

// ─── Auto-refresh ───
let _autoRefreshTimer = null;
let _autoRefreshSec = 300; // 5 minutes

window.toggleAutoRefresh = function() {
  const el = document.getElementById('refresh-status');
  if (_autoRefreshTimer) {
    clearInterval(_autoRefreshTimer);
    _autoRefreshTimer = null;
    el.innerHTML = '🔄 自动刷新: 关';
    localStorage.setItem('trader_auto_refresh', 'off');
  } else {
    localStorage.setItem('trader_auto_refresh', 'on');
    _autoRefreshTimer = setInterval(() => window.location.reload(), _autoRefreshSec * 1000);
    el.innerHTML = '🔄 自动刷新: 每' + (_autoRefreshSec / 60) + '分钟';
  }
};

// ─── Init ───
renderPositions();
renderOrders();
renderSignals();
renderStats();
// Auto-refresh: default ON unless explicitly turned off
if (localStorage.getItem('trader_auto_refresh') !== 'off') {
  toggleAutoRefresh();
}
// Restore last active tab
const savedTab = localStorage.getItem('trader_active_tab');
if (savedTab && ['positions','orders','signals','stats','kline'].includes(savedTab)) {
  switchTab(savedTab);
}
// Alert on new BUY signals
(function() {
  const buyCount = Object.values(DATA.signals).reduce((n, arr) => n + arr.filter(s => (s.decision || s.signal) === 'BUY').length, 0);
  const prev = parseInt(localStorage.getItem('trader_buy_count') || '0');
  if (buyCount > prev) {
    // Flash title
    const origTitle = document.title;
    let flash = 0;
    const iv = setInterval(() => {
      document.title = (flash % 2 === 0) ? '🟢 买入信号！' : origTitle;
      flash++;
      if (flash >= 6) { clearInterval(iv); document.title = origTitle; }
    }, 500);
    // Try beep
    try {
      const a = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+Af3+Af39/f3+Af39/gH9/f3+Af39/f3+Af39/gH9/f3+Af39/gH+Af39/gH+Af39/f3+Af39/gH9/f3+Af39/gH9/f3+Af39/gH9/f3+Af39/gH9/f3+Af39/gH9/f39/f3+Af39/gH+Af39/f39/gH9/f3+Af39/f3+Af39/gH9/f39/gH+Af39/f3+Af3+Af39/gH9/f3+Af3+Af39/f39/gH9/f39/f3+Af39/gH+Af39/gH9/f39/f3+Af3+Af39/f3+Af3+Af39/f3+Af39/f3+Af39/f3+Af39/f39/gH9/f3+Af39/gH9/f3+Af3+Af39/f3+Af3+Af39/f3+Af3+Af39/gH9/f3+Af3+Af39/f3+Af39/gH9/gH9/gH9/gH9/gH9/gH9/gH9/gH9/f39/f39/f39/f39/f39/gH9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+A');
      a.play().catch(() => {});
    } catch {}
  }
  localStorage.setItem('trader_buy_count', buyCount);
})();
</script>
</body>
</html>`;
}

async function generateDashboard() {
  console.log('📊 生成仪表板...');
  ensureDir(AGENT_DIR);
  const html = buildDashboardHtml();
  const tmp = `${DASHBOARD_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, html, 'utf-8');
  fs.renameSync(tmp, DASHBOARD_FILE);
  console.log(`✅ 仪表板已生成: ${DASHBOARD_FILE}`);
  if (process.platform === 'darwin') {
    try {
      execSync(`open "${DASHBOARD_FILE}"`);
    } catch { /* ok */ }
  }
}

// ─── Setup ───────────────────────────────────────────────────────

async function setupEnv() {
  const apiKey = readApiKey();
  if (apiKey) {
    ensureDir(AGENT_DIR);
    fs.writeFileSync(ENV_FILE, `DEEPSEEK_API_KEY=${apiKey}\n`, 'utf-8');
    console.log(`✅ API Key 已写入 ${ENV_FILE}`);
    return;
  }

  if (process.env.DEEPSEEK_API_KEY) {
    ensureDir(AGENT_DIR);
    fs.writeFileSync(ENV_FILE, `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY}\n`, 'utf-8');
    console.log(`✅ API Key 已写入 ${ENV_FILE}`);
    return;
  }

  console.log('⛔ 未设置 DEEPSEEK_API_KEY 环境变量');
  console.log('   使用方法: export DEEPSEEK_API_KEY=sk-xxx && node scripts/short-term-trader.mjs env');
}

async function setupCron() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.log('⛔ 请先设置 DEEPSEEK_API_KEY\n   export DEEPSEEK_API_KEY=sk-xxx\n');
    console.log('   或: node scripts/short-term-trader.mjs env\n');
    return;
  }

  ensureDir(AGENT_DIR);
  fs.writeFileSync(ENV_FILE, `DEEPSEEK_API_KEY=${apiKey}\n`, 'utf-8');

  let nodePath = '/opt/homebrew/bin/node';
  try {
    nodePath = execSync('which node', { encoding: 'utf-8' }).trim() || nodePath;
  } catch { /* keep default */ }

  const scriptPath = path.resolve(decodeURIComponent(import.meta.url.replace('file://', '')));
  const repoDir = path.resolve(scriptPath, '../../');
  const logFile = path.join(AGENT_DIR, 'cron.log');

  // Wrapper script
  const runScript = path.join(AGENT_DIR, 'run.sh');
  const sh = `#!/bin/bash
# Auto-generated by short-term-trader setup
# Runs every 5 min during US market hours
cd "${repoDir}"
export DEEPSEEK_API_KEY="${apiKey}"
${nodePath} "${scriptPath}" run >> "${logFile}" 2>&1
`;
  fs.writeFileSync(runScript, sh, { mode: 0o755 });
  console.log(`✅ 启动脚本: ${runScript}`);

  // launchd plist — every 5 min, Mon-Fri, 21:30–04:30 HKT (NYSE 9:30–16:00 ET, approx)
  // DST-aware: run every 5 min via StartInterval; the script checks market hours internally
  const plistPath = path.join(homedir(), 'Library/LaunchAgents/com.donew.shorttrader.plist');
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.donew.shorttrader</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${runScript}</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>StandardOutPath</key>
    <string>${logFile}</string>
    <key>StandardErrorPath</key>
    <string>${logFile}</string>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>`;
  fs.writeFileSync(plistPath, plist, 'utf-8');
  console.log(`✅ launchd 已安装: ${plistPath}`);
  console.log('\n启动: launchctl load ~/Library/LaunchAgents/com.donew.shorttrader.plist');
  console.log('停止: launchctl unload ~/Library/LaunchAgents/com.donew.shorttrader.plist');
  console.log('日志: ' + logFile);
}

// ─── CLI ─────────────────────────────────────────────────────────

function showVersion() {
  console.log(`Short-Term K-line Trader ${VERSION}`);
}

function editConfig() {
  ensureDir(AGENT_DIR);
  const cfgPath = CONFIG_FILE;
  if (!fs.existsSync(cfgPath)) saveJson(cfgPath, DEFAULT_CONFIG);
  execSync(`open "${cfgPath}"`);
  console.log(`📝 配置文件已打开: ${cfgPath}`);
}

async function serveDashboard() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/config') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(loadConfig(), null, 2));
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const newConfig = JSON.parse(body);
            saveConfig(newConfig);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        res.writeHead(405);
        res.end();
      }
    } else {
      const html = buildDashboardHtml();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
  });

  const PORT = 8765;
  server.listen(PORT, () => {
    console.log(`🌐 仪表板服务已启动: http://localhost:${PORT}`);
  });
}

async function showStats() {
  const stats = loadStats();
  const orders = loadOrders();
  const positions = loadPositions();
  const config = loadConfig();
  let unrealizedPnL = 0;
  for (const p of positions) {
    const kline = loadKlineCache(p.symbol);
    const bars = kline?.bars || [];
    const lastClose = bars.length ? bars[bars.length - 1].c : null;
    if (lastClose != null) unrealizedPnL += (lastClose - p.entryPrice) * p.shares;
  }
  const capital = config.capital || 100000;
  const totalEquity = capital + stats.netPnL + unrealizedPnL;
  console.log(`\n📊 短线交易统计\n`);
  console.log(`总资产: $${totalEquity.toFixed(2)} (本金 $${capital.toFixed(2)} | 已实现 $${stats.netPnL.toFixed(2)} | 浮动 $${(unrealizedPnL >= 0 ? '+' : '')}${unrealizedPnL.toFixed(2)})`);
  console.log(`总交易: ${stats.totalTrades} | 胜: ${stats.wins} | 负: ${stats.losses} | 胜率: ${stats.winRate}%`);
  console.log(`净PnL: $${stats.netPnL.toFixed(2)} | 最大回撤: $${stats.maxDrawdown.toFixed(2)}`);
  console.log(`平均盈利: $${stats.avgWin.toFixed(2)} | 平均亏损: $${stats.avgLoss.toFixed(2)}`);
  console.log(`连续亏损: ${stats.consecutiveLosses}`);

  if (stats.bySymbol && Object.keys(stats.bySymbol).length > 0) {
    console.log(`\n按标的:`);
    for (const [sym, st] of Object.entries(stats.bySymbol)) {
      const wr = st.trades > 0 ? Math.round(st.wins / st.trades * 10000) / 100 : 0;
      console.log(`  ${sym}: ${st.trades}笔 | W${st.wins}/L${st.losses} | PnL: $${st.pnl.toFixed(2)} | ${wr}%`);
    }
  }
  console.log('');
}

async function showPositions() {
  const positions = loadPositions();
  if (!positions.length) {
    console.log('\n暂无持仓\n');
    return;
  }
  console.log(`\n当前持仓 (${positions.length}):\n`);
  for (const p of positions) {
    const kline = loadKlineCache(p.symbol);
    const bars = kline?.bars || [];
    const lastClose = bars.length ? bars[bars.length - 1].c : null;
    const unrealized = lastClose != null ? (lastClose - p.entryPrice) * p.shares : null;
    const unrealizedStr = unrealized != null ? ` | 浮动PnL: $${(unrealized >= 0 ? '+' : '')}${unrealized.toFixed(2)}` : '';
    console.log(`  ${p.symbol}: 入场$${p.entryPrice.toFixed(2)} | 现价${lastClose != null ? '$' + lastClose.toFixed(2) : '-'} | 止损$${p.stopLoss.toFixed(2)} | 止盈$${p.takeProfit.toFixed(2)} | 股数:${p.shares}${unrealizedStr} | ${p.status}`);
  }
  console.log('');
}

async function main() {
  const cmd = process.argv[2] || '';

  await initKlineDb();

  switch (cmd) {
    case 'run':       await run();                break;
    case 'dashboard': await generateDashboard();  break;
    case 'stats':     await showStats();          break;
    case 'positions': await showPositions();      break;
    case 'setup':     await setupCron();          break;
    case 'env':       await setupEnv();           break;
    case 'config':    editConfig();               break;
    case 'serve':     await serveDashboard();      break;
    case 'version':   showVersion();              break;
    default:
      console.log('Usage: node scripts/short-term-trader.mjs [run|dashboard|stats|positions|setup|env|version]');
      console.log('  run       - 拉取5分钟K线 → AI信号 → 模拟交易 → 检查止盈止损');
      console.log('  dashboard - 生成可视化仪表板 (HTML)');
      console.log('  stats     - 显示统计面板');
      console.log('  positions - 显示当前持仓');
      console.log('  setup     - 安装 launchd 自动运行（每5分钟，仅美股交易时段）');
      console.log('  env       - 将 DEEPSEEK_API_KEY 写入本地 .env');
      console.log('  version   - 显示版本');
      console.log('\n首次使用: export DEEPSEEK_API_KEY=sk-xxx && node scripts/short-term-trader.mjs env');
      console.log('监控标的: QQQ / IBIT / MSTR | 5分钟K线 | 仅做多');
  }
}

main().catch(error => {
  console.error(`\n💥 Trader 异常: ${error.message}`);
  process.exit(1);
});
