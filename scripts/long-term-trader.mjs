#!/usr/bin/env node
// 长线交易机器人：日线趋势 + 日线进场 + ATR止损止盈
// Usage: node scripts/long-term-trader.mjs run|dashboard|stats|positions|env|version
//
// Env: DEEPSEEK_API_KEY（必需）
// Data: ~/.donew-trader-long/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = path.join(process.env.HOME || '~', '.donew-trader-long');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const POSITIONS_FILE = path.join(DATA_DIR, 'positions.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const SIGNALS_DIR = path.join(DATA_DIR, 'signals');
const KLINES_DIR = path.join(DATA_DIR, 'kline');
const ENV_FILE = path.join(DATA_DIR, '.env');
const DASHBOARD_FILE = path.join(DATA_DIR, 'dashboard.html');

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const VERSION = 'v2.0.5';
const VERSION_NOTE = '2026-08-06 | 运行锁/原子写/Yahoo超时/K线新鲜度前置';

// ─── ntfy ───────────────────────────────────────────────────────
const NTFY_TOPIC = 'dudiaozhangtest112233';
const NTFY_TOKEN = 'tk_yw31dbl7scelalsvk3rhc0fhqvei6';
const NTFY_SERVER = 'https://ntfy.sh';

const LOCK_FILE = path.join(DATA_DIR, 'long-term-trader.lock');
const LOCK_STALE_MS = 10 * 60 * 1000; // 锁超过 10 分钟视为过期（正常运行不应这么久）

const DEFAULT_CONFIG = {
  symbols: ['QQQ', 'IBIT', 'MSTR', 'TSLA', 'EEM', 'BTC-USD', 'UGL', 'FUTU', '0700.HK', '9988.HK', '0883.HK', '3032.HK', 'QLD', 'INTC'],
  capital: 100000,
  positionSize: 10000,
  maxPositions: 5,
  model: 'deepseek-v4-flash',
  fxRate: 7.8,
};

// ─── Helpers ──────────────────────────────────────────────────

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { throw new Error(`mkdir ${dir} 失败: ${e.message}`); }
}
ensureDir(DATA_DIR);
ensureDir(KLINES_DIR);
ensureDir(SIGNALS_DIR);

function loadJson(fpath) {
  try { return JSON.parse(fs.readFileSync(fpath, 'utf-8')); } catch { return null; }
}

// 原子写：先写临时文件，再 rename 覆盖，避免半截文件
function atomicWriteText(fpath, content) {
  const tmp = fpath + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, fpath);
  } finally {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
  }
}

function saveJson(fpath, data) {
  atomicWriteText(fpath, JSON.stringify(data, null, 2));
}

// ─── Run Lock ─────────────────────────────────────────────────

function acquireLock(mode) {
  const now = Date.now();
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      const alive = lock && Number.isInteger(lock.pid) && isPidAlive(lock.pid);
      const stale = !alive || (now - (lock.startedAt || 0)) > LOCK_STALE_MS;
      if (!stale) {
        throw new Error(`已有运行实例 (pid=${lock.pid}, mode=${lock.mode || '?'}, startedAt=${lock.startedAt || '?'})，跳过本次`);
      }
      // 过期锁：进程不存在或超时，清理
      try { fs.unlinkSync(LOCK_FILE); } catch {}
    }
    atomicWriteText(LOCK_FILE, JSON.stringify({ pid: process.pid, mode, startedAt: now }));
    return true;
  } catch (e) {
    if (e.message.includes('已有运行实例')) throw e;
    // 其他错误（写入失败等）不阻塞，仅提示
    console.log(`  ⚠️ 运行锁写入失败: ${e.message}`);
    return false;
  }
}

function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function releaseLock() {
  try {
    const lock = loadJson(LOCK_FILE);
    if (lock && lock.pid === process.pid) {
      try { fs.unlinkSync(LOCK_FILE); } catch {}
    }
  } catch {}
}

// ─── Unified fetch with timeout ───────────────────────────────

async function fetchWithTimeout(url, options = {}, timeoutMs, label = 'HTTP') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${label}超时(${timeoutMs}ms)`);
    throw new Error(`${label}请求失败: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
}
function fmtNodeDate(t){var d=new Date(t),p=function(n){return(n<10?'0':'')+n};return p(d.getMonth()+1)+p(d.getDate())+' '+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());}
function fmtUSD(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2); }
function fmtPct(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }

// ─── Config ───────────────────────────────────────────────────

