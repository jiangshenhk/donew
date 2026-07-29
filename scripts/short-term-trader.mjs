#!/usr/bin/env node
// short-term-trader.mjs — Short-Term K-line Trader v0.1.0
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

const VERSION = 'v0.1.0';
const RANGE = '5d';
const INTERVAL = '5m';
const AI_TIMEOUT = 30000;

const DEFAULT_CONFIG = {
  symbols: ['QQQ', 'IBIT', 'MSTR'],
  capital: 100000,
  positionSize: 10000,
  maxPositions: 3,
  model: 'deepseek-chat',
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
  fs.writeFileSync(fpath, JSON.stringify(data, null, 2), 'utf-8');
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

function readEnvVar(key) {
  if (process.env[key]) return process.env[key];
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = content.match(new RegExp(key + '\\s*=\\s*(.+)'));
    return match ? match[1].trim().replace(/["']/g, '') : null;
  } catch { return null; }
}

function emailConfig() {
  return {
    user: readEnvVar('GMAIL_USER') || 'jiangshenhk@gmail.com',
    pass: readEnvVar('GMAIL_PASS') || '',
    to: readEnvVar('EMAIL_TO') || 'dudiaozhang@outlook.com',
  };
}

function fmtTimeHK(ts) {
  const d = new Date(ts instanceof Date ? ts : ts * 1000);
  return d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false });
}

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

// ─── Data Management ───────────────────────────────────────────

