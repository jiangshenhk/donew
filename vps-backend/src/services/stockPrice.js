import db from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const symbolsFile = path.join(__dirname, '..', '..', 'data', 'symbols.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDateKey(timestampMs, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(timestampMs));
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(timestampMs));
  }
}

function dailyBars(result, timeZone) {
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const bars = [];
  for (let i = 0; i < Math.min(timestamps.length, closes.length); i += 1) {
    const close = numberOrNull(closes[i]);
    const ts = numberOrNull(timestamps[i]);
    if (close === null || ts === null) continue;
    bars.push({ timestamp: ts, close, dateKey: formatDateKey(ts * 1000, timeZone) });
  }
  return bars;
}

function previousTradingClose(result, meta) {
  const timeZone = meta?.exchangeTimezoneName || 'UTC';
  const bars = dailyBars(result, timeZone);
  if (!bars.length) return { value: null, source: 'missing-bars', latestBarDate: '', marketDate: '', previousCloseDate: '' };
  const marketTime = numberOrNull(meta?.regularMarketTime);
  const marketDate = marketTime ? formatDateKey(marketTime * 1000, timeZone) : '';
  const latestBar = bars[bars.length - 1];
  const previousBar = bars.length >= 2 ? bars[bars.length - 2] : null;
  if (marketDate && marketDate === latestBar.dateKey) {
    return {
      value: previousBar?.close ?? latestBar.close ?? null,
      source: 'previous-bar-before-market-date',
      latestBarDate: latestBar.dateKey,
      marketDate,
      previousCloseDate: previousBar?.dateKey ?? latestBar.dateKey,
      gapDays: previousBar ? Math.floor((new Date(latestBar.dateKey).getTime() - new Date(previousBar.dateKey).getTime()) / 86400000) : 0,
    };
  }
  return {
    value: latestBar.close ?? null,
    source: 'latest-bar-before-market-date',
    latestBarDate: latestBar.dateKey,
    marketDate,
    previousCloseDate: latestBar.dateKey,
    gapDays: 0,
  };
}

function resolvePreviousClose(result, meta) {
  const barBased = previousTradingClose(result, meta);
  const gapNote = barBased.gapDays > 1 ? `previousClose来自${barBased.gapDays}天前的K线，日变化可能跨多日` : '';
  const directCandidates = [
    numberOrNull(meta?.chartPreviousClose),
    numberOrNull(meta?.previousClose),
    numberOrNull(meta?.regularMarketPreviousClose),
  ].filter(v => v !== null);
  const direct = directCandidates.length ? directCandidates[0] : null;
  if (direct === null) return { ...barBased, gapNote };
  if (barBased.value === null) {
    return { ...barBased, value: direct, source: 'direct-previous-close-no-bar-check', gapNote };
  }
  const diff = Math.abs(direct - barBased.value);
  const tolerance = Math.max(0.02, Math.abs(barBased.value) * 0.002);
  if (diff <= tolerance) {
    return { ...barBased, value: direct, source: 'direct-previous-close-validated', gapNote };
  }
  return { ...barBased, source: `bar-derived-override-direct(${direct})`, gapNote };
}

function resolveChangePercent(price, previousClose) {
  if (price !== null && previousClose !== null && previousClose !== 0) {
    return { value: ((price - previousClose) / previousClose) * 100, source: 'price-vs-previous-daily-close' };
  }
  return { value: null, source: 'missing' };
}

function calcSMA(bars, n) {
  if (!bars.length || n < 1) return null;
  const closes = bars.slice(-n).map(b => b.close).filter(c => c !== null);
  if (closes.length < n) return null;
  return closes.reduce((a, b) => a + b, 0) / closes.length;
}

function calcVsPct(price, sma) {
  if (price === null || sma === null || sma === 0) return null;
  return ((price - sma) / sma) * 100;
}

function loadSymbols() {
  try {
    const config = JSON.parse(fs.readFileSync(symbolsFile, 'utf8'));
    return config.symbols || [];
  } catch (error) {
    console.warn('Cannot load symbols.json:', error.message);
    return [];
  }
}

async function fetchOneSymbol(item, retry = 2) {
  const symbol = typeof item === 'string' ? item : item.symbol;
  const category = typeof item === 'string' ? 'Unknown' : item.category;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=21d&interval=1d&events=history&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 donew-stockprice' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta || {};
    if (!result) throw new Error('No chart data');
    const price = numberOrNull(meta.regularMarketPrice) ?? latestClose(result);
    const bars = dailyBars(result, meta?.exchangeTimezoneName || 'UTC');
    const sma5 = calcSMA(bars, 5);
    const sma10 = calcSMA(bars, 10);
    const vs5Pct = calcVsPct(price, sma5);
    const vs10Pct = calcVsPct(price, sma10);
    const previous = resolvePreviousClose(result, meta);
    const previousClose = previous.value;
    const change = resolveChangePercent(price, previousClose);
    return {
      symbol, category,
      name: meta.shortName ?? meta.longName ?? null,
      price: price ?? null,
      previousClose: previousClose ?? null,
      changePercent: change.value == null ? null : Number(change.value).toFixed(2),
      marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      currency: meta.currency ?? null,
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
      marketState: meta.marketState ?? null,
      quoteSource: 'yahoo-chart',
      changePercentSource: change.source,
      previousCloseSource: previous.source,
      previousCloseDate: previous.previousCloseDate,
      latestBarDate: previous.latestBarDate,
      marketDate: previous.marketDate,
      previousCloseGapNote: previous.gapNote || null,
      sma5: sma5 ?? null,
      sma10: sma10 ?? null,
      vs5Pct: vs5Pct != null ? Number(vs5Pct).toFixed(2) : null,
      vs10Pct: vs10Pct != null ? Number(vs10Pct).toFixed(2) : null,
      barCount: bars.length,
    };
  } catch (e) {
    if (retry > 0) { await sleep(2000); return fetchOneSymbol(item, retry - 1); }
    return { symbol, category, error: e.message };
  }
}