function loadConfig() {
  const saved = loadJson(CONFIG_FILE);
  if (saved && Array.isArray(saved.symbols)) return saved;
  saveJson(CONFIG_FILE, DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) { saveJson(CONFIG_FILE, config); }

function readApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = content.match(/DEEPSEEK_API_KEY\s*=\s*(.+)/);
    return match ? match[1].trim().replace(/["']/g, '') : null;
  } catch { return null; }
}

// ─── Data ─────────────────────────────────────────────────────

function loadPositions() {
  return loadJson(POSITIONS_FILE) || [];
}

function savePositions(data) {
  saveJson(POSITIONS_FILE, data);
}

function loadOrders() {
  return loadJson(ORDERS_FILE) || [];
}

function saveOrders(data) {
  saveJson(ORDERS_FILE, data);
}

function loadWeeklyCache(symbol) {
  return loadJson(path.join(KLINES_DIR, symbol + '_weekly.json'));
}

function saveWeeklyCache(symbol, data) {
  saveJson(path.join(KLINES_DIR, symbol + '_weekly.json'), data);
}

function loadSignals(symbol) {
  return loadJson(path.join(SIGNALS_DIR, symbol + '.json')) || [];
}

function saveSignals(symbol, data) {
  saveJson(path.join(SIGNALS_DIR, symbol + '.json'), data);
}

async function fetchBars(symbol, interval, range) {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&events=history&includePrePost=false`;
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-long/1.0)' } }, 15000, 'Yahoo K线');
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.open || [], highs = quote.high || [], lows = quote.low || [];
    const closes = quote.close || [], volumes = quote.volume || [];

    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      bars.push({
        t: timestamps[i], o: num(opens[i]), h: num(highs[i]),
        l: num(lows[i]), c: num(closes[i]), v: num(volumes[i]) || 0,
      });
    }
    return bars;
  } catch (e) {
    console.log(`    ⚠️ ${e.message} (${symbol})`);
    return null;
  }
}

// ─── K-line Freshness ─────────────────────────────────────────

// 日线新鲜度：最后一个 bar 距离今天超过 maxDays 视为过期。
// 周末/节假日允许保留上一交易日，故给 4 天宽限（周一跑时最后bar是上周五≈3天前）。
function checkKlineFreshness(bars, interval, maxDays = 4) {
  if (!bars || !bars.length) {
    return { ok: false, stale: true, staleReason: '无K线数据' };
  }
  const lastT = bars[bars.length - 1].t;
  const lastDate = new Date(lastT * 1000);
  const now = new Date();
  const daysOld = (now - lastDate) / 86400000;
  const stale = daysOld > maxDays;
  return {
    ok: !stale,
    stale,
    staleReason: stale ? `最后K线 ${fmtNodeDate(lastDate)}，距今 ${daysOld.toFixed(1)} 天 (>${maxDays}天)` : `K线新鲜(${daysOld.toFixed(1)}天)`,
    lastDataTime: new Date(lastT * 1000).toISOString(),
    lastDate,
  };
}

function checkDailyBarsFresh(dailyBars) {
  return checkKlineFreshness(dailyBars, '1d', 4);
}

// ─── Technical Indicators ─────────────────────────────────────

function calcEMA(values, period) {
  if (!values || values.length < period) return values?.[values.length - 1] || null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) ema = values[i] * k + ema * (1 - k);
  return Math.round(ema * 100) / 100;
}

function calcMACD(closes) {
  const shortPeriod = 12, longPeriod = 26, signalPeriod = 9;
  const emaShort = calcEMA(closes, shortPeriod);
  const emaLong = calcEMA(closes, longPeriod);
  if (emaShort == null || emaLong == null) return null;
  const dif = Math.round((emaShort - emaLong) * 100) / 100;
  const deaPeriod = Math.min(signalPeriod, closes.length);
  const dea = calcEMA(Array(closes.length).fill(dif).slice(-deaPeriod), deaPeriod) || 0;
  return { dif, dea, hist: Math.round((dif - dea) * 100) / 100 };
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta; else losses -= delta;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return Math.round(100 - 100 / (1 + avgGain / avgLoss) * 10) / 10;
}

function calcATR(bars, period = 14) {
  if (!bars || bars.length < period + 1) return null;
  let trs = [];
  for (let i = bars.length - period; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, prevC = bars[i - 1].c;
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trs.push(tr);
  }
  return Math.round(trs.reduce((a, b) => a + b, 0) / trs.length * 100) / 100;
}

function calcKeyLevels(bars) {
  if (!bars || bars.length < 50) return { supports: [], resistances: [] };
  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h), lows = bars.map(b => b.l);
  const lastClose = closes[closes.length - 1];

  const maxH50 = Math.max(...highs.slice(-50));
  const minL50 = Math.min(...lows.slice(-50));
  const range = maxH50 - minL50;

  const supports = [], resistances = [];
  for (let pct = 0.618; pct <= 1.0; pct += 0.191) {
    const level = Math.round((minL50 + range * pct) * 100) / 100;
    if (level < lastClose * 0.995) supports.push(level);
    else if (level > lastClose * 1.005) resistances.push(level);
  }

  // add round number levels
  const roundBase = Math.floor(lastClose * 0.01) * 100;
  for (let r = roundBase - 200; r <= roundBase + 200; r += 100) {
    if (r < lastClose && !supports.includes(r)) supports.push(r);
    if (r > lastClose && !resistances.includes(r)) resistances.push(r);
  }

  supports.sort((a, b) => b - a);
  resistances.sort((a, b) => a - b);
  return { supports: supports.slice(0, 3), resistances: resistances.slice(0, 3) };
}

// ─── Weekly Direction Filter ──────────────────────────────────

async function getWeeklyDirection(symbol) {
  // Cache: 1 day (weekly bars don't change intra-week)
  const cache = loadWeeklyCache(symbol);
  if (cache && cache.date && Date.now() - new Date(cache.date).getTime() < 24 * 3600 * 1000 && cache.bars && cache.bars.length >= 9) {
    return calcWeeklyDirection(cache.bars);
  }

  const bars = await fetchBars(symbol, '1wk', '1y');
  if (!bars || bars.length < 9) return null;
  saveWeeklyCache(symbol, { date: new Date().toISOString(), bars });
  return calcWeeklyDirection(bars);
}

function calcWeeklyDirection(weeklyBars) {
  const closes = weeklyBars.map(b => b.c);
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const lastPrice = closes[closes.length - 1];
  if (ema9 == null || ema21 == null) return null;

  const bullish = ema9 > ema21 && lastPrice > ema9;
  return {
    bullish,
    ema9: Math.round(ema9 * 100) / 100,
    ema21: Math.round(ema21 * 100) / 100,
    lastPrice: Math.round(lastPrice * 100) / 100,
    reason: bullish
      ? `日线多头（EMA9:${ema9.toFixed(2)} > EMA21:${ema21.toFixed(2)}，价>EMA9）`
      : (ema9 > ema21 ? `日线中性（EMA多头但价略低于EMA9）` : `日线空头（EMA9:${ema9.toFixed(2)} < EMA21:${ema21.toFixed(2)}）`),
  };
}

// ─── Daily Indicators + Entry Rules ───────────────────────────

function computeDailyIndicators(bars) {
  if (!bars || bars.length < 55) return null;
  const closes = bars.map(b => b.c);
  const last30 = bars.slice(-30);

  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema55 = calcEMA(closes, 55);
  const lastPrice = closes[closes.length - 1];
  const priceVsEma9 = ema9 > 0 ? Math.round((lastPrice / ema9 - 1) * 10000) / 100 : null;
  const priceVsEma21 = ema21 > 0 ? Math.round((lastPrice / ema21 - 1) * 10000) / 100 : null;

  const macd = calcMACD(closes);
  const rsi = calcRSI(closes);

  const atr = calcATR(bars);

  const validVolumes = last30.map(b => b.v).filter(v => v > 0);
  const avgVolume = validVolumes.length > 0 ? validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length : 0;
  const lastVolume = validVolumes.length > 0 ? validVolumes[validVolumes.length - 1] : 0;
  const volumeRatio = avgVolume > 0 ? Math.round(lastVolume / avgVolume * 100) / 100 : 1;

  const keyLevels = calcKeyLevels(bars);

  return {
    ema9, ema21, ema55, price_vs_ema9: priceVsEma9, price_vs_ema21: priceVsEma21,
    macd: macd || { dif: 0, dea: 0, hist: 0 },
    rsi: Math.round(rsi * 10) / 10,
    atr: atr ? Math.round(atr * 100) / 100 : null,
    volumeRatio,
    keyLevels,
  };
}

function checkEntryRules(indicators) {
  if (!indicators) return { triggered: false, details: {} };
  const details = {
    macd: !!(indicators.macd && indicators.macd.hist > 0),
    rsi: !!(indicators.rsi != null && indicators.rsi > 50),
    ema: !!(indicators.price_vs_ema9 != null && indicators.price_vs_ema9 > 0),
    volume: !!(indicators.volumeRatio != null && indicators.volumeRatio > 0.8),
  };
  const passed = [details.macd, details.rsi, details.ema, details.volume].filter(Boolean).length;
  const triggered = details.ema && passed >= 3;
  return { triggered, details };
}

function calcLongTermStopLevels(entryPrice, atr) {
  const slPct = Math.max((atr / entryPrice) * 3, 0.03); // at least 3% SL for long-term
  const stopLoss = Math.round(entryPrice * (1 - slPct) * 100) / 100;
  const takeProfit = Math.round(entryPrice * (1 + slPct * 2) * 100) / 100; // 1:2
  return { stopLoss, takeProfit, slPct: Math.round(slPct * 10000) / 100 };
}

// ─── ntfy Notification ────────────────────────────────────────

async function sendNotify(title, message, tags = '') {
  try {
    const res = await fetchWithTimeout(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NTFY_TOKEN}`,
        'Title': title.replace(/[^\x00-\x7F]/g, '').trim() || 'donew',
        'Priority': '4',
        ...(tags ? { 'Tags': tags } : {}),
        'Markdown': 'yes',
      },
      body: message,
    }, 10000, 'ntfy');
    if (!res.ok) throw new Error(`ntfy ${res.status}`);
    console.log(`  📲 通知: ${title}`);
  } catch (e) {
    console.log(`  ⚠️ 通知失败: ${e.message}`);
  }
}

// ─── DeepSeek AI ──────────────────────────────────────────────

async function callDeepSeek(systemPrompt, userMessage) {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY');

  const model = loadConfig().model || 'deepseek-v4-flash';
  const res = await fetchWithTimeout(DEEPSEEK_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], temperature: 0.3, max_tokens: 500 }),
  }, 30000, 'DeepSeek');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`DeepSeek ${res.status}: ${err.error?.message || res.statusText}`);
  }
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content || '';
  if (!raw.trim()) throw new Error('Empty API response (rate limited)');
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return { score: Number(parsed.score) || 0, reasoning: String(parsed.reasoning || '').slice(0, 200) };
  } catch {
    return { score: 0, reasoning: raw.slice(0, 200) || '(空响应)' };
  }
}

function buildScorePrompt(symbol, indicators, weekly) {
  const ind = indicators;
  let posSection = '';
  if (ind.keyLevels) {
    posSection = `
关键价位：
- 支撑: ${ind.keyLevels.supports.map(v => '$' + v).join(', ') || '暂无'}
- 阻力: ${ind.keyLevels.resistances.map(v => '$' + v).join(', ') || '暂无'}`;
  }

  return `评估 ${symbol} 当前的日线做多机会质量。

长线背景（日线）：${weekly.reason}

日线技术指标：
- EMA(9): $${ind.ema9}  |  价格位置: ${ind.price_vs_ema9 > 0 ? '+' : ''}${ind.price_vs_ema9}%
- EMA(21): $${ind.ema21}  |  EMA(55): $${ind.ema55}
- MACD: DIF=${ind.macd.dif}, DEA=${ind.macd.dea}, HIST=${ind.macd.hist}
- RSI(14): ${ind.rsi}
- ATR(14): ${ind.atr}
- 量比: ${ind.volumeRatio}x${posSection}

评分标准（1-10分）：
- 1-3: 日线空头或日线趋势不明
- 4-6: 中性，信号不明确
- 7-8: 日线趋势向上，MACD金叉，RSI配合
- 9-10: 日线+日线共振，多指标完美

严格输出 JSON：
{ "score": 1-10整数, "reasoning": "中文理由，提及日线方向和日线关键指标，不超过100字" }`;
}

async function scoreEntry(symbol, indicators, weekly) {
  if (!indicators) return { score: 0, reasoning: '技术指标不足' };
  const systemPrompt = '你是一个专业长线股票分析师。基于日线趋势和日线技术指标做评分判断，不参考新闻或基本面。';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await callDeepSeek(systemPrompt, buildScorePrompt(symbol, indicators, weekly));
      return { score: Math.min(10, Math.max(1, Math.round(result.score))), reasoning: result.reasoning };
    } catch (error) {
      if (attempt === 1) return { score: 0, reasoning: `AI失败: ${error.message}` };
      console.log(`（重试...）`);
      await sleep(5000);
    }
  }
}