function loadConfig() {
  const saved = loadJson(CONFIG_FILE);
  if (saved && Array.isArray(saved.symbols)) return saved;
  saveJson(CONFIG_FILE, DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) { saveJson(CONFIG_FILE, config); }

function loadPositions() { return loadJson(POSITIONS_FILE) || []; }
function savePositions(data) { saveJson(POSITIONS_FILE, data); }

function loadOrders() { return loadJson(ORDERS_FILE) || []; }
function saveOrders(data) { saveJson(ORDERS_FILE, data); }

function loadStats() {
  const s = loadJson(STATS_FILE);
  if (s && typeof s.totalTrades === 'number') return s;
  return { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0, netPnL: 0, winRate: 0, maxDrawdown: 0, avgWin: 0, avgLoss: 0, bySymbol: {}, dailyPnL: {}, consecutiveLosses: 0 };
}

function saveStats(data) { saveJson(STATS_FILE, data); }

function loadSignals(symbol) {
  const fpath = path.join(SIGNALS_DIR, symbol + '.json');
  return loadJson(fpath) || [];
}

function saveSignals(symbol, data) {
  const fpath = path.join(SIGNALS_DIR, symbol + '.json');
  // Keep only last 200 signals
  if (data.length > 200) data = data.slice(-200);
  saveJson(fpath, data);
}

function loadKlineCache(symbol) {
  const fpath = path.join(KLINE_DIR, symbol + '_5m.json');
  return loadJson(fpath);
}

function saveKlineCache(symbol, newData) {
  const fpath = path.join(KLINE_DIR, symbol + '_5m.json');
  const existing = loadJson(fpath);

  if (existing && existing.bars && existing.bars.length > 0 && newData.bars && newData.bars.length > 0) {
    const seen = new Set(existing.bars.map(b => b.t));
    const fresh = newData.bars.filter(b => !seen.has(b.t));
    if (fresh.length === 0) return;
    existing.bars = [...existing.bars, ...fresh].sort((a, b) => a.t - b.t);
    existing.date = new Date().toISOString();
    saveJson(fpath, existing);
  } else {
    saveJson(fpath, newData);
  }
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
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${RANGE}&interval=${INTERVAL}&events=history&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-trader/1.0)' },
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
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const lastVolume = recentVolumes[recentVolumes.length - 1].v;
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
  return {
    triggered: details.macd && details.rsi && details.ema && details.volume,
    details,
  };
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

// ─── DeepSeek ───────────────────────────────────────────────────

async function callDeepSeek(systemPrompt, userMessage) {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY，请在环境变量或 ~/.donew-trader/.env 中设置');

  const model = loadConfig().model || 'deepseek-chat';

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
  "reasoning": "中文简短评分理由，不超过100字"
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
  const shares = Math.floor(config.positionSize / price);

  if (shares === 0) {
    console.log(`  ⚠️ ${symbol} 仓位大小不足，跳过（价格: $${price}，仓位: $${config.positionSize}）`);
    return null;
  }

  const levels = calcAtrStopLevels(price, atr);
  const position = {
    id: `${symbol}_${Date.now()}`,
    symbol,
    entryPrice: price,
    shares,
    cost: Math.round(shares * price * 100) / 100,
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

  // Send email
  const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;border:1px solid #2a3a52;border-radius:8px;overflow:hidden">
<div style="background:#0d1522;padding:16px;border-bottom:1px solid #2a3a52">
  <span style="color:#ffd700;font-size:16px;font-weight:bold">🤖 K线短线交易机器人</span>
  <span style="color:#6b7d99;font-size:11px;margin-left:8px">v0.1.0 | 5分钟级别</span>
</div>
<div style="padding:16px;background:#162234">
<h2 style="color:#45d483;margin-top:0">🔵 开仓: ${symbol}</h2>
<p><strong>时间:</strong> ${fmtTimeHK(new Date(position.entryTime))}</p>
<p><strong>方向:</strong> 买入做多</p>
<p><strong>价格:</strong> $${price.toFixed(2)}</p>
<p><strong>数量:</strong> ${shares} 股</p>
<p><strong>成本:</strong> $${position.cost.toFixed(2)}</p>
<p><strong>止损:</strong> $${position.stopLoss.toFixed(2)}</p>
<p><strong>止盈:</strong> $${position.takeProfit.toFixed(2)}</p>
<p><strong>AI评分:</strong> ${signal.score}/10</p>
<p style="color:#8ea3be;font-size:13px">${signal.reasoning}</p>
</div>
<div style="background:#0d1522;padding:10px 16px;font-size:11px;color:#4a5e7a">策略: 纯K线技术面 | 仅做多 | 止盈止损自动触发</div>
</div>`;
  sendEmail(`[开仓] ${symbol} $${price.toFixed(2)} | 止损$${position.stopLoss.toFixed(2)} 止盈$${position.takeProfit.toFixed(2)}`, emailHtml);

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

  // Send email
  const pnlEmoji = p.pnl > 0 ? '💰' : '🩸';
  const pnlColor = p.pnl > 0 ? '#45d483' : '#ff6b7d';
  const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;border:1px solid #2a3a52;border-radius:8px;overflow:hidden">
<div style="background:#0d1522;padding:16px;border-bottom:1px solid #2a3a52">
  <span style="color:#ffd700;font-size:16px;font-weight:bold">🤖 K线短线交易机器人</span>
  <span style="color:#6b7d99;font-size:11px;margin-left:8px">v0.1.0 | 5分钟级别</span>
</div>
<div style="padding:16px;background:#162234">
<h2 style="color:${pnlColor};margin-top:0">${pnlEmoji} 平仓: ${p.symbol}</h2>
<p><strong>时间:</strong> ${fmtTimeHK(new Date())}</p>
<p><strong>开仓价:</strong> $${p.entryPrice.toFixed(2)}</p>
<p><strong>平仓价:</strong> $${closePrice.toFixed(2)}</p>
<p><strong>数量:</strong> ${p.shares} 股</p>
<p><strong>盈亏:</strong> <span style="color:${pnlColor};font-size:16px;font-weight:bold">$${p.pnl.toFixed(2)} (${p.pnlPct > 0 ? '+' : ''}${p.pnlPct}%)</span></p>
<p><strong>原因:</strong> ${reason}</p>
</div>
<div style="background:#0d1522;padding:10px 16px;font-size:11px;color:#4a5e7a">策略: 纯K线技术面 | 仅做多 | 止盈止损自动触发</div>
</div>`;
  sendEmail(`[平仓] ${p.symbol} $${closePrice.toFixed(2)} | PnL: $${p.pnl.toFixed(2)} (${p.pnlPct > 0 ? '+' : ''}${p.pnlPct}%)`, emailHtml);

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

// ─── Email Notification ───────────────────────────────────────

function sendEmail(subject, htmlBody) {
  const cfg = emailConfig();
  if (!cfg.pass) return;
  try {
    const boundary = '----=_donew_' + Date.now();
    const raw = [
      'From: donew-trader <' + cfg.user + '>',
      'To: ' + cfg.to,
      'Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody, 'utf-8').toString('base64'),
    ].join('\r\n');

    const tmpFile = path.join(AGENT_DIR, 'email-' + Date.now() + '.txt');
    fs.writeFileSync(tmpFile, raw, 'utf-8');

    execSync(
      `curl -s --url 'smtps://smtp.gmail.com:465' --ssl-reqd --mail-from '${cfg.user}' --mail-rcpt '${cfg.to}' --user '${cfg.user}:${cfg.pass}' --upload-file '${tmpFile}'`,
      { timeout: 15000 }
    );

    try { fs.unlinkSync(tmpFile); } catch { /* ok */ }
    console.log('  ✉️  邮件已发送');
  } catch (e) {
    console.log('  ⚠️ 邮件发送失败: ' + e.message);
  }
}

// ─── Main Run ────────────────────────────────────────────────────

async function run() {
  console.log(`\n┌──────────────────────────────────────────┐`);
  console.log(`│  📊 Short-Term K-line Trader ${VERSION}    │`);
  console.log(`└──────────────────────────────────────────┘\n`);

  const config = loadConfig();
  console.log(`监控标的: ${config.symbols.join(', ')}`);
  console.log(`资金: $${config.capital.toLocaleString()} | 单笔: $${config.positionSize.toLocaleString()} | 最大持仓: ${config.maxPositions}\n`);

  // Market hours check
  if (!isMarketOpen()) {
    const et = etNow();
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    console.log(`⏸️  美股未开市（ET ${dayNames[et.getDay()]} ${et.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })}）`);
    console.log('   开市时间: 周一至周五 9:30 AM - 4:00 PM ET');
    return;
  }

  console.log(`🟢 市场开市中 | ET ${fmtTimeShort(etNow())}\n`);

  const positions = loadPositions();
  console.log(`当前持仓: ${positions.length}/${config.maxPositions}`);

  // Step 1: Fetch K-lines → Technical Rules → AI Score → Decision
  const signals = {};

  for (const symbol of config.symbols) {
    console.log(`\n━━ ${symbol} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    process.stdout.write(`  📡 获取5分钟K线...`);

    const data = await fetchYahooBars(symbol);
    if (!data || !data.bars || data.bars.length < 20) {
      console.log(` ❌ 数据不足`);
      signals[symbol] = { decision: 'SKIP', reasoning: 'K线数据不足' };
      continue;
    }

    console.log(` ✅ ${data.bars.length}根K线`);
    saveKlineCache(symbol, { date: new Date().toISOString(), bars: data.bars, meta: data.meta });

    const lastBar = data.bars[data.bars.length - 1];
    const openPos = positions.find(p => p.symbol === symbol && p.status === 'OPEN');

    // If already holding, skip entirely (don't compute rules or call AI)
    if (openPos) {
      const pnl = Math.round((lastBar.c - openPos.entryPrice) / openPos.entryPrice * 10000) / 100;
      console.log(`  💼 持有仓位: 入场$${openPos.entryPrice} | 止损$${openPos.stopLoss} | 止盈$${openPos.takeProfit}`);
      console.log(`  📈 当前$${lastBar.c} | 浮盈: ${pnl > 0 ? '+' : ''}${pnl}%`);
      signals[symbol] = { decision: 'SKIP', reasoning: '已有持仓' };
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
      // Save signal with rules info
      const signalHistory = loadSignals(symbol);
      signalHistory.push({
        time: new Date().toISOString(),
        barTime: fmtTimeET(lastBar.t * 1000),
        price: lastBar.c,
        decision: 'SKIP',
        rulesTriggered: false,
        rules: rules.details,
        aiScore: 0,
        reasoning: '技术规则未触发',
        indicators,
      });
      saveSignals(symbol, signalHistory);
      signals[symbol] = { decision: 'SKIP', reasoning: '技术规则未触发' };
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
    if (!klineCache?.bars) continue;

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
  console.log(`  ${new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}\n`);

  // Auto-regenerate dashboard
  try {
    const html = buildDashboardHtml();
    fs.writeFileSync(DASHBOARD_FILE, html, 'utf-8');
  } catch { /* silent */ }
}

// ─── Dashboard ───────────────────────────────────────────────────

function buildDashboardHtml() {
  const config = loadConfig();
  const positions = loadPositions();
  const orders = loadOrders();
  const stats = loadStats();

  // Load signals
  const allSignals = {};
  for (const symbol of config.symbols) {
    allSignals[symbol] = loadSignals(symbol);
  }

  // Load kline data
  const allKlines = {};
  for (const symbol of config.symbols) {
    allKlines[symbol] = loadKlineCache(symbol);
  }

  const data = { config, positions, orders, stats, signals: allSignals, klines: allKlines, generatedAt: new Date().toISOString() };

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>短线交易机器人 — 仪表板</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1522; color: #d4dae6; line-height: 1.5; }
.header { background: linear-gradient(135deg, #1a2740 0%, #0f1b2e 100%); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a3a52; }
.header h1 { font-size: 18px; color: #e8edf5; }
.header .meta { font-size: 12px; color: #6b7d99; }
.tabs { display: flex; border-bottom: 2px solid #2a3a52; background: #111d2e; padding: 0 24px; gap: 0; }
.tab { padding: 10px 18px; cursor: pointer; font-size: 13px; color: #6b7d99; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
.tab:hover { color: #a0b4d0; }
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
.flex-row { display: flex; gap: 16px; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 280px; }
.version { font-size: 10px; color: #4a5e7a; }
.refresh-info { font-size: 11px; color: #6b7d99; margin-top: 8px; }
</style>
<script src="https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js"></script>
</head>
<body>
<div class="header">
  <div>
    <h1>📊 短线K线交易机器人</h1>
    <div class="meta">5分钟级别 | QQQ / IBIT / MSTR | <span style="cursor:pointer;color:#4da8ff" onclick="toggleAutoRefresh()" id="refresh-status">🔄 自动刷新: 关</span></div>
  </div>
  <div class="version">${VERSION} | ${new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}</div>
</div>

<div class="tabs">
  <div class="tab" onclick="switchTab('positions');refreshTab('positions')">🔄 持仓</div>
  <div class="tab" onclick="switchTab('orders');refreshTab('orders')">🔄 交易记录</div>
  <div class="tab" onclick="switchTab('signals');refreshTab('signals')">🔄 信号记录</div>
  <div class="tab" onclick="switchTab('stats');refreshTab('stats')">🔄 统计</div>
  <div class="tab" onclick="switchTab('kline');refreshTab('kline')">🔄 K线图</div>
</div>

<div class="content">
  <div id="tab-positions" class="tab-content"></div>
  <div id="tab-orders" class="tab-content" style="display:none"></div>
  <div id="tab-signals" class="tab-content" style="display:none"></div>
  <div id="tab-stats" class="tab-content" style="display:none"></div>
  <div id="tab-kline" class="tab-content" style="display:none"></div>
  <div class="refresh-info">数据生成: ${new Date(data.generatedAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}</div>
</div>

<script>
const DATA = ${JSON.stringify(data, null, 2)};

function fmtUSD(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2); }
function fmtPct(v) { return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }
function fmtTime(t) { return new Date(t).toLocaleString('zh-HK', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); }
function fmtDate(t) { return new Date(t).toLocaleString('zh-HK', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }

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
  if (name === 'kline') renderKline();
}

// ─── Positions Tab ───
function renderPositions() {
  const container = document.getElementById('tab-positions');
  if (!DATA.positions.length) {
    container.innerHTML = '<div class="card"><div class="empty">暂无持仓</div></div>';
    return;
  }
  let html = '<div class="card"><h2>当前持仓</h2><table><thead><tr><th>标的</th><th>入场价</th><th>现价</th><th>入场时间</th><th>股数</th><th>市值</th><th>浮动盈亏</th><th>浮动盈亏%</th><th>止损</th><th>止盈</th></tr></thead><tbody>';
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
  if (!DATA.orders.length) {
    container.innerHTML = '<div class="card"><div class="empty">暂无交易记录</div></div>';
    return;
  }
  let html = '<div class="card"><h2>交易记录 (' + DATA.orders.length + ')</h2><table><thead><tr><th>标的</th><th>方向</th><th>价格</th><th>股数</th><th>金额</th><th>PnL</th><th>原因</th><th>时间</th></tr></thead><tbody>';
  for (const o of [...DATA.orders].reverse()) {
    const pnlClass = o.pnl ? (o.pnl > 0 ? 'win' : 'loss') : '';
    html += '<tr>';
    html += '<td><strong>' + o.symbol + '</strong></td>';
    html += '<td class="' + (o.action === 'OPEN' ? 'buy' : 'sell') + '">' + (o.action === 'OPEN' ? '开仓' : '平仓') + '</td>';
    html += '<td>$' + o.price.toFixed(2) + '</td>';
    html += '<td>' + o.shares + '</td>';
    html += '<td>$' + (o.cost || o.revenue || 0).toFixed(2) + '</td>';
    html += '<td class="' + pnlClass + '">' + (o.pnl != null ? '$' + fmtUSD(o.pnl) + ' (' + fmtPct(o.pnlPct) + ')' : '-') + '</td>';
    html += '<td>' + (o.reason || o.closeReason || '-') + '</td>';
    html += '<td>' + fmtDate(o.time) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// ─── Signals Tab ───
function renderSignals() {
  const container = document.getElementById('tab-signals');
  const symbols = Object.keys(DATA.signals);
  let html = '<div class="symbol-selector">';
  symbols.forEach((s, i) => {
    html += '<button class="symbol-btn' + (i === 0 ? ' active' : '') + '" onclick="filterSignals(\\'' + s + '\\')">' + s + ' (' + (DATA.signals[s]||[]).length + ')</button>';
  });
  html += '</div><div id="signals-table"></div>';
  container.innerHTML = html;
  window._currentSignalSymbol = symbols[0] || '';
  renderSignalTable(window._currentSignalSymbol);
}

window.filterSignals = function(sym) {
  window._currentSignalSymbol = sym;
  document.querySelectorAll('.symbol-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderSignalTable(sym);
};

function renderSignalTable(symbol) {
  const signals = (DATA.signals[symbol] || []).slice(-50).reverse();
  const div = document.getElementById('signals-table');
  if (!signals.length) {
    div.innerHTML = '<div class="card"><div class="empty">暂无信号记录</div></div>';
    return;
  }
  let html = '<div class="card"><h2>' + symbol + ' 信号记录 (' + signals.length + ')</h2><table><thead><tr><th>时间</th><th>价格</th><th>决策</th><th>规则</th><th>AI评分</th><th>入场价</th><th>止损</th><th>止盈</th><th>理由</th></tr></thead><tbody>';
  for (const s of signals) {
    const decision = s.decision || (s.signal === 'BUY' ? 'BUY' : (s.signal === 'HOLD' ? 'SKIP' : 'SKIP'));
    const sigClass = decision === 'BUY' ? 'buy' : 'hold';
    const ruleStr = s.rules ? (s.rules.macd?'M':'') + (s.rules.rsi?'R':'') + (s.rules.ema?'E':'') + (s.rules.volume?'V':'') : '-';
    const aiScoreDisplay = s.aiScore != null ? s.aiScore + '/10' : (s.confidence != null ? s.confidence + '%' : '-');
    const entryPriceDisplay = s.entryPrice || s.entry_price;
    const slDisplay = s.stopLoss || s.stop_loss;
    const tpDisplay = s.takeProfit || s.take_profit;
    html += '<tr>';
    html += '<td>' + fmtDate(s.time) + '</td>';
    html += '<td>$' + (s.price || 0).toFixed(2) + '</td>';
    html += '<td class="' + sigClass + '">' + decision + '</td>';
    html += '<td>' + (s.rulesTriggered ? '✅' : '❌') + ' ' + ruleStr + '</td>';
    html += '<td>' + aiScoreDisplay + '</td>';
    html += '<td>' + (entryPriceDisplay ? '$' + Number(entryPriceDisplay).toFixed(2) : '-') + '</td>';
    html += '<td>' + (slDisplay ? '$' + Number(slDisplay).toFixed(2) : '-') + '</td>';
    html += '<td>' + (tpDisplay ? '$' + Number(tpDisplay).toFixed(2) : '-') + '</td>';
    html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (s.reasoning||'').replace(/"/g,'&quot;') + '">' + (s.reasoning || '-') + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';
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
  const defaultSym = hasOrders
    ? symbols.find(s => DATA.orders.some(o => o.symbol === s)) || symbols[0]
    : symbols[0];
  let html = '<div class="symbol-selector">';
  symbols.forEach((s, i) => {
    const cnt = DATA.orders.filter(o => o.symbol === s).length;
    html += '<button class="symbol-btn' + (s === defaultSym ? ' active' : '') + '" onclick="switchKline(\\'' + s + '\\')">' + s + (cnt ? ' (' + cnt + '笔)' : '') + '</button>';
  });
  html += '</div><div id="chart-container" class="chart-container"><div id="chart-root" style="width:100%;height:560px"></div></div>';
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
  });

  const candleSeries = _klineChart.addCandlestickSeries({
    upColor: '#45d483', downColor: '#ff6b7d',
    borderUpColor: '#45d483', borderDownColor: '#ff6b7d',
    wickUpColor: '#45d483', wickDownColor: '#ff6b7d',
  });

  const lastBars = bars.slice(-200);
  const chartData = lastBars.map(b => ({
    time: b.t,
    open: b.o, high: b.h, low: b.l, close: b.c,
  }));
  candleSeries.setData(chartData);

  const orders = DATA.orders.filter(o => o.symbol === symbol);
  const openPositions = DATA.positions.filter(p => p.symbol === symbol);
  const markers = [];

  // Order markers
  for (const o of orders) {
    const barTime = typeof o.time === 'string' ? Math.floor(new Date(o.time).getTime() / 1000) : o.time;
    let nearest = null, bestDist = Infinity;
    for (const b of lastBars) {
      const dist = Math.abs(b.t - barTime);
      if (dist < 180 && dist < bestDist) { nearest = b; bestDist = dist; }
    }
    if (!nearest) continue;
    if (o.action === 'OPEN') {
      markers.push({
        time: nearest.t, position: 'inBar', color: '#4fc3f7', shape: 'circle',
        text: 'BUY $' + o.price.toFixed(2), size: 2,
      });
    } else if (o.action === 'CLOSE') {
      const pnlText = o.pnl ? (o.pnl > 0 ? ' +$' : ' -$') + Math.abs(o.pnl).toFixed(0) : '';
      markers.push({
        time: nearest.t, position: 'aboveBar',
        color: o.pnl > 0 ? '#45d483' : '#ff6b7d', shape: o.pnl > 0 ? 'arrowUp' : 'arrowDown',
        text: (o.reason || 'CLOSE') + pnlText, size: 3,
      });
    }
  }

  if (markers.length) candleSeries.setMarkers(markers);

  // ── Trade price lines (entry / SL / TP) for positions ──
  const gray = '#808080';
  const firstBarTime = lastBars[0].t;
  for (const pos of openPositions) {
    const entryTime = Math.floor(new Date(pos.entryTime).getTime() / 1000);
    if (entryTime < firstBarTime - 86400 * 3) continue;

    const stopTime = pos.closeTime
      ? Math.floor(new Date(pos.closeTime).getTime() / 1000)
      : entryTime + 2 * 86400;

    // Entry price: full-width dashed line
    candleSeries.createPriceLine({
      price: pos.entryPrice,
      color: gray, lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: false,
    });

    // SL line: time-bounded
    const slSeries = _klineChart.addLineSeries({ color: '#ff6b7d', lineWidth: 1, priceFormat: { type: 'price' } });
    slSeries.setData([{ time: entryTime, value: pos.stopLoss }, { time: stopTime, value: pos.stopLoss }]);

    // TP line: time-bounded
    const tpSeries = _klineChart.addLineSeries({ color: '#45d483', lineWidth: 1, priceFormat: { type: 'price' } });
    tpSeries.setData([{ time: entryTime, value: pos.takeProfit }, { time: stopTime, value: pos.takeProfit }]);

    // Fill band between SL and TP
    if (pos.takeProfit > pos.stopLoss) {
      const fillSeries = _klineChart.addAreaSeries({
        base: pos.stopLoss,
        topColor: 'rgba(128,128,128,0.06)',
        bottomColor: 'rgba(128,128,128,0.02)',
        lineColor: 'transparent', lineWidth: 0,
        priceFormat: { type: 'price' },
      });
      fillSeries.setData([
        { time: entryTime, value: pos.takeProfit },
        { time: stopTime, value: pos.takeProfit },
      ]);
    }
  }

  // ── SL/TP dot markers at exact price levels ──
  if (openPositions.length > 0) {
    const markSeries = _klineChart.addCandlestickSeries({
      upColor: 'transparent', downColor: 'transparent',
      borderUpColor: 'transparent', borderDownColor: 'transparent',
      wickUpColor: 'transparent', wickDownColor: 'transparent',
    });
    const invisibleBars = [];
    const slTpMarks = [];
    for (const pos of openPositions) {
      const et = Math.floor(new Date(pos.entryTime).getTime() / 1000);
      if (et < firstBarTime - 86400 * 3) continue;
      invisibleBars.push({ time: et, open: pos.stopLoss, high: pos.takeProfit, low: pos.stopLoss, close: pos.takeProfit });
      slTpMarks.push({ time: et, position: 'inBar', color: '#ff6b7d', shape: 'circle', text: 'SL $' + pos.stopLoss.toFixed(2), size: 1 });
      slTpMarks.push({ time: et, position: 'inBar', color: '#45d483', shape: 'circle', text: 'TP $' + pos.takeProfit.toFixed(2), size: 1 });
    }
    if (invisibleBars.length) markSeries.setData(invisibleBars);
    if (slTpMarks.length) markSeries.setMarkers(slTpMarks);
  }

  _klineChart.timeScale().fitContent();
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
    localStorage.removeItem('trader_auto_refresh');
  } else {
    localStorage.setItem('trader_auto_refresh', 'on');
    _autoRefreshTimer = setInterval(() => window.location.reload(), _autoRefreshSec * 1000);
    el.innerHTML = '🔄 自动刷新: 每' + (_autoRefreshSec / 60) + '分钟';
  }
};

window.refreshTab = function(name) {
  switch(name) {
    case 'positions': renderPositions(); break;
    case 'orders': renderOrders(); break;
    case 'signals': renderSignals(); break;
    case 'stats': renderStats(); break;
    case 'kline': renderKline(); break;
  }
};

// ─── Init ───
renderPositions();
renderOrders();
renderSignals();
renderStats();
</script>
</body>
</html>`;
}

async function generateDashboard() {
  console.log('📊 生成仪表板...');
  ensureDir(AGENT_DIR);
  const html = buildDashboardHtml();
  fs.writeFileSync(DASHBOARD_FILE, html, 'utf-8');
  console.log(`✅ 仪表板已生成: ${DASHBOARD_FILE}`);
  try {
    execSync(`open "${DASHBOARD_FILE}"`);
  } catch { /* ok */ }
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

  switch (cmd) {
    case 'run':       await run();                break;
    case 'dashboard': await generateDashboard();  break;
    case 'stats':     await showStats();          break;
    case 'positions': await showPositions();      break;
    case 'setup':     await setupCron();          break;
    case 'env':       await setupEnv();           break;
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