function latestClose(result) {
  const closes = result?.indicators?.quote?.[0]?.close || [];
  for (let i = closes.length - 1; i >= 0; i -= 1) {
    const value = numberOrNull(closes[i]);
    if (value !== null) return value;
  }
  return null;
}

function is24hSymbol(symbol) {
  return /BTC|ETH|SOL|DOGE|USDT|crypto/i.test(symbol);
}

function isWeekday() {
  const day = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return day !== 'Sat' && day !== 'Sun';
}

function etMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return h * 60 + m;
}

function isUsMarketOpen() {
  if (!isWeekday()) return false;
  const m = etMinutes();
  return m >= 570 && m < 960; // 9:30 - 16:00 ET
}

function isUsPostClose() {
  if (!isWeekday()) return false;
  const m = etMinutes();
  return m >= 960 && m < 990; // 16:00 - 16:30 ET (close fix)
}

function shouldFetch(symbol) {
  if (is24hSymbol(symbol)) return true;
  return isUsMarketOpen() || isUsPostClose();
}

export async function fetchAllPrices() {
  const symbols = loadSymbols();
  if (!symbols.length) {
    console.warn('No symbols configured');
    logFetch('stock', 'fail', 'No symbols configured');
    return [];
  }

  const now = new Date();
  if (!isWeekday()) {
    const activeCount = symbols.filter(s => is24hSymbol(s.symbol)).length;
    if (activeCount === 0) {
      console.log('US market closed (weekend), no 24h symbols, skip');
      return [];
    }
    console.log(`US market closed (weekend), only ${activeCount} 24h symbols`);
  }

  const data = [];
  for (const item of symbols) {
    const symbol = typeof item === 'string' ? item : item.symbol;
    if (!shouldFetch(symbol)) {
      continue;
    }
    data.push(await fetchOneSymbol(item));
    await sleep(1000);
  }
  const successCount = data.filter(x => !x.error).length;
  const failCount = data.length - successCount;
  const fetchTime = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO stock_prices (symbol, category, name, price, previous_close, change_percent,
      market_time, currency, exchange, market_state, sma5, sma10, vs5_pct, vs10_pct,
      bar_count, quote_source, previous_close_source, previous_close_date, latest_bar_date,
      market_date, previous_close_gap_note, updated_at, error)
    VALUES (@symbol, @category, @name, @price, @previousClose, @changePercent,
      @marketTime, @currency, @exchange, @marketState, @sma5, @sma10, @vs5Pct, @vs10Pct,
      @barCount, @quoteSource, @previousCloseSource, @previousCloseDate, @latestBarDate,
      @marketDate, @previousCloseGapNote, @updatedAt, @error)
  `);
  const defaults = {
    name: null, price: null, previousClose: null, changePercent: null,
    marketTime: null, currency: null, exchange: null, marketState: null,
    sma5: null, sma10: null, vs5Pct: null, vs10Pct: null,
    barCount: 0, quoteSource: 'yahoo-chart', previousCloseSource: null,
    previousCloseDate: null, latestBarDate: null, marketDate: null,
    previousCloseGapNote: null,
  };
  const tx = db.transaction(() => {
    for (const item of data) {
      insert.run({ ...defaults, ...item, updatedAt: fetchTime, error: item.error || null });
    }
  });
  tx();
  logFetch('stock', 'ok', `fetched ${data.length} symbols, success=${successCount} fail=${failCount}`);
  console.log(`Stock fetch done: success=${successCount} fail=${failCount}`);
  return data;
}

export async function getLatestStockPrices(symbols) {
  if (!symbols || symbols.length === 0) {
    const rows = db.prepare(`
      SELECT s.* FROM stock_prices s
      INNER JOIN (
        SELECT symbol, MAX(updated_at) as max_updated
        FROM stock_prices WHERE error IS NULL
        GROUP BY symbol
      ) latest ON s.symbol = latest.symbol AND s.updated_at = latest.max_updated
    `).all();
    return rows;
  }
  const placeholders = symbols.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT s.* FROM stock_prices s
    INNER JOIN (
      SELECT symbol, MAX(updated_at) as max_updated
      FROM stock_prices WHERE symbol IN (${placeholders}) AND error IS NULL
      GROUP BY symbol
    ) latest ON s.symbol = latest.symbol AND s.updated_at = latest.max_updated
  `).all(...symbols);
  return rows;
}

function logFetch(type, status, message) {
  db.prepare('INSERT INTO fetch_log (type, status, message) VALUES (?, ?, ?)').run(type, status, message);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM fetch_log WHERE created_at < ?").run(oneWeekAgo);
}