// ─── Trade Execution ──────────────────────────────────────────

function openPosition(symbol, signal, price, atr) {
  const config = loadConfig();
  const fxRate = config.fxRate || 7.8; // HKD → USD
  const isHk = /\.HK$/i.test(symbol);
  const usdPrice = isHk ? price / fxRate : price;
  const rawShares = config.positionSize / usdPrice;
  const shares = Math.round(rawShares * 100000) / 100000;
  const cost = Math.round(shares * price * 100) / 100; // in native currency
  if (cost < 10) { console.log(`    ⚠️ 仓位不足（$${cost}），跳过`); return null; }

  const levels = calcLongTermStopLevels(price, atr);
  return {
    id: `${symbol}_${Date.now()}`,
    symbol,
    entryPrice: price,
    shares,
    cost,
    stopLoss: levels.stopLoss,
    takeProfit: levels.takeProfit,
    entryTime: new Date().toISOString(),
    status: 'OPEN',
  };
}

function closePosition(position, reason, exitPrice) {
  if (position.status !== 'OPEN') return null;
  position.status = 'CLOSED';
  position.closeTime = new Date().toISOString();
  position.closeReason = reason;
  position.exitPrice = exitPrice;
  position.pnl = Math.round((exitPrice - position.entryPrice) * position.shares * 100) / 100;
  position.pnlPct = Math.round((exitPrice / position.entryPrice - 1) * 10000) / 100;
  return position;
}

function checkExits(positions, bars) {
  if (!positions.length || !bars.length) return [];
  const closed = [];
  const currentBar = bars[bars.length - 1];
  const prevBar = bars.length > 1 ? bars[bars.length - 2] : currentBar;

  for (const pos of positions) {
    if (pos.status !== 'OPEN') continue;

    // Don't close within 1 bar of entry
    const entryTime = new Date(pos.entryTime).getTime() / 1000;
    if (bars.filter(b => b.t >= entryTime).length < 2) continue;

    if (prevBar.c >= pos.stopLoss && currentBar.c < pos.stopLoss) {
      closePosition(pos, '止损触发', pos.stopLoss);
      closed.push({ ...pos, exitType: 'STOP_LOSS' });
    } else if (prevBar.c <= pos.takeProfit && currentBar.c > pos.takeProfit) {
      closePosition(pos, '止盈触发', pos.takeProfit);
      closed.push({ ...pos, exitType: 'TAKE_PROFIT' });
    } else if (currentBar.l <= pos.stopLoss) {
      closePosition(pos, '止损穿透', currentBar.o);
      closed.push({ ...pos, exitType: 'STOP_LOSS_GAP' });
    } else if (currentBar.h >= pos.takeProfit) {
      closePosition(pos, '止盈穿透', currentBar.o);
      closed.push({ ...pos, exitType: 'TAKE_PROFIT_GAP' });
    }
  }
  return closed;
}

function recalcStats(orders) {
  const closed = orders.filter(o => o.action === 'CLOSE' && o.pnl != null);
  const wins = closed.filter(o => o.pnl > 0);
  const losses = closed.filter(o => o.pnl < 0);
  const netPnL = Math.round(closed.reduce((s, o) => s + (o.pnl || 0), 0) * 100) / 100;

  let peak = 0, drawdown = 0, running = 0;
  for (const o of closed) { running += (o.pnl || 0); if (running > peak) peak = running; drawdown = Math.max(drawdown, peak - running); }

  const bySymbol = {};
  for (const o of closed) {
    bySymbol[o.symbol] = bySymbol[o.symbol] || { trades: 0, wins: 0, losses: 0, pnl: 0 };
    bySymbol[o.symbol].trades++;
    if (o.pnl > 0) bySymbol[o.symbol].wins++; else bySymbol[o.symbol].losses++;
    bySymbol[o.symbol].pnl = Math.round((bySymbol[o.symbol].pnl + (o.pnl || 0)) * 100) / 100;
  }

  return {
    totalTrades: closed.length, wins: wins.length, losses: losses.length,
    winRate: closed.length ? Math.round(wins.length / closed.length * 100) : 0,
    netPnL, maxDrawdown: Math.round(drawdown * 100) / 100,
    avgWin: wins.length ? Math.round(wins.reduce((s, o) => s + o.pnl, 0) / wins.length * 100) / 100 : 0,
    avgLoss: losses.length ? Math.round(losses.reduce((s, o) => s + Math.abs(o.pnl), 0) / losses.length * 100) / 100 : 0,
    bySymbol,
  };
}

// ─── Main Run ─────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main Run ─────────────────────────────────────────────────

async function run(marketFilter = null) {
  const marketLabel = marketFilter === 'hk' ? '港股+BTC' : marketFilter === 'us' ? '美股+BTC' : '全市场';
  console.log(`\n┌──────────────────────────────────────────┐`);
  console.log(`│  📈 Long-Term Trader ${VERSION}                    │`);
  console.log(`│  日线趋势 + 日线进场 + ATR止盈止损  [${marketLabel}] │`);
  console.log(`└──────────────────────────────────────────┘\n`);

  const config = loadConfig();

  // Filter symbols by market type
  const isHk = (s) => /\.HK$/i.test(s);
  const isUs = (s) => !isHk(s);
  const isBtc = (s) => /BTC/i.test(s);
  let activeSymbols;
  if (marketFilter === 'hk') activeSymbols = config.symbols.filter(s => isHk(s) || isBtc(s));
  else if (marketFilter === 'us') activeSymbols = config.symbols.filter(s => isUs(s) || isBtc(s));
  else activeSymbols = [...config.symbols];
  console.log(`标的 (${activeSymbols.length}): ${activeSymbols.join(', ')}`);
  console.log(`资金: $${config.capital.toLocaleString()} | 单笔: $${config.positionSize.toLocaleString()} | 最大持仓: ${config.maxPositions}`);
  console.log(`运行时间: ${fmtNodeDate(new Date())}\n`);

  const positions = loadPositions();
  console.log(`当前持仓: ${positions.filter(p => p.status === 'OPEN').length}/${config.maxPositions}`);

  // Step 1: Check exits
  let allExits = [];
  for (const pos of positions) {
    if (pos.status !== 'OPEN') continue;
    const dailyBars = await fetchBars(pos.symbol, '1d', '3mo');
    if (dailyBars && dailyBars.length > 1) {
      const exits = checkExits([pos], dailyBars);
      if (exits.length) {
        for (const exit of exits) {
          const isWin = (exit.pnl || 0) > 0;
          console.log(`  ${isWin ? '💰' : '🩸'} ${exit.symbol} 平仓: $${exit.exitPrice} | PnL: $${fmtUSD(exit.pnl)} (${fmtPct(exit.pnlPct)})`);
          await sendNotify(
            `${isWin ? '💰 止盈' : '🩸 止损'} ${exit.symbol} $${exit.exitPrice}`,
            `**${exit.symbol}** ${exit.closeReason}\n入场: $${exit.entryPrice.toFixed(2)} → 出场: $${exit.exitPrice.toFixed(2)}\nPnL: **$${exit.pnl.toFixed(2)}** (${exit.pnlPct > 0 ? '+' : ''}${exit.pnlPct}%)`,
            isWin ? 'moneybag' : 'skull'
          );
        }
        allExits.push(...exits);
      }
    }
  }

  // Save closed positions
  if (allExits.length) {
    const orders = loadOrders();
    for (const exit of allExits) {
      orders.push({
        id: exit.id, symbol: exit.symbol, action: 'CLOSE', side: 'SELL',
        price: exit.exitPrice, shares: exit.shares,
        revenue: Math.round(exit.exitPrice * exit.shares * 100) / 100,
        pnl: exit.pnl, pnlPct: exit.pnlPct,
        reason: exit.closeReason, time: exit.closeTime,
        entryTime: exit.entryTime, entryPrice: exit.entryPrice,
      });
    }
    savePositions(positions.filter(p => p.status === 'OPEN'));
    saveOrders(orders);
    saveJson(STATS_FILE, recalcStats(orders));
  }
  if (!allExits.length) console.log('  无触发离场');

  // Step 2: Entry signals
  console.log('\n━━ 开仓信号 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  let newCount = 0;

  for (const symbol of activeSymbols) {
    const openPositions = positions.filter(p => p.status === 'OPEN');
    if (openPositions.length >= config.maxPositions) {
      console.log(`  ⚠️ 已达最大持仓 ${config.maxPositions}，跳过剩余标的`);
      break;
    }

    console.log(`\n  ${symbol}:`);
    process.stdout.write(`    📡 日线...`);
    const dailyBars = await fetchBars(symbol, '1d', '3mo');
    if (!dailyBars || dailyBars.length < 55) { console.log(` 数据不足`); continue; }
    console.log(` ${dailyBars.length}根`);

    // 新鲜度校验：过期则不开仓、不生成 BUY
    const freshness = checkDailyBarsFresh(dailyBars);
    const klineMeta = {
      source: 'yahoo-chart',
      fetchedAt: new Date().toISOString(),
      lastDataTime: freshness.lastDataTime || null,
      ok: freshness.ok,
      stale: freshness.stale,
      staleReason: freshness.staleReason,
      error: null,
    };
    saveJson(path.join(KLINES_DIR, symbol + '_daily.json'), { date: new Date().toISOString(), bars: dailyBars, meta: klineMeta });
    if (freshness.stale) {
      console.log(`    ⚠️ ${freshness.staleReason} → 旧K线，仅作参考，不开仓`);
      saveSignals(symbol, [...loadSignals(symbol), {
        time: new Date().toISOString(), price: dailyBars[dailyBars.length-1].c,
        decision: 'SKIP', reasoning: `旧K线 | ${freshness.staleReason}`,
        rulesTriggered: false, aiScore: 0, stale: true, staleReason: freshness.staleReason,
        klineMeta,
      }]);
      continue;
    }

    // Daily EMA direction filter (replaces weekly)
    const closes = dailyBars.map(b => b.c);
    const dema9 = calcEMA(closes, 9);
    const dema21 = calcEMA(closes, 21);
    const lastPrice = closes[closes.length - 1];
    const dailyBullish = dema9 != null && dema21 != null && dema9 > dema21 && lastPrice > dema9;
    const dailyMark = dailyBullish ? '✅' : '❌';
    const dailyReason = dailyBullish
      ? `日线多头（EMA9:${dema9.toFixed(2)} > EMA21:${dema21.toFixed(2)}，价>EMA9）`
      : (dema9 > dema21 ? `日线中性（EMA多头但价略低于EMA9）` : `日线空头（EMA9:${dema9.toFixed(2)} < EMA21:${dema21.toFixed(2)}）`);
    console.log(`    EMA ${dailyMark} ${dailyReason}`);
    const weekly = { bullish: dailyBullish, ema9: dema9, ema21: dema21, lastPrice, reason: dailyReason };

    if (!dailyBullish) {
      const indicators = computeDailyIndicators(dailyBars);
      if (!indicators) { continue; }

      const rules = checkEntryRules(indicators);
      const ruleIcons = `MACD:${rules.details.macd?'✅':'❌'} RSI:${rules.details.rsi?'✅':'❌'} EMA:${rules.details.ema?'✅':'❌'} Vol:${rules.details.volume?'✅':'❌'}`;
      console.log(`    规则: ${ruleIcons} | ${rules.triggered ? '✅ 触发（若日线多则可开仓）' : '❌ 未触发'}`);

      process.stdout.write(`    🧠 AI评分...`);
      const ai = await scoreEntry(symbol, indicators, weekly);
      console.log(` ${ai.score}/10`);
      console.log(`       ${ai.reasoning}`);
      await sleep(8000);

      saveSignals(symbol, [...loadSignals(symbol), {
        time: new Date().toISOString(), price: dailyBars[dailyBars.length-1].c,
        decision: 'SKIP', reasoning: `日线空头 | ${ai.reasoning}`,
        rulesTriggered: rules.triggered, rules: rules.details, aiScore: ai.score,
        weekly: { bullish: false, ema9: weekly.ema9, ema21: weekly.ema21 },
        indicators: { ema9: indicators.ema9, ema21: indicators.ema21, rsi: indicators.rsi,
          macdHist: indicators.macd.hist, volumeRatio: indicators.volumeRatio },
      }]);
      continue;
    }

    // Check if already holding
    if (openPositions.find(p => p.symbol === symbol)) {
      const pos = openPositions.find(p => p.symbol === symbol);
      const lastPrice = dailyBars[dailyBars.length - 1].c;
      const pnl = Math.round((lastPrice - pos.entryPrice) / pos.entryPrice * 10000) / 100;
      console.log(`    💼 持有仓位: $${pos.entryPrice} | 浮盈: ${pnl > 0 ? '+' : ''}${pnl}%`);
      continue;
    }

    // Compute daily indicators
    const indicators = computeDailyIndicators(dailyBars);
    if (!indicators) { console.log(`    指标不足`); continue; }

    // Entry rules
    const rules = checkEntryRules(indicators);
    const ruleIcons = `MACD:${rules.details.macd?'✅':'❌'} RSI:${rules.details.rsi?'✅':'❌'} EMA:${rules.details.ema?'✅':'❌'} Vol:${rules.details.volume?'✅':'❌'}`;
    console.log(`    规则: ${ruleIcons} | ${rules.triggered ? '✅ 触发' : '❌ 未触发'}`);

    if (!rules.triggered) {
      process.stdout.write(`    🧠 AI评分...`);
      const ai = await scoreEntry(symbol, indicators, weekly);
      console.log(` ${ai.score}/10 | ${ai.reasoning}`);
      await sleep(8000);
      saveSignals(symbol, [...loadSignals(symbol), {
        time: new Date().toISOString(), price: indicators.ema9 != null ? dailyBars[dailyBars.length-1].c : null,
        decision: 'SKIP', reasoning: ai.reasoning,
        rulesTriggered: false, rules: rules.details, aiScore: ai.score,
        weekly: { bullish: weekly.bullish, ema9: weekly.ema9, ema21: weekly.ema21 },
      }]);
      continue;
    }

    // AI score
    process.stdout.write(`    🧠 AI评分...`);
    const ai = await scoreEntry(symbol, indicators, weekly);
    console.log(` ${ai.score}/10`);
    console.log(`       ${ai.reasoning}`);
    await sleep(8000);

    if (ai.score < 6) {
      console.log(`    ⏸️  评分不足，跳过 (>=6开仓)`);
      saveSignals(symbol, [...loadSignals(symbol), {
        time: new Date().toISOString(), price: dailyBars[dailyBars.length-1].c,
        decision: 'SKIP', reasoning: ai.reasoning,
        rulesTriggered: true, rules: rules.details, aiScore: ai.score,
        weekly: { bullish: weekly.bullish, ema9: weekly.ema9, ema21: weekly.ema21 },
      }]);
      continue;
    }

    // Open position
    const lastBar = dailyBars[dailyBars.length - 1];
    const pos = openPosition(symbol, { score: ai.score }, lastBar.c, indicators.atr);
    if (!pos) continue;

    positions.push(pos);
    const order = {
      id: pos.id, symbol: pos.symbol, action: 'OPEN', side: 'BUY',
      price: pos.entryPrice, shares: pos.shares, cost: pos.cost,
      stopLoss: pos.stopLoss, takeProfit: pos.takeProfit,
      time: pos.entryTime,
    };
    const orders = loadOrders();
    orders.push(order);
    saveOrders(orders);
    savePositions(positions);
    saveJson(STATS_FILE, recalcStats(orders));

    newCount++;
    console.log(`    ✅ 开仓 $${pos.entryPrice} × ${pos.shares}股 = $${pos.cost}`);
    console.log(`       止损: $${pos.stopLoss} | 止盈: $${pos.takeProfit}`);
    const riskL = Math.round((pos.entryPrice - pos.stopLoss) * pos.shares * 100) / 100;
    const rewardL = Math.round((pos.takeProfit - pos.entryPrice) * pos.shares * 100) / 100;
    await sendNotify(
      `OPEN ${symbol} $${pos.entryPrice.toFixed(2)}`,
      `**${symbol}** 买入 × ${pos.shares}股  $${pos.entryPrice.toFixed(2)}\n\n止损: $${pos.stopLoss.toFixed(2)} | 止盈: $${pos.takeProfit.toFixed(2)}\n风险: -$${riskL.toFixed(2)} | 预期收益: +$${rewardL.toFixed(2)} (1:2)\nAI: ${ai.score}/10\n日线: ${weekly.reason}`,
      'money_bag'
    );
  }

  if (newCount === 0) console.log(`\n  无新开仓`);

  // Summary
  const finalPositions = positions.filter(p => p.status === 'OPEN');
  const stats = loadJson(STATS_FILE) || recalcStats(loadOrders());
  console.log(`\n━━ 总结 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  总交易: ${stats.totalTrades} | 胜: ${stats.wins} | 负: ${stats.losses} | 胜率: ${stats.winRate}%`);
  console.log(`  净PnL: $${stats.netPnL.toFixed(2)} | 最大回撤: $${stats.maxDrawdown.toFixed(2)}`);
  if (finalPositions.length) console.log(`  持仓: ${finalPositions.length}个 | ${finalPositions.map(p => p.symbol).join(', ')}`);
  console.log('');
}

// ─── CLI ──────────────────────────────────────────────────────

async function generateDashboard() {
  const orders = loadOrders();
  const positions = loadPositions();
  const stats = loadJson(STATS_FILE) || recalcStats(orders);
  const config = loadConfig();

  // Load signals
  const signals = {};
  try {
    for (const f of fs.readdirSync(SIGNALS_DIR)) {
      if (f.endsWith('.json')) {
        const sym = f.replace('.json', '');
        signals[sym] = loadJson(path.join(SIGNALS_DIR, f)) || [];
      }
    }
  } catch {}

  // Load daily kline data
  const klines = {};
  const klinesMeta = {};
  try {
    for (const f of fs.readdirSync(KLINES_DIR)) {
      if (f.endsWith('_daily.json')) {
        const sym = f.replace('_daily.json', '');
        const d = loadJson(path.join(KLINES_DIR, f));
        if (d && d.bars) klines[sym] = d.bars.map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c }));
        if (d && d.meta) klinesMeta[sym] = d.meta;
      }
    }
  } catch {}

  const dataJson = JSON.stringify({
    config, stats, positions, orders: orders.reverse(), signals, klines, klinesMeta, generatedAt: new Date().toISOString(),
  });

  const symList = JSON.stringify(config.symbols);

  const html = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>长线交易机器人 — 仪表板</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='2' y='2' width='28' height='28' rx='6' fill='%234da8ff'/><text x='16' y='23' font-size='20' font-family='PingFang SC,sans-serif' font-weight='bold' text-anchor='middle' fill='white'>%E9%95%BF</text></svg>">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1522;color:#d4dae6;line-height:1.5}
.header{background:linear-gradient(135deg,#1a2740 0%,#0f1b2e 100%);padding:16px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a3a52}
.header h1{font-size:1.5rem;color:#e8edf5}
.header-right{display:flex;align-items:center;gap:12px;color:#6b7fa3;font-size:.85rem}
.tabs{display:flex;gap:2px;padding:0 24px;background:#131d31;border-bottom:1px solid #1f2b44}
.tab{padding:10px 18px;font-size:.9rem;font-weight:600;cursor:pointer;color:#6b7fa3;border:none;background:none;border-bottom:2px solid transparent;transition:all .15s}
.tab:hover{color:#b0c4e8}
.tab.active{color:#4da8ff;border-bottom-color:#4da8ff}
.content{padding:20px 24px;max-width:1200px;margin:0 auto}
.card{background:#162234;border:1px solid #2a3a52;border-radius:8px;padding:16px;margin-bottom:16px}
.card h2{font-size:15px;color:#c8d6e5;margin-bottom:12px;font-weight:600}
.card h3{font-size:13px;color:#8ea3be;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{background:#1a2b42;padding:8px 12px;text-align:left;font-weight:600;color:#8ea3be;border-bottom:2px solid #2a3a52;white-space:nowrap}
tbody td{padding:8px 12px;border-bottom:1px solid #1e3048}
tbody tr:hover{background:#1a2b42}
.buy{color:#4caf50;font-weight:600}
.sell{color:#f44336;font-weight:600}
.hold{color:#ff9800}
.win{color:#4caf50}
.loss{color:#f44336}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px}
.stat-card{background:#1a2b42;border-radius:8px;padding:14px;text-align:center}
.stat-card .label{font-size:11px;color:#6b7d99;text-transform:uppercase;margin-bottom:4px}
.stat-card .value{font-size:22px;font-weight:700;color:#e8edf5}
.stat-card .sub{font-size:11px;color:#6b7d99;margin-top:2px}
.chart-container{border:1px solid #2a3a52;border-radius:8px;overflow:hidden}
.empty{text-align:center;padding:40px;color:#6b7d99;font-size:14px}
.symbol-selector{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.symbol-btn{padding:6px 14px;border:1px solid #2a3a52;border-radius:6px;background:#1a2b42;color:#8ea3be;cursor:pointer;font-size:13px;transition:all .2s}
.symbol-btn:hover{border-color:#4da8ff;color:#4da8ff}
.symbol-btn.active{background:rgba(77,168,255,.15);border-color:#4da8ff;color:#4da8ff}
.signal-pagination{display:flex;gap:6px;align-items:center;justify-content:center;padding:10px 0;font-size:12px;color:#6b7d99}
.signal-pagination button{background:#1a2b42;border:1px solid #2a3a52;color:#8ea3be;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px}
.signal-pagination button:hover:not(:disabled){border-color:#4da8ff;color:#4da8ff}
.signal-pagination button:disabled{opacity:.4;cursor:default}
.version-info{font-size:10px;color:#4a5e7a;text-align:center;margin-top:60px;padding-bottom:30px}
</style>
<script src="https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js"></script>
</head>
<body>
<div class="header">
<h1>长线交易机器人</h1>
<span class="header-right">
<span>日线 · ${VERSION}</span> <span style="color:#4a5e7a;font-size:.75rem">${VERSION_NOTE}</span>
<button onclick="location.reload()" style="padding:4px 14px;background:#1a2942;border:1px solid #1f2b44;color:#b0c4e8;border-radius:6px;cursor:pointer;margin-left:10px;font-size:.8rem">刷新</button>
</span>
</div>
<div class="tabs">
<button class="tab active" onclick="switchTab('positions')">持仓</button>
<button class="tab" onclick="switchTab('orders')">交易记录</button>
<button class="tab" onclick="switchTab('signals')">信号记录</button>
<button class="tab" onclick="switchTab('stats')">统计</button>
<button class="tab" onclick="switchTab('kline')">K线图</button>
<button class="tab" onclick="switchTab('config')">配置</button>
</div>
<div class="content">
<div id="tab-positions" class="tab-content"></div>
<div id="tab-orders" class="tab-content" style="display:none"></div>
<div id="tab-signals" class="tab-content" style="display:none"></div>
<div id="tab-stats" class="tab-content" style="display:none"></div>
<div id="tab-kline" class="tab-content" style="display:none"></div>
<div id="tab-config" class="tab-content" style="display:none"></div>
<div class="version-info">数据生成: ${fmtNodeDate(new Date())}</div>
</div>
<script>
const DATA = ${dataJson};
const SYMBOLS = ${symList};
function fmtUSD(v){return (v>=0?'+':'')+Number(v).toFixed(2);}
function fmtPct(v){return (v>=0?'+':'')+Number(v).toFixed(2)+'%';}
function fmtDate(t){var d=new Date(t),p=function(n){return(n<10?'0':'')+n};return p(d.getMonth()+1)+p(d.getDate())+' '+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());}
function getLatestPrice(symbol){var k=DATA.klines[symbol];if(!k||!k.length)return null;return k[k.length-1].c;}
function calcUnrealizedPnL(){var total=0;for(var i=0;i<DATA.positions.length;i++){var p=DATA.positions[i];if(p.status!=='OPEN')continue;var price=getLatestPrice(p.symbol);if(price==null)continue;total+=(price-p.entryPrice)*p.shares;}return total;}
function switchTab(name){
document.querySelectorAll('.tab-content').forEach(function(el){el.style.display='none';});
document.querySelectorAll('.tab').forEach(function(el){el.classList.remove('active');});
var el=document.getElementById('tab-'+name);if(el)el.style.display='block';
var tabs=document.querySelectorAll('.tab');
var tabNames=['positions','orders','signals','stats','kline','config'];
for(var i=0;i<tabs.length;i++){if(tabNames[i]===name)tabs[i].classList.add('active');}
localStorage.setItem('lt_tab',name);
if(name==='kline')renderKline();
}
function renderPositions(){
var c=document.getElementById('tab-positions');
var capital=DATA.config.capital||100000;
var unrealized=calcUnrealizedPnL();
var totalEquity=capital+(DATA.stats.netPnL||0)+unrealized;
var marketVal=0;
var openPos=DATA.positions.filter(function(p){return p.status==='OPEN';});
for(var i=0;i<openPos.length;i++){var px=getLatestPrice(openPos[i].symbol);if(px!=null)marketVal+=px*openPos[i].shares;}
var cash=totalEquity-marketVal;
var h='<div class="stats-grid">';
h+='<div class="stat-card"><div class="label">总资产</div><div class="value '+(totalEquity>=capital?'win':'loss')+'">$'+fmtUSD(totalEquity)+'</div><div class="sub">本金 $'+capital.toFixed(2)+'</div></div>';
h+='<div class="stat-card"><div class="label">持仓市值</div><div class="value">$'+fmtUSD(marketVal)+'</div><div class="sub">'+openPos.length+' 个持仓</div></div>';
h+='<div class="stat-card"><div class="label">剩余资金</div><div class="value">$'+fmtUSD(cash)+'</div><div class="sub">已实现 $'+fmtUSD(DATA.stats.netPnL||0)+'</div></div>';
h+='<div class="stat-card"><div class="label">浮动盈亏</div><div class="value '+(unrealized>=0?'win':'loss')+'">$'+fmtUSD(unrealized)+'</div></div>';
h+='</div>';
if(!openPos.length){c.innerHTML=h+'<div class="card"><div class="empty">暂无持仓</div></div>';return;}
h+='<div class="card"><h2>当前持仓</h2><table><thead><tr><th>标的</th><th>入场价</th><th>现价</th><th>入场时间</th><th>股数</th><th>市值</th><th>浮动盈亏</th><th>盈亏%</th><th>止损</th><th>止盈</th></tr></thead><tbody>';
for(var i=0;i<openPos.length;i++){
var p=openPos[i];
var px=getLatestPrice(p.symbol);
var mv=px!=null?px*p.shares:null;
var up=px!=null?(px-p.entryPrice)*p.shares:null;
var upPct=px!=null?(px/p.entryPrice-1)*100:null;
var cls=up!=null?(up>=0?'win':'loss'):'';
h+='<tr><td><strong>'+p.symbol+'</strong></td><td>$'+p.entryPrice.toFixed(2)+'</td><td>'+(px!=null?'$'+px.toFixed(2):'-')+'</td><td>'+fmtDate(p.entryTime)+'</td><td>'+p.shares.toFixed(5)+'</td><td>'+(mv!=null?'$'+mv.toFixed(2):'-')+'</td><td class="'+cls+'">'+(up!=null?'$'+fmtUSD(up):'-')+'</td><td class="'+cls+'">'+(upPct!=null?fmtPct(upPct):'-')+'</td><td class="sell">$'+p.stopLoss.toFixed(2)+'</td><td class="buy">$'+p.takeProfit.toFixed(2)+'</td></tr>';
}
h+='</tbody></table></div>';
c.innerHTML=h;
}
function renderOrders(){
var c=document.getElementById('tab-orders');
if(!DATA.orders.length){c.innerHTML='<div class="card"><div class="empty">暂无交易记录</div></div>';return;}
var total=DATA.orders.length;
var pageSize=30;var totalPages=Math.max(1,Math.ceil(total/pageSize));
var page=Math.max(1,(window._orderPage||1));if(page>totalPages)page=1;window._orderPage=page;
var startIdx=(page-1)*pageSize;var orders=DATA.orders.slice(startIdx,startIdx+pageSize);
var h='<div class="card"><h2>交易记录</h2><table><thead><tr><th>标的</th><th>方向</th><th>价格</th><th>股数</th><th>金额</th><th>PnL</th><th>原因</th><th>时间</th></tr></thead><tbody>';
for(var i=0;i<orders.length;i++){
var o=orders[i];
var pnlCls=o.pnl!=null?(o.pnl>0?'win':'loss'):'';
h+='<tr><td><strong>'+o.symbol+'</strong></td><td class="'+(o.action==='OPEN'?'buy':'sell')+'">'+(o.action==='OPEN'?'开仓':'平仓')+'</td><td>$'+o.price.toFixed(2)+'</td><td>'+o.shares.toFixed(5)+'</td><td>$'+(o.cost||o.revenue||0).toFixed(2)+'</td><td class="'+pnlCls+'">'+(o.pnl!=null?'$'+fmtUSD(o.pnl)+' ('+fmtPct(o.pnlPct)+')':'-')+'</td><td>'+(o.reason||o.closeReason||'-')+'</td><td>'+fmtDate(o.time)+'</td></tr>';
}
h+='</tbody></table>';
h+='<div class="signal-pagination">';
h+='<button onclick="window._orderPage=1;renderOrders()" '+(page<=1?'disabled':'')+'>首页</button>';
h+='<button onclick="window._orderPage='+(page-1)+';renderOrders()" '+(page<=1?'disabled':'')+'>上一页</button>';
h+='<span>第 '+page+' / '+totalPages+' 页  共 '+total+' 条</span>';
h+='<button onclick="window._orderPage='+(page+1)+';renderOrders()" '+(page>=totalPages?'disabled':'')+'>下一页</button>';
h+='<button onclick="window._orderPage='+totalPages+';renderOrders()" '+(page>=totalPages?'disabled':'')+'>末页</button>';
h+='</div></div>';
c.innerHTML=h;
}
function renderSignals(){
var c=document.getElementById('tab-signals');
var all=[];
for(var sym in DATA.signals){
var sigs=DATA.signals[sym]||[];
for(var i=0;i<sigs.length;i++){var s=sigs[i];all.push({symbol:sym,time:s.time,price:s.price,decision:s.decision,reasoning:s.reasoning,rules:s.rules,rulesTriggered:s.rulesTriggered,aiScore:s.aiScore,weekly:s.weekly});}
}
all.sort(function(a,b){return new Date(b.time)-new Date(a.time);});
if(!all.length){c.innerHTML='<div class="card"><div class="empty">暂无信号记录</div></div>';return;}
var total=all.length;
var pageSize=30;var totalPages=Math.max(1,Math.ceil(total/pageSize));
var page=Math.max(1,(window._sigPage||1));if(page>totalPages)page=1;window._sigPage=page;
var startIdx=(page-1)*pageSize;var signals=all.slice(startIdx,startIdx+pageSize);
var h='<div class="card"><h2>信号记录</h2><table><thead><tr><th>时间</th><th>标的</th><th>决策</th><th>规则 (MRVE)</th><th>AI评分</th><th>日线方向</th><th>理由</th></tr></thead><tbody>';
for(var i=0;i<signals.length;i++){
var s=signals[i];
var ruleStr=s.rules?((s.rules.macd?'M':'')+(s.rules.rsi?'R':'')+(s.rules.volume?'V':'')+(s.rules.ema?'E':'')):'-';
var weeklyDir=s.weekly?(s.weekly.bullish?'多头':'空头'):'-';
var d=s.decision||'SKIP';
h+='<tr><td style="white-space:nowrap">'+fmtDate(s.time)+'</td><td>'+s.symbol+'</td><td class="'+(d==='BUY'?'buy':'hold')+'">'+d+'</td><td>'+(s.rulesTriggered?'✅ ':'❌ ')+ruleStr+'</td><td>'+(s.aiScore!=null?s.aiScore+'/10':'-')+'</td><td>'+weeklyDir+'</td><td style="max-width:300px;white-space:normal;word-break:break-word;line-height:1.4">'+(s.reasoning||'-')+'</td></tr>';
}
h+='</tbody></table>';
h+='<div class="signal-pagination">';
h+='<button onclick="window._sigPage=1;renderSignals()" '+(page<=1?'disabled':'')+'>首页</button>';
h+='<button onclick="window._sigPage='+(page-1)+';renderSignals()" '+(page<=1?'disabled':'')+'>上一页</button>';
h+='<span>第 '+page+' / '+totalPages+' 页  共 '+total+' 条</span>';
h+='<button onclick="window._sigPage='+(page+1)+';renderSignals()" '+(page>=totalPages?'disabled':'')+'>下一页</button>';
h+='<button onclick="window._sigPage='+totalPages+';renderSignals()" '+(page>=totalPages?'disabled':'')+'>末页</button>';
h+='</div></div>';
c.innerHTML=h;
}
function renderStats(){
var c=document.getElementById('tab-stats');
var s=DATA.stats;
var capital=DATA.config.capital||100000;
var unrealized=calcUnrealizedPnL();
var totalEquity=capital+s.netPnL+unrealized;
var h='<div class="stats-grid">';
h+='<div class="stat-card"><div class="label">总交易</div><div class="value">'+s.totalTrades+'</div></div>';
h+='<div class="stat-card"><div class="label">胜率</div><div class="value">'+s.winRate+'%</div><div class="sub">'+s.wins+'W / '+s.losses+'L</div></div>';
h+='<div class="stat-card"><div class="label">总资产</div><div class="value '+(totalEquity>=capital?'win':'loss')+'">$'+fmtUSD(totalEquity)+'</div><div class="sub">本金 $'+capital.toFixed(2)+'</div></div>';
h+='<div class="stat-card"><div class="label">已实现PnL</div><div class="value '+(s.netPnL>=0?'win':'loss')+'">$'+fmtUSD(s.netPnL)+'</div></div>';
h+='<div class="stat-card"><div class="label">浮动盈亏</div><div class="value '+(unrealized>=0?'win':'loss')+'">$'+fmtUSD(unrealized)+'</div></div>';
h+='<div class="stat-card"><div class="label">平均盈利</div><div class="value win">$'+fmtUSD(s.avgWin)+'</div></div>';
h+='<div class="stat-card"><div class="label">平均亏损</div><div class="value loss">$'+fmtUSD(s.avgLoss)+'</div></div>';
h+='<div class="stat-card"><div class="label">最大回撤</div><div class="value loss">$'+fmtUSD(s.maxDrawdown)+'</div></div>';
h+='</div>';
if(s.bySymbol&&Object.keys(s.bySymbol).length>0){
h+='<div class="card"><h3>按标的统计</h3><table><thead><tr><th>标的</th><th>交易数</th><th>胜</th><th>负</th><th>PnL</th><th>胜率</th></tr></thead><tbody>';
for(var sym in s.bySymbol){
var st=s.bySymbol[sym];
var wr=st.trades>0?Math.round(st.wins/st.trades*10000)/100:0;
h+='<tr><td><strong>'+sym+'</strong></td><td>'+st.trades+'</td><td class="win">'+st.wins+'</td><td class="loss">'+st.losses+'</td><td class="'+(st.pnl>=0?'win':'loss')+'">$'+fmtUSD(st.pnl)+'</td><td>'+wr+'%</td></tr>';
}
h+='</tbody></table></div>';
}
c.innerHTML=h;
}
var _klineChart=null;
function renderKline(){
var container=document.getElementById('tab-kline');
var symbols=Object.keys(DATA.klines).filter(function(s){var k=DATA.klines[s];return k&&k.length>=5;});
if(!symbols.length){container.innerHTML='<div class="card"><div class="empty">暂无K线数据，运行 run 后自动获取</div></div>';return;}
var savedSym=localStorage.getItem('lt_kline_symbol');
var defaultSym=(savedSym&&symbols.indexOf(savedSym)>=0)?savedSym:symbols[0];
var h='<div class="symbol-selector">';
for(var i=0;i<symbols.length;i++){
var s=symbols[i];
var cnt=DATA.orders.filter(function(o){return o.symbol===s;}).length;
h+='<button class="symbol-btn'+(s===defaultSym?' active':'')+'" onclick="switchKline(\\''+s+'\\')">'+s+(cnt?' ('+cnt+'笔)':'')+'</button>';
}
 h+='</div><div class="chart-container"><div id="chart-root" style="width:100%;height:420px"></div><div id="kline-stale-note"></div></div>';
 container.innerHTML=h;
 if(typeof LightweightCharts==='undefined'){document.getElementById('chart-root').innerHTML='<div class="empty" style="padding:60px">图表库加载中...</div>';return;}
 if(defaultSym)setTimeout(function(){loadChart(defaultSym);},200);
 }
 window.switchKline=function(sym){
 var btns=document.querySelectorAll('#tab-kline .symbol-btn');
 for(var i=0;i<btns.length;i++)btns[i].classList.remove('active');
 event.target.classList.add('active');
 localStorage.setItem('lt_kline_symbol',sym);
 loadChart(sym);
 };
 function updateKlineStaleNote(symbol){
 var note=document.getElementById('kline-stale-note');
 if(!note)return;
 var meta=DATA.klinesMeta[symbol];
 if(meta&&meta.stale){
   note.innerHTML='<div style="margin-top:8px;padding:8px 12px;border:1px solid #ff6b7d;border-radius:6px;background:rgba(255,107,125,.08);color:#ff6b7d;font-size:12px">⚠️ '+meta.staleReason+' — 旧K线 / 仅供历史查看</div>';
 }else{
   note.innerHTML='';
 }
 }
function loadChart(symbol){
var bars=DATA.klines[symbol]||[];
if(!bars.length)return;
updateKlineStaleNote(symbol);
if(_klineChart){_klineChart.remove();_klineChart=null;}
document.getElementById('chart-root').innerHTML='';
_klineChart=LightweightCharts.createChart(document.getElementById('chart-root'),{
layout:{background:{color:'#0d1522'},textColor:'#6b7fa3'},
grid:{vertLines:{color:'#1a2942'},horzLines:{color:'#1a2942'}},
crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
timeScale:{borderColor:'#1f2b44',timeVisible:true,secondsVisible:false},
rightPriceScale:{borderColor:'#1f2b44'},
});
var candleSeries=_klineChart.addCandlestickSeries({
upColor:'#ff6b7d',downColor:'#45d483',
borderUpColor:'#ff6b7d',borderDownColor:'#45d483',
wickUpColor:'#ff6b7d',wickDownColor:'#45d483',
});
var chartData=[];
for(var i=0;i<bars.length;i++){chartData.push({time:bars[i].t,open:bars[i].o,high:bars[i].h,low:bars[i].l,close:bars[i].c});}
candleSeries.setData(chartData);
var orders=DATA.orders.filter(function(o){return o.symbol===symbol;});
var openPositions=DATA.positions.filter(function(p){return p.symbol===symbol&&p.status==='OPEN';});
var closeOrders=orders.filter(function(o){return o.action==='CLOSE';});
var closedPositions=[];
for(var i=0;i<closeOrders.length;i++){
var co=closeOrders[i];
var oo=orders.find(function(o){return o.action==='OPEN'&&o.id===co.id;});
if(!oo)continue;
closedPositions.push({symbol:symbol,entryPrice:oo.price,stopLoss:oo.stopLoss,takeProfit:oo.takeProfit,entryTime:oo.time,closeTime:co.time,status:'CLOSED'});
}
var allPositions=openPositions.concat(closedPositions);
var markers=[];
var gray='#808080';
var firstBarTime=bars[0].t;
var invBars=[],invMarkers=[];
for(var i=0;i<allPositions.length;i++){
var pos=allPositions[i];
var entryTime=Math.floor(new Date(pos.entryTime).getTime()/1000);
if(entryTime<firstBarTime-86400*7)continue;
var isClosed=pos.status==='CLOSED';
var endTime=isClosed?Math.floor(new Date(pos.closeTime).getTime()/1000):entryTime+14*86400;
var entryLine=_klineChart.addLineSeries({color:gray,lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
entryLine.setData([{time:entryTime,value:pos.entryPrice},{time:endTime,value:pos.entryPrice}]);
var tpLine=_klineChart.addLineSeries({color:gray,lineWidth:1,lineStyle:LightweightCharts.LineStyle.Solid,priceLineVisible:false,lastValueVisible:false});
tpLine.setData([{time:entryTime,value:pos.takeProfit},{time:endTime,value:pos.takeProfit}]);
var slLine=_klineChart.addLineSeries({color:gray,lineWidth:1,lineStyle:LightweightCharts.LineStyle.Solid,priceLineVisible:false,lastValueVisible:false});
slLine.setData([{time:entryTime,value:pos.stopLoss},{time:endTime,value:pos.stopLoss}]);
var vertUp=_klineChart.addLineSeries({color:'#45d483',lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
vertUp.setData([{time:entryTime,value:pos.entryPrice},{time:entryTime,value:pos.takeProfit}]);
var vertDown=_klineChart.addLineSeries({color:'#ff6b7d',lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
vertDown.setData([{time:entryTime,value:pos.entryPrice},{time:entryTime,value:pos.stopLoss}]);
invBars.push({time:entryTime,open:pos.takeProfit,high:pos.takeProfit,low:pos.stopLoss,close:pos.stopLoss});
var arrowSize=isClosed?0:1;
invMarkers.push({time:entryTime,position:'aboveBar',color:gray,shape:'arrowDown',text:'$'+pos.takeProfit.toFixed(2),size:arrowSize});
invMarkers.push({time:entryTime,position:'belowBar',color:gray,shape:'arrowUp',text:'$'+pos.stopLoss.toFixed(2),size:arrowSize});
}
for(var i=0;i<orders.length;i++){
var o=orders[i];
var rawTime=typeof o.time==='string'?Math.floor(new Date(o.time).getTime()/1000):o.time;
var nearest=null,bestDist=Infinity;
for(var j=0;j<bars.length;j++){var dist=Math.abs(bars[j].t-rawTime);if(dist<bestDist){nearest=bars[j];bestDist=dist;}}
if(!nearest)continue;
if(o.action==='OPEN'){
markers.push({time:nearest.t,position:'belowBar',color:'#4da8ff',shape:'arrowUp',text:'BUY $'+o.price.toFixed(2),size:2});
}else if(o.action==='CLOSE'){
var pnlText=o.pnl?((o.pnl>0?' +$':' -$')+Math.abs(o.pnl).toFixed(0)):'';
markers.push({time:nearest.t,position:'aboveBar',color:o.pnl>0?'#45d483':'#ff6b7d',shape:o.pnl>0?'arrowUp':'arrowDown',text:(o.reason||'CLOSE')+pnlText,size:3});
}
}
if(markers.length)candleSeries.setMarkers(markers);
if(invBars.length>0){
invBars.sort(function(a,b){return a.time-b.time;});
var invSeries=_klineChart.addCandlestickSeries({upColor:'transparent',downColor:'transparent',borderUpColor:'transparent',borderDownColor:'transparent',wickUpColor:'transparent',wickDownColor:'transparent',priceLineVisible:false,lastValueVisible:false});
invSeries.setData(invBars);
if(invMarkers.length)invSeries.setMarkers(invMarkers);
}
_klineChart.timeScale().fitContent();
}
function renderConfig(){
var c=document.getElementById('tab-config');
var targets=DATA.config.symbols||[],fx=DATA.config.fxRate||7.8;
function poolHtml(list,title){var h='<p style="color:#6b7fa3;font-size:12px;margin:8px 0">'+title+' ('+list.length+'个)</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';for(var i=0;i<list.length;i++){h+='<span style="background:#1a2b42;border:1px solid #2a3a52;padding:4px 10px;border-radius:4px;font-size:13px">'+list[i]+'</span>'}h+="</div>";return h}
var h='<div class="card"><h2>交易标的池</h2>';
h+=poolHtml(targets,"交易池（可自动开仓）");
h+="</div>";
h+='<div class="card"><h2>账户设置</h2><div class="stats-grid">';
h+='<div class="stat-card"><div class="label">总资金</div><div class="value">\$'+DATA.config.capital.toLocaleString()+'</div></div>';
h+='<div class="stat-card"><div class="label">单笔仓位</div><div class="value">\$'+DATA.config.positionSize.toLocaleString()+'</div></div>';
h+='<div class="stat-card"><div class="label">最大持仓</div><div class="value">'+DATA.config.maxPositions+'</div></div>';
h+='<div class="stat-card"><div class="label">模型</div><div class="value" style="font-size:16px">'+DATA.config.model+'</div></div>';
h+='<div class="stat-card"><div class="label">汇率</div><div class="value" style="font-size:16px">'+fx+'</div></div>';
h+='</div></div>';
c.innerHTML=h;
}
renderPositions();renderOrders();renderSignals();renderStats();renderConfig();
var savedTab=localStorage.getItem('lt_tab');
if(savedTab&&['positions','orders','signals','stats','kline','config'].indexOf(savedTab)>=0)switchTab(savedTab);
</script>
</body>
</html>`;

  atomicWriteText(DASHBOARD_FILE, html);
  console.log('✅ 仪表板已生成: ' + DASHBOARD_FILE);
  if (process.platform === 'darwin') {
    try { import('child_process').then(cp => cp.execSync(`open "${DASHBOARD_FILE}"`)).catch(() => {}); } catch {}
  }
}

async function showStats() {
  const orders = loadOrders();
  const stats = recalcStats(orders);
  const positions = loadPositions().filter(p => p.status === 'OPEN');
  console.log(`\n总交易: ${stats.totalTrades} | 持仓: ${positions.length} | 胜: ${stats.wins} | 负: ${stats.losses} | 胜率: ${stats.winRate}%`);
  console.log(`净PnL: $${stats.netPnL.toFixed(2)} | 最大回撤: $${stats.maxDrawdown.toFixed(2)} | 平均盈利: $${stats.avgWin.toFixed(2)} | 平均亏损: $${stats.avgLoss.toFixed(2)}`);
  if (positions.length) {
    console.log(`\n当前持仓:`);
    for (const p of positions) console.log(`  ${p.symbol}: $${p.entryPrice} | 止损 $${p.stopLoss} | 止盈 $${p.takeProfit}`);
  }
}

async function setupLaunchd() {
  const repoDir = process.env.PWD || fileURLToPath(import.meta.url).replace(/\/scripts\/.*/, '');
  const apiKey = readApiKey() || process.env.DEEPSEEK_API_KEY || '';

  const tasks = [
    { name: 'hk-us', time: '08:00', desc: '港股+美股+BTC (全量)', filter: null },
    { name: 'hk',    time: '16:30', desc: '港股收盘后 + BTC', filter: 'hk' },
    { name: 'us',    time: '19:30', desc: '美股盘前 + BTC', filter: 'us' },
  ];

  // Create shared run script
  const runScript = path.join(DATA_DIR, 'run.sh');
  const script = '#!/bin/bash\n# Auto-generated by long-term-trader setup\ncd "' + repoDir + '"\nexport DEEPSEEK_API_KEY="' + apiKey + '"\nFILTER="$1"\n/usr/local/bin/node "' + repoDir + '/scripts/long-term-trader.mjs" run --filter "${FILTER:-all}" >> "' + DATA_DIR + '/cron-${FILTER:-all}.log" 2>&1\n';

  fs.writeFileSync(runScript, script, 'utf-8');
  fs.chmodSync(runScript, '755');

  for (const t of tasks) {
    const [h, m] = t.time.split(':');
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.donew.longtrader.${t.name}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${runScript}</string>
    <string>${t.filter || 'all'}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${h}</integer>
    <key>Minute</key>
    <integer>${m}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${DATA_DIR}/cron-${t.filter || 'all'}.log</string>
  <key>StandardErrorPath</key>
  <string>${DATA_DIR}/cron-${t.filter || 'all'}.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>`;

    const plistFile = path.join(process.env.HOME, 'Library/LaunchAgents', `com.donew.longtrader.${t.name}.plist`);
    fs.writeFileSync(plistFile, plist, 'utf-8');

    try {
      const { spawnSync } = await import('child_process');
      spawnSync('launchctl', ['unload', plistFile]);
      spawnSync('launchctl', ['load', plistFile]);
    } catch {}
  }

  console.log('✅ 已创建 3 个定时任务:\n');
  for (const t of tasks) {
    console.log(`  ${t.time} HKT — ${t.desc}`);
  }
  console.log(`\n  日志: ${DATA_DIR}/cron-{hk,us,all}.log`);
  console.log('  停用: launchctl unload ~/Library/LaunchAgents/com.donew.longtrader.*');
  console.log('  状态: launchctl list | grep longtrader');
}

async function showPositions() {
  const positions = loadPositions().filter(p => p.status === 'OPEN');
  if (!positions.length) { console.log('当前无持仓'); return; }
  console.log(`当前持仓 (${positions.length}):\n`);
  for (const p of positions) {
    console.log(`  ${p.symbol}: 入场$${p.entryPrice} | 止损$${p.stopLoss} | 止盈$${p.takeProfit} | 股数:${p.shares} | OPEN`);
  }
}

async function setupEnv() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    fs.writeFileSync(ENV_FILE, `DEEPSEEK_API_KEY=${apiKey}\n`, 'utf-8');
    console.log('✅ 已从环境变量写入 .env');
  } else {
    console.log('⛔ 未设置 DEEPSEEK_API_KEY');
    console.log('   export DEEPSEEK_API_KEY=sk-xxx && node scripts/long-term-trader.mjs env');
  }
}

function showVersion() {
  console.log(`长线交易机器人 ${VERSION}`);
  console.log(`数据: ${DATA_DIR}`);
}

async function main() {
  const cmd = process.argv[2] || 'run';
  const filterArg = process.argv[3] === '--filter' ? process.argv[4] : null;

  // run / dashboard 都会写文件，需要拿锁防止并发
  if (cmd === 'run' || cmd === 'dashboard') {
    try {
      acquireLock(cmd);
    } catch (e) {
      console.log(`⛔ 已存在运行实例，本次退出: ${e.message}`);
      process.exit(0);
    }
  }

  try {
    switch (cmd) {
      case 'run':       await run(filterArg);                break;
      case 'dashboard': await generateDashboard();  break;
      case 'stats':     await showStats();          break;
      case 'positions': await showPositions();      break;
      case 'setup':     await setupLaunchd();        break;
      case 'env':       await setupEnv();           break;
      case 'version':   showVersion();              break;
      default:
        console.log('Usage: node scripts/long-term-trader.mjs [run|dashboard|stats|positions|setup|env|version]');
        console.log('  run       - 日线+日线分析 → 信号 → 模拟交易');
        console.log('  dashboard - 生成 HTML 仪表板');
        console.log('  stats     - 统计面板');
        console.log('  positions - 当前持仓');
        console.log('  setup     - 安装 launchd 每天 08:30 自动运行');
        console.log('  env       - 写入 API Key 到本地 .env');
        console.log('  version   - 版本');
        console.log('\n首次使用: export DEEPSEEK_API_KEY=sk-xxx && node scripts/long-term-trader.mjs env');
        console.log(`标的: ${DEFAULT_CONFIG.symbols.join(' / ')} | 日线+日线 | 仅做多`);
    }
  } finally {
    if (cmd === 'run' || cmd === 'dashboard') {
      releaseLock();
    }
  }
}

main().catch(error => {
  console.error(`\n💥 异常: ${error.message}`);
  process.exit(1);
});
