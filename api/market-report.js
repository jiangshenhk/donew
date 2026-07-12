const MARKET_SYMBOLS = [
  "QQQ", "SPY", "IWM", "QLD", "TQQQ", "SMH", "SOXX", "MAGS",
  "EEM", "FXI", "KWEB", "^VIX", "VIXY", "IBIT", "BTC-USD", "MSTR",
  "DX-Y.NYB", "^TNX", "JPY=X", "CL=F", "GC=F", "INTC", "HOOD"
];

const REQUIRED_TARGETS = ["QLD", "EEM", "MSTR", "INTC", "HOOD"];
const CRITICAL_SYMBOLS = ["QQQ", "SPY", "IWM", "SMH", "SOXX", "BTC-USD", "^VIX", "^TNX", "DX-Y.NYB"];
const SYMBOL_LABELS = {
  QQQ: "QQQ",
  SPY: "SPY",
  IWM: "IWM",
  QLD: "QLD",
  TQQQ: "TQQQ",
  SMH: "SMH",
  SOXX: "SOXX",
  MAGS: "MAGS",
  EEM: "EEM",
  FXI: "FXI",
  KWEB: "KWEB",
  "^VIX": "VIX",
  VIXY: "VIXY",
  IBIT: "IBIT",
  "BTC-USD": "BTC",
  MSTR: "MSTR",
  "DX-Y.NYB": "DXY",
  "^TNX": "10Y",
  "JPY=X": "USDJPY",
  "CL=F": "WTI",
  "GC=F": "黄金",
  INTC: "INTC",
  HOOD: "HOOD",
};
const EASTMONEY_SECID = {
  QQQ: "105.QQQ",
  SPY: "105.SPY",
  IWM: "105.IWM",
  QLD: "105.QLD",
  TQQQ: "105.TQQQ",
  SMH: "105.SMH",
  SOXX: "105.SOXX",
  MAGS: "105.MAGS",
  EEM: "105.EEM",
  FXI: "105.FXI",
  KWEB: "105.KWEB",
  IBIT: "105.IBIT",
  MSTR: "105.MSTR",
  INTC: "105.INTC",
  HOOD: "105.HOOD",
};
const NASDAQ_ASSET_CLASS = {
  QQQ: "etf",
  SPY: "etf",
  IWM: "etf",
  QLD: "etf",
  TQQQ: "etf",
  SMH: "etf",
  SOXX: "etf",
  MAGS: "etf",
  EEM: "etf",
  FXI: "etf",
  KWEB: "etf",
  IBIT: "etf",
  VIXY: "etf",
  MSTR: "stocks",
  INTC: "stocks",
  HOOD: "stocks",
};
const FRED_SERIES = {
  "BTC-USD": "CBBTCUSD",
  "^VIX": "VIXCLS",
  "^TNX": "DGS10",
  "DX-Y.NYB": "DTWEXBGS",
};
const MARKET_FETCH_BATCH_SIZE = 4;
const MARKET_FETCH_BATCH_DELAY_MS = 250;
const MARKET_CACHE_TTL_MS = 10 * 60 * 1000;
const marketDataCache = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

async function timedFetch(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sendJson(res, status, data) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  res.status(status).json(data);
}

function cacheKeyFor(symbol) {
  return String(symbol || "").toUpperCase();
}

function cloneRow(row) {
  return row ? JSON.parse(JSON.stringify(row)) : row;
}

function getCachedMarketRow(symbol, forceRefresh = false) {
  if (forceRefresh) return null;
  const entry = marketDataCache.get(cacheKeyFor(symbol));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > MARKET_CACHE_TTL_MS) {
    marketDataCache.delete(cacheKeyFor(symbol));
    return null;
  }
  const cachedRow = cloneRow(entry.row);
  cachedRow.fetchMode = "cache";
  cachedRow.cacheServedAt = new Date().toISOString();
  return cachedRow;
}

function storeMarketRow(row) {
  if (!row?.symbol || !hasUsableSnapshot(row)) return row;
  const normalized = {
    ...cloneRow(row),
    fetchMode: "live",
    cacheStoredAt: row.retrievedAt || new Date().toISOString(),
  };
  marketDataCache.set(cacheKeyFor(row.symbol), {
    cachedAt: Date.now(),
    row: normalized,
  });
  return normalized;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function hkDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function marketSessionNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const minuteOfDay = Number(map.hour) * 60 + Number(map.minute);
  const weekend = map.weekday === "Sat" || map.weekday === "Sun";
  const phase = weekend
    ? "closed"
    : minuteOfDay >= 9 * 60 + 30 && minuteOfDay < 16 * 60
      ? "regular"
      : minuteOfDay >= 4 * 60 && minuteOfDay < 9 * 60 + 30
        ? "premarket"
        : minuteOfDay >= 16 * 60 && minuteOfDay < 20 * 60
          ? "afterhours"
          : "closed";
  const phaseLabels = {
    regular: "美股盘中",
    premarket: "美股盘前",
    afterhours: "美股盘后",
    closed: "美股休市",
  };
  return {
    phase,
    phaseLabel: phaseLabels[phase],
    etClock: `${pad(map.hour)}:${pad(map.minute)}`,
    weekday: map.weekday,
  };
}

function normalizeReportKind(kind) {
  return String(kind || "daily").toLowerCase() === "weekly" ? "weekly" : "daily";
}

function weekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00+08:00`);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function kindMeta(kind) {
  const date = hkDate();
  const normalized = normalizeReportKind(kind);
  if (normalized === "weekly") {
    return {
      kind: "weekly",
      date,
      typeLabel: "周报",
      sessionLabel: "周报",
      title: `${date}市场结构周报`,
      fileName: `${date}市场结构周报.md`,
      basis: `${date}｜${weekday(date)}｜基于周六美股收盘后到周一开盘前的周末窗口，以及最新跨资产数据`,
    };
  }
  const session = marketSessionNow();
  return {
    kind: "daily",
    date,
    typeLabel: "今日分析",
    sessionLabel: "今日最新分析",
    marketPhase: session.phase,
    marketPhaseLabel: session.phaseLabel,
    title: `${date}市场结构日报（${session.phaseLabel}）`,
    fileName: `${date}市场结构日报.md`,
    basis: `${date}｜${weekday(date)}｜以美股前一交易日收盘后到现在为止的最近24小时信息为主；当前阶段：${session.phaseLabel}`,
  };
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseMarketNumber(value) {
  const text = String(value ?? "").replace(/[$,%\s,]/g, "").trim();
  if (!text || /^N\/A$/i.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function pct(value) {
  const n = numberOrNull(value);
  if (n === null) return "未取到";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function browserHeaders(referer = "") {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    ...(referer ? { "Referer": referer } : {}),
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function parseFredCsv(csvText, valueKey) {
  const lines = String(csvText || "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const [date, raw] = lines[i].split(",");
    const value = numberOrNull(raw);
    if (!date || value === null) continue;
    rows.push({ date, value });
  }
  if (!rows.length) throw new Error(`FRED ${valueKey} no rows`);
  return rows;
}

async function fetchFredSeries(symbol) {
  const series = FRED_SERIES[symbol];
  if (!series) return null;
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}&cosd=${encodeURIComponent(isoDaysAgo(220))}`;
  const res = await timedFetch(url, { headers: browserHeaders("https://fred.stlouisfed.org/") }, 10000);
  if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
  const csv = await res.text();
  const rows = parseFredCsv(csv, series);
  if (rows.length < 5) throw new Error(`FRED ${series} insufficient rows`);
  const values = rows.map(item => item.value);
  const last = values.at(-1);
  const prev = values.at(-2) || last;
  const sma20 = avg(values.slice(-20));
  const sma50 = avg(values.slice(-50));
  return {
    symbol,
    last,
    changePct: prev ? (last / prev - 1) * 100 : null,
    vs20Pct: sma20 ? (last / sma20 - 1) * 100 : null,
    vs50Pct: sma50 ? (last / sma50 - 1) * 100 : null,
    marketState: "FRED",
    retrievedAt: new Date().toISOString(),
    marketDataAt: rows.at(-1)?.date || "",
    error: "",
    source: "fred",
  };
}

async function fetchBinanceSnapshot() {
  const url = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
  const res = await timedFetch(url, { headers: browserHeaders("https://www.binance.com/") }, 6000);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const json = await res.json();
  const last = numberOrNull(json.lastPrice);
  const changePct = numberOrNull(json.priceChangePercent);
  if (!isPositiveNumber(last) || changePct === null) throw new Error("Binance invalid 24hr snapshot");
  return {
    last,
    changePct,
    marketDataAt: numberOrNull(json.closeTime) ? new Date(Number(json.closeTime)).toISOString() : "",
  };
}

async function fetchBinanceHistory() {
  const url = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=70";
  const res = await timedFetch(url, { headers: browserHeaders("https://www.binance.com/") }, 6000);
  if (!res.ok) throw new Error(`Binance kline HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json) || json.length < 5) throw new Error("Binance no kline data");
  const closes = json.map(row => numberOrNull(row?.[4])).filter(value => value !== null);
  if (closes.length < 5) throw new Error("Binance invalid closes");
  return {
    closes,
    marketDataAt: Number.isFinite(Number(json.at(-1)?.[6])) ? new Date(Number(json.at(-1)?.[6])).toISOString() : "",
  };
}

async function fetchBitcoinSnapshot() {
  let binanceError = null;
  try {
    const [snapshot, closes] = await Promise.all([fetchBinanceSnapshot(), fetchBinanceHistory()]);
    const sma20 = avg(closes.closes.slice(-20));
    const sma50 = avg(closes.closes.slice(-50));
    return {
      symbol: "BTC-USD",
      last: snapshot.last,
      changePct: snapshot.changePct,
      vs20Pct: sma20 ? (snapshot.last / sma20 - 1) * 100 : null,
      vs50Pct: sma50 ? (snapshot.last / sma50 - 1) * 100 : null,
      marketState: "BINANCE",
      retrievedAt: new Date().toISOString(),
      marketDataAt: snapshot.marketDataAt || closes.marketDataAt || "",
      error: "",
      source: "binance",
    };
  } catch (error) {
    binanceError = error;
  }
  try {
    const fredRow = await fetchFredSeries("BTC-USD");
    if (!isBadSnapshot(fredRow.last, fredRow.changePct, fredRow.vs20Pct, fredRow.vs50Pct)) return fredRow;
    throw new Error("FRED invalid snapshot");
  } catch (error) {
    throw new Error(`Binance: ${binanceError?.message || "failed"} | FRED: ${error.message}`);
  }
}

async function fetchNasdaqInfo(symbol, assetClass) {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=${encodeURIComponent(assetClass)}`;
  const res = await timedFetch(url, {
    headers: {
      ...browserHeaders("https://www.nasdaq.com/"),
      "Origin": "https://www.nasdaq.com",
    },
  }, 4500);
  if (!res.ok) throw new Error(`Nasdaq info HTTP ${res.status}`);
  const json = await res.json();
  const data = json.data;
  if (!data?.primaryData) throw new Error(`Nasdaq info missing data for ${symbol}`);
  return data;
}

async function fetchNasdaqHistory(symbol, assetClass) {
  const fromdate = isoDaysAgo(120);
  const todate = todayIso();
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=${encodeURIComponent(assetClass)}&fromdate=${fromdate}&todate=${todate}&limit=80`;
  const res = await timedFetch(url, {
    headers: {
      ...browserHeaders("https://www.nasdaq.com/"),
      "Origin": "https://www.nasdaq.com",
    },
  }, 4500);
  if (!res.ok) throw new Error(`Nasdaq history HTTP ${res.status}`);
  const json = await res.json();
  const rows = json.data?.tradesTable?.rows || [];
  if (rows.length < 5) throw new Error(`Nasdaq history missing rows for ${symbol}`);
  const closes = rows
    .map(row => parseMarketNumber(row.close))
    .filter(value => value !== null);
  if (closes.length < 5) throw new Error(`Nasdaq history invalid closes for ${symbol}`);
  return {
    closes: closes.reverse(),
    marketDataAt: rows[0]?.date || "",
  };
}

async function fetchNasdaqSnapshot(symbol) {
  const assetClass = NASDAQ_ASSET_CLASS[symbol];
  if (!assetClass) return null;
  const [info, closes] = await Promise.all([
    fetchNasdaqInfo(symbol, assetClass),
    fetchNasdaqHistory(symbol, assetClass),
  ]);
  const last = parseMarketNumber(info.primaryData?.lastSalePrice) ?? closes.closes.at(-1);
  const changePct = parseMarketNumber(info.primaryData?.percentageChange);
  const prev = closes.closes.at(-2) || closes.closes.at(-1);
  const derivedChangePct = prev ? (last / prev - 1) * 100 : null;
  const sma20 = avg(closes.closes.slice(-20));
  const sma50 = avg(closes.closes.slice(-50));
  return {
    symbol,
    last,
    changePct: changePct ?? derivedChangePct,
    vs20Pct: sma20 ? (last / sma20 - 1) * 100 : null,
    vs50Pct: sma50 ? (last / sma50 - 1) * 100 : null,
    marketState: info.marketStatus || "NASDAQ",
    retrievedAt: new Date().toISOString(),
    marketDataAt: info.primaryData?.lastTradeTimestamp || closes.marketDataAt || "",
    error: "",
    source: "nasdaq",
  };
}

async function fetchStableFallback(symbol) {
  if (symbol === "BTC-USD") return fetchBitcoinSnapshot();
  if (NASDAQ_ASSET_CLASS[symbol]) return fetchNasdaqSnapshot(symbol);
  if (FRED_SERIES[symbol]) return fetchFredSeries(symbol);
  return null;
}

async function fetchFinalFallback(symbol, priorErrors = []) {
  if (!FRED_SERIES[symbol]) return null;
  try {
    const fredRow = await fetchFredSeries(symbol);
    if (!isBadSnapshot(fredRow.last, fredRow.changePct, fredRow.vs20Pct, fredRow.vs50Pct)) return fredRow;
    throw new Error("FRED invalid snapshot");
  } catch (error) {
    const parts = [...priorErrors.filter(Boolean), `fred:${error.message}`];
    throw new Error(parts.join(" | "));
  }
}

function avg(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isPositiveNumber(value) {
  const n = numberOrNull(value);
  return n !== null && n > 0;
}

async function fetchMarketSnapshot(forceRefresh = false) {
  const session = marketSessionNow();
  const quoteMap = {};
  const rows = [];
  for (let i = 0; i < MARKET_SYMBOLS.length; i += MARKET_FETCH_BATCH_SIZE) {
    if (i > 0) await sleep(MARKET_FETCH_BATCH_DELAY_MS);
    const symbols = MARKET_SYMBOLS.slice(i, i + MARKET_FETCH_BATCH_SIZE);
    const batchRows = await Promise.all(symbols.map(symbol => fetchSymbol(symbol, quoteMap[symbol], session, forceRefresh)));
    rows.push(...batchRows);
  }
  return Object.fromEntries(rows.map(row => [row.symbol, row]));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function row(snapshot, symbol) {
  return snapshot[symbol] || { symbol, error: "missing" };
}

async function fetchQuoteSnapshot() {
  const symbols = MARKET_SYMBOLS.join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
  const res = await timedFetch(url, { headers: browserHeaders("https://finance.yahoo.com/") }, 2500);
  if (!res.ok) throw new Error(`Quote HTTP ${res.status}`);
  const json = await res.json();
  const results = json.quoteResponse?.result || [];
  return Object.fromEntries(results.map(item => [item.symbol, item]));
}

function latestPriceFromQuote(quote, phase) {
  if (!quote) return null;
  if (phase === "regular" && quote.regularMarketPrice != null) return quote.regularMarketPrice;
  if (phase === "premarket" && quote.preMarketPrice != null) return quote.preMarketPrice;
  if (phase === "afterhours" && quote.postMarketPrice != null) return quote.postMarketPrice;
  return quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? null;
}

function latestChangePctFromQuote(quote, phase) {
  if (!quote) return null;
  if (phase === "regular" && quote.regularMarketChangePercent != null) return quote.regularMarketChangePercent;
  if (phase === "premarket" && quote.preMarketChangePercent != null) return quote.preMarketChangePercent;
  if (phase === "afterhours" && quote.postMarketChangePercent != null) return quote.postMarketChangePercent;
  return quote.regularMarketChangePercent ?? quote.postMarketChangePercent ?? quote.preMarketChangePercent ?? null;
}

async function fetchEastmoneyKline(symbol) {
  const secid = EASTMONEY_SECID[symbol];
  if (!secid) return null;
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&beg=20260101&end=20261231`;
  const res = await timedFetch(url, { headers: browserHeaders("https://quote.eastmoney.com/") }, 6000);
  if (!res.ok) throw new Error(`Eastmoney HTTP ${res.status}`);
  const json = await res.json();
  const klines = json.data?.klines || [];
  if (klines.length < 5) throw new Error("Eastmoney no kline data");
  const closes = klines
    .map(line => Number(String(line).split(",")[2]))
    .filter(value => Number.isFinite(value) && value > 0);
  if (closes.length < 5) throw new Error("Eastmoney invalid closes");
  const last = closes.at(-1);
  const prev = closes.at(-2) || last;
  const sma20 = avg(closes.slice(-20));
  const sma50 = avg(closes.slice(-50));
  return {
    symbol,
    last,
    changePct: prev ? (last / prev - 1) * 100 : null,
    vs20Pct: sma20 ? (last / sma20 - 1) * 100 : null,
    vs50Pct: sma50 ? (last / sma50 - 1) * 100 : null,
    marketState: "EASTMONEY",
    retrievedAt: new Date().toISOString(),
    marketDataAt: String(json.data?.klines?.at(-1) || "").split(",")[0] || "",
    error: "",
    source: "eastmoney",
  };
}

function isBadSnapshot(price, changePct, vs20Pct, vs50Pct) {
  if (!isPositiveNumber(price)) return true;
  if (numberOrNull(changePct) === null) return true;
  if (Math.abs(changePct) >= 95) return true;
  if (numberOrNull(vs20Pct) !== null && Math.abs(vs20Pct) >= 95) return true;
  if (numberOrNull(vs50Pct) !== null && Math.abs(vs50Pct) >= 95) return true;
  return false;
}

function hasUsableSnapshot(item) {
  if (!item) return false;
  return isPositiveNumber(item.last) && numberOrNull(item.changePct) !== null;
}

function symbolLabel(symbol) {
  return SYMBOL_LABELS[symbol] || symbol;
}

function snapshotWarnings(snapshot) {
  const missingCritical = CRITICAL_SYMBOLS.filter(symbol => !hasUsableSnapshot(row(snapshot, symbol)));
  const missingAll = MARKET_SYMBOLS.filter(symbol => !hasUsableSnapshot(row(snapshot, symbol)));
  return {
    missingCritical,
    missingAll,
    hasWarning: missingCritical.length > 0,
  };
}

function formatSourceLabel(source) {
  if (!source) return "未取到";
  if (source === "yahoo") return "Yahoo Finance";
  if (source === "eastmoney") return "东方财富";
  if (source === "nasdaq") return "Nasdaq";
  if (source === "fred") return "FRED";
  if (source === "binance") return "Binance";
  if (source === "nasdaq/yahoo") return "Nasdaq / Yahoo";
  if (source === "fred/yahoo") return "FRED / Yahoo";
  if (source === "yahoo/fred") return "Yahoo / FRED";
  if (source === "binance/fred") return "Binance / FRED";
  if (source === "binance/fred/yahoo") return "Binance / FRED / Yahoo";
  return source;
}

function formatSourceNote(error) {
  const text = String(error || "").trim();
  if (!text) return "-";
  if (/\|/.test(text)) {
    const parts = text
      .split("|")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const lower = part.toLowerCase();
        let label = "行情源";
        if (lower.includes("binance")) label = "Binance";
        else if (lower.includes("yahoo")) label = "Yahoo";
        else if (lower.includes("fred")) label = "FRED";
        else if (lower.includes("eastmoney")) label = "东方财富";
        if (/AbortError|aborted|timeout/i.test(part)) return `${label} 超时`;
        if (/429/.test(part)) return `${label} 限流`;
        if (/HTTP\s+\d+/i.test(part)) return `${label} 返回异常`;
        if (/missing|No close data|No data|invalid/i.test(part)) return `${label} 数据不完整`;
        if (/FRED/i.test(part)) return `${label} 未成功返回`;
        return `${label} 未取到`;
      });
    return parts.join("；");
  }
  if (/AbortError|aborted|timeout/i.test(text)) return "行情源请求超时，未取到可靠数据";
  if (/429/.test(text)) return "行情源限流，未取到可靠数据";
  if (/FRED/i.test(text)) return "FRED回退源未取到";
  if (/HTTP\s+\d+/i.test(text)) return "行情源返回异常，未取到可靠数据";
  if (/missing|No close data|No data/i.test(text)) return "行情源数据不完整";
  return "未取到可靠数据";
}

function buildDataWarningBlock(snapshot) {
  const warnings = snapshotWarnings(snapshot);
  if (!warnings.hasWarning) return "";
  return `> **数据告警：** ${warnings.missingCritical.map(symbolLabel).join("、")} 未取到可靠最新行情，相关表格已标记为“未取到”，不要按 0 或中性处理；下单前需手动复核。`;
}

function dataSourceRows(snapshot) {
  const focusSymbols = ["QQQ", "SPY", "IWM", "SMH", "SOXX", "BTC-USD", "^VIX", "^TNX", "DX-Y.NYB", "MSTR", "INTC", "HOOD"];
  return focusSymbols.map(symbol => {
    const item = row(snapshot, symbol);
    const status = hasUsableSnapshot(item) ? "正常" : "缺失";
    return `| ${symbolLabel(symbol)} | ${formatSourceLabel(item.source)} | ${item.fetchMode === "cache" ? "缓存" : "实时"} | ${formatRetrievedAt(item.cacheStoredAt || item.retrievedAt)} | ${formatRetrievedAt(item.marketDataAt)} | ${status} | ${formatSourceNote(item.error)} |`;
  }).join("\n");
}

function formatRetrievedAt(value) {
  if (!value) return "未取到";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false });
}

function dataSourceDetailsBlock(snapshot, extraSourceLabel = "") {
  const focusSymbols = ["QQQ", "SPY", "IWM", "SMH", "SOXX", "BTC-USD", "^VIX", "^TNX", "DX-Y.NYB", "MSTR", "INTC", "HOOD"];
  const rowsHtml = focusSymbols.map(symbol => {
    const item = row(snapshot, symbol);
    const status = hasUsableSnapshot(item) ? "正常" : "缺失";
    return `<tr><td>${symbolLabel(symbol)}</td><td>${formatSourceLabel(item.source)}</td><td>${item.fetchMode === "cache" ? "缓存" : "实时"}</td><td>${formatRetrievedAt(item.cacheStoredAt || item.retrievedAt)}</td><td>${formatRetrievedAt(item.marketDataAt)}</td><td>${status}</td><td>${formatSourceNote(item.error)}</td></tr>`;
  }).join("");
  return `
<details>
  <summary>本文所使用的价格数据来源 + 时间</summary>
  <p>新闻补充源：${extraSourceLabel || "暂未启用" }。</p>
  <table>
    <thead>
      <tr><th>指标</th><th>实际来源</th><th>方式</th><th>数据获取时间</th><th>行情时间</th><th>状态</th><th>备注</th></tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</details>`.trim();
}

async function fetchSymbol(symbol, quote, session, forceRefresh = false) {
  const cached = getCachedMarketRow(symbol, forceRefresh);
  if (cached) return cached;
  const errors = [];
  let stableError = null;
  const stableFirstRow = await fetchStableFallback(symbol).catch(error => {
    stableError = error;
    return null;
  });
  if (stableError?.message) errors.push(`stable:${stableError.message}`);
  if (stableFirstRow && !isBadSnapshot(stableFirstRow.last, stableFirstRow.changePct, stableFirstRow.vs20Pct, stableFirstRow.vs50Pct)) {
    return storeMarketRow(stableFirstRow);
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
  try {
    const res = await timedFetch(url, { headers: browserHeaders("https://finance.yahoo.com/") }, 3500);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    const closes = (result?.indicators?.quote?.[0]?.close || []).filter(value => value !== null && value !== undefined).map(Number);
    if (!result || closes.length < 5) throw new Error("No close data");
    const lastChart = numberOrNull(result.meta?.regularMarketPrice) || closes.at(-1);
    const prev = closes.length > 1 ? closes.at(-2) : closes.at(-1);
    const quotePrice = numberOrNull(latestPriceFromQuote(quote, session.phase));
    const derivedPrice = isPositiveNumber(quotePrice) ? quotePrice : numberOrNull(lastChart);
    const derivedChangePct = isPositiveNumber(derivedPrice) && isPositiveNumber(prev)
      ? (derivedPrice / prev - 1) * 100
      : null;
    const quoteChangePct = numberOrNull(latestChangePctFromQuote(quote, session.phase));
    const hasMeaningfulDerivedChange = numberOrNull(derivedChangePct) !== null && Math.abs(derivedChangePct) >= 0.05;
    const hasMeaningfulQuoteChange = quoteChangePct !== null && Math.abs(quoteChangePct) >= 0.05;
    const shouldUseQuoteChange =
      session.phase !== "closed" &&
      isPositiveNumber(quotePrice) &&
      quoteChangePct !== null &&
      (hasMeaningfulQuoteChange || !hasMeaningfulDerivedChange);
    const price = derivedPrice;
    const changePct = shouldUseQuoteChange ? quoteChangePct : derivedChangePct;
    const sma20 = avg(closes.slice(-20));
    const sma50 = avg(closes.slice(-50));
    const yahooRow = {
      symbol,
      last: price,
      changePct,
      vs20Pct: sma20 ? (price / sma20 - 1) * 100 : 0,
      vs50Pct: sma50 ? (price / sma50 - 1) * 100 : 0,
      marketState: quote?.marketState || result?.meta?.marketState || "",
      retrievedAt: new Date().toISOString(),
      marketDataAt: Number.isFinite(Number(result?.meta?.regularMarketTime)) ? new Date(Number(result.meta.regularMarketTime) * 1000).toISOString() : "",
      error: "",
      source: "yahoo",
    };
    if (!isBadSnapshot(yahooRow.last, yahooRow.changePct, yahooRow.vs20Pct, yahooRow.vs50Pct)) {
      return storeMarketRow(yahooRow);
    }
    const eastmoneyRow = await fetchEastmoneyKline(symbol).catch(() => null);
    if (eastmoneyRow && !isBadSnapshot(eastmoneyRow.last, eastmoneyRow.changePct, eastmoneyRow.vs20Pct, eastmoneyRow.vs50Pct)) {
      return storeMarketRow(eastmoneyRow);
    }
    const finalFallback = await fetchFinalFallback(symbol, errors).catch(error => {
      errors.push(error.message);
      return null;
    });
    if (finalFallback) return storeMarketRow(finalFallback);
    return yahooRow;
  } catch (error) {
    errors.push(`yahoo:${error.message}`);
    const eastmoneyRow = await fetchEastmoneyKline(symbol).catch(() => null);
    if (eastmoneyRow) return storeMarketRow(eastmoneyRow);
    const finalFallback = await fetchFinalFallback(symbol, errors).catch(fallbackError => {
      errors.push(fallbackError.message);
      return null;
    });
    if (finalFallback) return storeMarketRow(finalFallback);
    return {
      symbol,
      last: null,
      changePct: null,
      vs20Pct: null,
      vs50Pct: null,
      retrievedAt: new Date().toISOString(),
      error: errors.join(" | ") || error.message,
      source: symbol === "BTC-USD"
        ? "binance/fred/yahoo"
        : NASDAQ_ASSET_CLASS[symbol]
          ? "nasdaq/yahoo"
          : FRED_SERIES[symbol]
            ? "fred/yahoo"
            : "yahoo",
    };
  }
}

function extractJin10Items(html, limit = 8) {
  const stripped = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
  const lines = stripped
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.length > 6);
  const items = [];
  const timePattern = /^\d{2}:\d{2}:\d{2}$/;
  for (let i = 0; i < lines.length; i += 1) {
    if (!timePattern.test(lines[i])) continue;
    let headline = "";
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const candidate = lines[j];
      if (timePattern.test(candidate)) break;
      if (/^(更多|登录|注册|直播|广告|首页|快讯|数据|日历|专题|频道|排行|免责声明|客服|搜索)$/i.test(candidate)) continue;
      if (candidate.length < 8) continue;
      headline = candidate;
      break;
    }
    if (headline) {
      items.push(headline);
      if (items.length >= limit) break;
    }
  }
  return items;
}

async function fetchJin10News() {
  const urls = [
    "https://search.jin10.com/?page=1&type=flash&order=1&keyword=%E9%87%91%E5%8D%81%E6%95%B0%E6%8D%AE%E6%95%B4%E7%90%86&offset=0&vip=&basic_mode=",
    "https://xnews.jin10.com/",
  ];
  for (const url of urls) {
    try {
      const res = await timedFetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 5000);
      if (!res.ok) continue;
      const html = await res.text();
      const items = extractJin10Items(html, 8);
      if (items.length) {
        return { source: url, items };
      }
    } catch (error) {
      continue;
    }
  }
  return { source: urls[0], items: [] };
}

function classify(snapshot) {
  const qqq = row(snapshot, "QQQ");
  const spy = row(snapshot, "SPY");
  const iwm = row(snapshot, "IWM");
  const vix = row(snapshot, "^VIX");
  const tnx = row(snapshot, "^TNX");
  const dxy = row(snapshot, "DX-Y.NYB");
  const btc = row(snapshot, "BTC-USD");
  const smh = row(snapshot, "SMH");
  const soxx = row(snapshot, "SOXX");

  let risk = 5.5;
  if ((vix.changePct || 0) > 5) risk += 1.2;
  if ((tnx.changePct || 0) > 1 || (dxy.changePct || 0) > 0.3) risk += 0.8;
  if ((qqq.vs20Pct || 0) < 0 || (spy.vs20Pct || 0) < 0) risk += 0.8;
  if ((smh.changePct || 0) < -1 || (soxx.changePct || 0) < -1) risk += 0.6;
  if ((btc.changePct || 0) < -2) risk += 0.8;
  if ((iwm.changePct || 0) > (spy.changePct || 0)) risk -= 0.3;
  if ((vix.changePct || 0) < -3) risk -= 0.5;
  const warnings = snapshotWarnings(snapshot);
  if (warnings.missingCritical.length >= 3) risk = Math.max(risk, 7.2);
  else if (warnings.missingCritical.length > 0) risk = Math.max(risk, 6.4);
  risk = Math.max(1, Math.min(9.5, risk));

  const windLight = risk >= 7.5 ? "🔴 逆风" : risk >= 6.2 ? "🟡 横风" : "🟢 顺风";
  const executionLevel = risk >= 7.5 ? "D" : risk >= 6.2 ? "B" : "A";
  const putEnvironment = risk >= 7.5 ? "不适合" : risk >= 6.2 ? "谨慎" : "适合";
  const eventRisk = risk >= 7.5 ? "高" : risk >= 6.2 ? "中" : "低";

  const base = {
    riskScore: risk.toFixed(1),
    windLight,
    executionLevel,
    putEnvironment,
    eventRisk,
    marketStage: risk >= 7.5 ? "risk-off / 高beta降级" : risk >= 6.2 ? "横风震荡 / 主线筛选" : "顺风修复 / 可小仓进攻",
    trueTheme: `VIX ${pct(vix.changePct)}、10Y ${pct(tnx.changePct)}、DXY ${pct(dxy.changePct)}、半导体 ${pct(smh.changePct)}、BTC ${pct(btc.changePct)} 的组合确认`,
    truthTeller: "VIX、10Y/DXY、SMH/SOXX、BTC 与 MSTR 相对强弱",
    capitalFlow: `QQQ ${pct(qqq.changePct)}，SPY ${pct(spy.changePct)}，IWM ${pct(iwm.changePct)}；半导体SMH ${pct(smh.changePct)}，BTC ${pct(btc.changePct)}。`,
  };
  if (!warnings.hasWarning) return base;
  return {
    ...base,
    marketStage: `${base.marketStage}（数据不完整）`,
    trueTheme: `${base.trueTheme}；其中 ${warnings.missingCritical.map(symbolLabel).join("、")} 未取到，需谨慎解读。`,
    capitalFlow: `${base.capitalFlow} 其中 ${warnings.missingCritical.map(symbolLabel).join("、")} 未取到，不按 0 解读。`,
  };
}

function targetRows(snapshot, classification) {
  const wind = classification.windLight;
  const level = classification.executionLevel;
  const noSell = level === "D" || wind.includes("逆风");
  const cautious = level === "B";
  const actionFor = (symbol) => {
    if (noSell) return "暂停新增";
    if (cautious) return symbol === "MSTR" ? "只观察，等待BTC确认" : "只允许远OTM小仓观察";
    return symbol === "MSTR" ? "顺风时也只考虑极小仓" : "可按公共参数小仓筛选";
  };
  const invalid = {
    QLD: "QQQ跌破5/10日趋势、VIX跳升、10Y压制科技",
    EEM: "DXY快速走强、10Y上行、亚洲资产转弱",
    MSTR: "BTC跌破关键位、MSTR弱于BTC、公司叙事受损",
    INTC: "弱于SOXX/QQQ、出现公司事件风险",
    HOOD: "Crypto风险退潮、券商风险偏好降温、强势结构跌破",
  };
  return REQUIRED_TARGETS.map(symbol => ({
    symbol,
    wind,
    level,
    action: actionFor(symbol),
    delta: noSell || cautious ? "不新开仓；仅观察" : "0.12-0.18，优先0.15",
    dte: noSell ? "不建议" : "4-10个自然日",
    cushion: "优先>=7%",
    size: noSell ? "0" : cautious ? "极小仓/小仓" : "小仓",
    invalid: invalid[symbol],
    latest: row(snapshot, symbol),
  }));
}

function snapshotTable(snapshot) {
  return MARKET_SYMBOLS.map(symbol => {
    const item = row(snapshot, symbol);
    return `| ${symbol} | ${item.last === null ? "" : item.last?.toFixed?.(2)} | ${pct(item.changePct)} | ${pct(item.vs20Pct)} | ${pct(item.vs50Pct)} | ${item.error || ""} |`;
  }).join("\n");
}

function archiveRow(report) {
  const date = report.date;
  const label = report.kind === "weekly" ? "周报" : report.sessionLabel;
  return `| **${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日** | ${weekday(date)} | ${report.typeLabel} | [${label}](/docs/市场/${report.fileName}) | ${report.headline} | ${report.targets.map(t => `${t.symbol}:${t.action}`).join("；")} | |`;
}

function displayDate(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatPctValue(value, digits = 2) {
  const n = numberOrNull(value);
  if (n === null) return "-";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function formatPrice(value) {
  const n = numberOrNull(value);
  if (n === null) return "未取到";
  return n.toFixed(2);
}

function formatRiskValue(value, digits = 1) {
  const n = numberOrNull(value);
  if (n === null) return "-";
  return `${n.toFixed(digits)} / 10`;
}

function formatHeadlineValue(value) {
  const n = numberOrNull(value);
  if (n === null) return "未取到";
  return n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
}

function headlineFor(kind, classification) {
  if (kind === "weekly") {
    return classification.executionLevel === "D"
      ? "本周市场发生了明显的风险重定价，高beta去杠杆已经出现，QLD暂停主动加仓，MSTR继续禁卖，INTC只观察。"
      : classification.executionLevel === "B"
        ? "本周市场以横风震荡为主，资金在修复与回撤之间反复切换，QLD只能远OTM小仓，MSTR继续等待BTC确认。"
        : "本周市场仍有修复，但结构并不统一，卖 Put 只能保守筛选，优先看半导体和低Delta机会。";
  }
  return classification.executionLevel === "D"
    ? "最近24小时的核心主线仍偏防守，波动率、利率与加密链没有给出顺风确认，7天卖 Put 不适合新增。"
    : classification.executionLevel === "B"
      ? "最近24小时的市场处于横风震荡，主线没有彻底转坏，但只能小仓、远OTM、等待盘中或收盘确认。"
      : "最近24小时的市场处于顺风修复，主线资产给出一定确认，但卖 Put 仍要按公共参数保守筛选。";
}

function finalCommandFor(kind, classification) {
  if (kind === "weekly") {
    return classification.executionLevel === "D"
      ? "下周先防守，QLD暂停主动加仓，MSTR继续禁卖，INTC只观察，不追strike。"
      : classification.executionLevel === "B"
        ? "下周以横风处理，QLD只保留极远OTM小仓候选，MSTR继续等BTC确认。"
        : "下周可以保留卖 Put 候选，但仍要先复核VIX、10Y、BTC与半导体结构。";
  }
  return classification.executionLevel === "D"
    ? "今天不新增7天Put，先观察VIX、10Y/DXY、半导体和BTC是否止稳。"
    : classification.executionLevel === "B"
      ? "今天只允许远OTM小仓观察，等VIX、10Y、BTC和半导体确认后再提高风险。"
      : "今天可小仓筛选7天Put，但必须复核实时IV、bid-ask、OI、事件日历和breakeven。";
}

function overviewRows(classification) {
  return `| **市场阶段** | **${classification.marketStage}** |
| **资金流向** | **${classification.capitalFlow}** |
| **风险评分** | **${classification.riskScore} / 10** |`;
}

function flowRows(snapshot, classification, kind) {
  const qqq = row(snapshot, "QQQ");
  const qld = row(snapshot, "QLD");
  const iwm = row(snapshot, "IWM");
  const smh = row(snapshot, "SMH");
  const soxx = row(snapshot, "SOXX");
  const btc = row(snapshot, "BTC-USD");
  const mstr = row(snapshot, "MSTR");
  const dxy = row(snapshot, "DX-Y.NYB");
  const vix = row(snapshot, "^VIX");
  const tnx = row(snapshot, "^TNX");
  const actionVerb = kind === "weekly" ? "本周" : "近24小时";
  return [
    `| 🟢 **半导体明显强于大盘** | ${formatPctValue(smh.vs20Pct)}、SOXX ${formatPctValue(soxx.vs20Pct)} | SMH / SOXX | AI/半导体仍是资金承接最清晰的方向。 |`,
    `| 🟡 **纳指修复但不够强** | QQQ ${formatPctValue(qqq.vs20Pct)}，QLD ${formatPctValue(qld.vs20Pct)} | QQQ / QLD | ${actionVerb}只能把候选池打开，不能按强趋势追价。 |`,
    `| 🟢 **小盘相对有扩散** | IWM ${formatPctValue(iwm.vs20Pct)} | IWM vs QQQ/SPY | 风险偏好有扩散，但未必足以支撑全面进攻。 |`,
    `| 🔴 **BTC 与 MSTR 继续打脸 risk-on** | BTC ${formatPctValue(btc.vs20Pct)}、MSTR ${formatPctValue(mstr.vs20Pct)} | BTC-USD / MSTR | 加密链不能作为卖 Put 的安全标的。 |`,
    `| 🟡 **美元与波动率仍需盯紧** | DXY ${formatPctValue(dxy.changePct)}，VIX ${formatPctValue(vix.changePct)}，10Y ${formatPctValue(tnx.changePct)} | DXY / VIX / 10Y | 流动性环境没有完全放松，卖 Put 必须降低 Delta。 |`,
  ].join("\n");
}

function strategyRows(snapshot, classification) {
  const level = classification.executionLevel;
  const allowPut = level === "A";
  const cautiousPut = level === "B";
  const qldLogic = level === "D"
    ? "纳指与波动率没有确认，暂停主动新增。"
    : cautiousPut
      ? "保留候选，但只允许远 OTM 小仓，等待确认。"
      : "可作为主观察池，但仍需复核 VIX、10Y 与盘中结构。";
  const mstrLogic = "BTC 没有给出稳定确认前，MSTR 高 IV 对应的是尾部风险。";
  const intcLogic = "半导体主线与个股高波动并存，只能更严格筛选，不把高 IV 当优势。";
  return [
    `| **QQQ / QLD** | ${allowPut ? "⚠️" : cautiousPut ? "⚠️" : "❌"} | ${allowPut ? "⚠️" : cautiousPut ? "⚠️" : "❌"} | ${qldLogic} |`,
    `| **SPY** | ⚠️ | ${level === "D" ? "⚠️" : "⚠️"} | 宽基更稳，但不是当前主进攻方向。 |`,
    `| **MSTR** | ❌ | ❌ | ${mstrLogic} |`,
    `| **INTC** | ❌ | ${level === "D" ? "⚠️" : "⚠️"} | ${intcLogic} |`,
    `| **GLD / IAU** | ⚠️ | ❌ | 更适合作为风险温度计，不是当前卖 Put 主线。 |`,
    `| **USO / XLE** | ⚠️ | ❌ | 油价是宏观变量，不代表能源标的适合直接卖 Put。 |`,
    `| **BTC** | ${level === "A" ? "⚠️" : "❌"} | ❌ | 先看是否继续确认或拖累风险偏好。 |`,
  ].join("\n");
}

function macroRows(snapshot) {
  return [
    `| **DXY** | \`${formatPrice(row(snapshot, "DX-Y.NYB").last)}\` | ${formatPctValue(row(snapshot, "DX-Y.NYB").changePct)} | 美元偏强仍压制 EEM 与高 beta 扩散。 |`,
    `| **美10Y收益率** | \`${formatPrice(row(snapshot, "^TNX").last)}\` | ${formatPctValue(row(snapshot, "^TNX").changePct)} | 对科技估值有利或不利，是风向的关键变量。 |`,
    `| **USDJPY** | \`${formatPrice(row(snapshot, "JPY=X").last)}\` | ${formatPctValue(row(snapshot, "JPY=X").changePct)} | 仍需观察是否触发 carry trade 进一步波动。 |`,
    `| **黄金** | \`${formatPrice(row(snapshot, "GC=F").last)}\` | ${formatPctValue(row(snapshot, "GC=F").changePct)} | 避险溢价与实际利率都在影响价格。 |`,
    `| **WTI 原油** | \`${formatPrice(row(snapshot, "CL=F").last)}\` | ${formatPctValue(row(snapshot, "CL=F").changePct)} | 油价是科技估值和通胀交易的共同变量。 |`,
    `| **比特币** | \`${formatPrice(row(snapshot, "BTC-USD").last)}\` | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} | 加密链是否确认，直接影响 MSTR 能不能从禁卖转观察。 |`,
    `| **VIX** | \`${formatPrice(row(snapshot, "^VIX").last)}\` | ${formatPctValue(row(snapshot, "^VIX").changePct)} | 风险没有消失，只是有时会暂时变得更可交易。 |`,
  ].join("\n");
}

function riskRows(snapshot, mode = "daily") {
  if (mode === "weekly") {
    return [
      `| **QQQ / Nasdaq** | QQQ ${formatPctValue(row(snapshot, "QQQ").changePct)}，相对20日线 ${formatPctValue(row(snapshot, "QQQ").vs20Pct)} | 科技主线强弱的直接观察窗 | 决定 QLD 能否从观察转为执行。 |`,
      `| **SPY / S&P 500** | SPY ${formatPctValue(row(snapshot, "SPY").changePct)}，相对20日线 ${formatPctValue(row(snapshot, "SPY").vs20Pct)} | 宽基承接是否稳定 | 判断是否只是局部主线强。 |`,
      `| **QLD** | ${formatPctValue(row(snapshot, "QLD").changePct)} / 相对20日线 ${formatPctValue(row(snapshot, "QLD").vs20Pct)} | 高 beta 承压或修复的放大器 | 决定卖 Put 的仓位和 Delta。 |`,
      `| **SMH / SOXX** | ${formatPctValue(row(snapshot, "SMH").changePct)} / ${formatPctValue(row(snapshot, "SOXX").changePct)} | 半导体是否继续充当主线确认 | 若失速，QLD 与 INTC 同步降级。 |`,
      `| **INTC** | ${formatPctValue(row(snapshot, "INTC").changePct)} / 相对20日线 ${formatPctValue(row(snapshot, "INTC").vs20Pct)} | 个股高波动与半导体 beta 并存 | 只能更远 OTM，不追高 strike。 |`,
      `| **IBIT / MSTR** | ${formatPctValue(row(snapshot, "IBIT").changePct)} / ${formatPctValue(row(snapshot, "MSTR").changePct)} | 加密链是否确认或继续拖累 | MSTR 未确认前继续禁卖。 |`,
    ].join("\n");
  }
  return [
    `| **QQQ** | \`${formatPrice(row(snapshot, "QQQ").last)}\` | ${formatPctValue(row(snapshot, "QQQ").changePct)} | ${formatPctValue(row(snapshot, "QQQ").vs20Pct)} | ${formatPctValue(row(snapshot, "QQQ").vs50Pct)} |`,
    `| **SPY** | \`${formatPrice(row(snapshot, "SPY").last)}\` | ${formatPctValue(row(snapshot, "SPY").changePct)} | ${formatPctValue(row(snapshot, "SPY").vs20Pct)} | ${formatPctValue(row(snapshot, "SPY").vs50Pct)} |`,
    `| **IWM** | \`${formatPrice(row(snapshot, "IWM").last)}\` | ${formatPctValue(row(snapshot, "IWM").changePct)} | ${formatPctValue(row(snapshot, "IWM").vs20Pct)} | ${formatPctValue(row(snapshot, "IWM").vs50Pct)} |`,
    `| **QLD** | \`${formatPrice(row(snapshot, "QLD").last)}\` | ${formatPctValue(row(snapshot, "QLD").changePct)} | ${formatPctValue(row(snapshot, "QLD").vs20Pct)} | ${formatPctValue(row(snapshot, "QLD").vs50Pct)} |`,
    `| **SMH** | \`${formatPrice(row(snapshot, "SMH").last)}\` | ${formatPctValue(row(snapshot, "SMH").changePct)} | ${formatPctValue(row(snapshot, "SMH").vs20Pct)} | ${formatPctValue(row(snapshot, "SMH").vs50Pct)} |`,
    `| **SOXX** | \`${formatPrice(row(snapshot, "SOXX").last)}\` | ${formatPctValue(row(snapshot, "SOXX").changePct)} | ${formatPctValue(row(snapshot, "SOXX").vs20Pct)} | ${formatPctValue(row(snapshot, "SOXX").vs50Pct)} |`,
    `| **INTC** | \`${formatPrice(row(snapshot, "INTC").last)}\` | ${formatPctValue(row(snapshot, "INTC").changePct)} | ${formatPctValue(row(snapshot, "INTC").vs20Pct)} | ${formatPctValue(row(snapshot, "INTC").vs50Pct)} |`,
    `| **IBIT** | \`${formatPrice(row(snapshot, "IBIT").last)}\` | ${formatPctValue(row(snapshot, "IBIT").changePct)} | ${formatPctValue(row(snapshot, "IBIT").vs20Pct)} | ${formatPctValue(row(snapshot, "IBIT").vs50Pct)} |`,
    `| **MSTR** | \`${formatPrice(row(snapshot, "MSTR").last)}\` | ${formatPctValue(row(snapshot, "MSTR").changePct)} | ${formatPctValue(row(snapshot, "MSTR").vs20Pct)} | ${formatPctValue(row(snapshot, "MSTR").vs50Pct)} |`,
  ].join("\n");
}

function aiAppendix(aiText) {
  return String(aiText || "").replace(/^## AI 市场风向解读\s*/i, "").trim();
}

function buildDailyMarkdownLite(meta, snapshot, classification, targets, retrievedAtLabel, aiText, jin10Items = [], jin10Source = "") {
  const phaseLabel = meta.marketPhaseLabel || "美股最新阶段";
  const titleMeta = [retrievedAtLabel ? `数据补取至${retrievedAtLabel}` : "", phaseLabel].filter(Boolean).join("；");
  const headline = headlineFor(meta.kind, classification);
  const finalCommand = finalCommandFor(meta.kind, classification);
  const dataPreamble = `> **数据口径：** 以美股前一交易日收盘后到现在为止的最近24小时信息为主；如果美股盘中，优先使用最新盘中行情；如果未开盘，则使用盘前或盘后数据。金十财经快讯同步纳入。`;
  const dataWarning = buildDataWarningBlock(snapshot);
  const newsSection = jin10Items.length
    ? `## 8）最近24小时重大新闻\n\n${jin10Items.slice(0, 6).map(item => `- ${item}`).join("\n")}\n`
    : "";
  const aiBlock = aiAppendix(aiText) || "本次 AI 解读暂不可用，以下保留规则版框架。";
  const targetMap = Object.fromEntries(targets.map(item => [item.symbol, item]));

  return {
    headline,
    finalCommand,
    markdown: `# ${meta.title}
**${displayDate(meta.date)}｜${phaseLabel}（${titleMeta}）**

${dataPreamble}

${dataWarning}

## 1）AI 市场风向解读

${aiBlock}

## 2）本期市场在交易什么？

**一句话结论：${headline}**

| 项目 | 判断 |
|:---|:---|
${overviewRows(classification)}

## 3）资金流向异动｜今日最重要变化

| 异动 | 变化 | 指标 | 信号解读 |
|:---|:---|:---|:---|
${flowRows(snapshot, classification, meta.kind)}

## 4）策略矩阵

| 资产 | 买CALL | 卖PUT | 核心逻辑 |
|:---|:---:|:---:|:---|
${strategyRows(snapshot, classification)}

> **整体策略**：\`${finalCommand}\`

## 5）资金流向与资产联动

### A. 跨资产资金流向

| 方向 | 7日/当前趋势 | 观测指标 | 信号解读 |
|:---|:---|:---|:---|
| 科技主线 → 纳指 / 半导体 | ${classification.windLight} | QQQ / SMH / SOXX | 当前主线是继续扩散，还是只剩局部强势。 |
| 利率与美元 → 高 beta 压力 | ${formatPctValue(row(snapshot, "^TNX").changePct)} / ${formatPctValue(row(snapshot, "DX-Y.NYB").changePct)} | 10Y / DXY | 决定 QLD、EEM 与高 beta 的容错率。 |
| 风险资产 → 加密链 | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} / ${formatPctValue(row(snapshot, "MSTR").changePct)} | BTC / MSTR / IBIT | 判断加密链是在确认主线，还是继续拖后腿。 |
| 大盘成长 → 小盘 | ${formatPctValue(row(snapshot, "IWM").changePct)} | IWM vs QQQ/SPY | 小盘是否一起配合，决定 risk-on 是否扩散。 |

### B. 关键联动

| 观测 | 最新信号 | 解读 |
|:---|:---|:---|
| **VIX / 10Y / DXY** | ${formatPctValue(row(snapshot, "^VIX").changePct)} / ${formatPctValue(row(snapshot, "^TNX").changePct)} / ${formatPctValue(row(snapshot, "DX-Y.NYB").changePct)} | 流动性与波动率是否真正放松。 |
| **QQQ / SMH / SOXX** | ${formatPctValue(row(snapshot, "QQQ").changePct)} / ${formatPctValue(row(snapshot, "SMH").changePct)} / ${formatPctValue(row(snapshot, "SOXX").changePct)} | 科技和半导体是否继续领跑。 |
| **BTC / MSTR** | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} / ${formatPctValue(row(snapshot, "MSTR").changePct)} | 加密链是否还在拖累风险偏好。 |
| **QLD / EEM / INTC / HOOD** | ${formatPctValue(row(snapshot, "QLD").changePct)} / ${formatPctValue(row(snapshot, "EEM").changePct)} / ${formatPctValue(row(snapshot, "INTC").changePct)} / ${formatPctValue(row(snapshot, "HOOD").changePct)} | 卖 Put 候选是否真的可交易。 |

### C. 谁在说真话？

- **今晚/本期真正说真话的是：${classification.truthTeller}**
- **我的判断：** ${classification.trueTheme}

## 6）宏观资产数据

| 资产 | 当前 | 日变化 | 解读 |
|:---|:---|:---|:---|
${macroRows(snapshot)}

## 7）风险资产表现

| 资产 | 当前/收盘 | 日变化 | 20日变化 | 50日变化 |
|:---|---:|---:|---:|---:|
${riskRows(snapshot, "daily")}

## 8）驱动拆解

\`\`\`text
${classification.marketStage}
    ↓
${classification.capitalFlow}
    ↓
${classification.trueTheme}
    ↓
${finalCommand}
\`\`\`

${newsSection}

<details>
  <summary>卖 Put 策略附录（个人执行用）</summary>

### 对 QLD

- **当前判断：** ${targetMap.QLD?.action || "继续观察"}
- **失效条件：** ${targetMap.QLD?.invalid || "-"}

### 对 MSTR

- **当前判断：** ${targetMap.MSTR?.action || "继续观察"}
- **失效条件：** ${targetMap.MSTR?.invalid || "-"}

### 对 INTC

- **当前判断：** ${targetMap.INTC?.action || "继续观察"}
- **失效条件：** ${targetMap.INTC?.invalid || "-"}

**一句话交易建议：** ${finalCommand}

</details>

## 11）市场日志

| 日期 | 核心变量 | 风险评分 | 执行等级 |
|:---|:---|:---|:---|
| ${displayDate(meta.date)} | ${classification.marketStage} | ${classification.riskScore} | ${classification.executionLevel} |

## 数据来源

- 美股 ETF / 个股：Nasdaq 公共接口
- 波动率 / 利率：FRED 官方公开数据
- 金十财经：${jin10Source || "search.jin10.com"} 最近 24 小时快讯
- 菜单6最小数据集：${meta.basis}
- AI 提示词：DeepSeek / GPT 可选

${dataSourceDetailsBlock(snapshot, jin10Source || "search.jin10.com")}

> 本报告用于交易研究与风险控制记录，不构成自动下单指令。`
  };
}

function buildDailyMarkdown(meta, snapshot, classification, targets, retrievedAtLabel, aiText) {
  return buildDailyMarkdownLite(meta, snapshot, classification, targets, retrievedAtLabel, aiText);
}

function buildWeeklyMarkdown(meta, snapshot, classification, targets, aiText) {
  const headline = headlineFor(meta.kind, classification);
  const finalCommand = finalCommandFor(meta.kind, classification);
  const overview = overviewRows(classification);
  const aiBlock = aiAppendix(aiText) || "本次 AI 解读暂不可用，以下保留规则版框架。";
  const dataWarning = buildDataWarningBlock(snapshot);

  return {
    headline,
    finalCommand,
    markdown: `# ${meta.title}
**${displayDate(meta.date)}｜${weekday(meta.date)}复盘（基于周五收盘、周末新闻与跨资产数据）**

${dataWarning}

**一句话结论：${headline}**

| 项目 | 判断 |
|:---|:---|
${overview}

## 一、资金流向与资产联动

### A. 跨资产资金流向

| 方向 | 本周状态 | 观测指标 | 解读 |
|:---|:---|:---|:---|
| AI 芯片 → 流出/再平衡 | ${classification.executionLevel === "D" ? "急剧恶化" : classification.executionLevel === "B" ? "震荡" : "局部承接"} | SOX、NVDA、MU、AMD、AVGO | 资金是否从最拥挤方向撤退。 |
| 高 beta 成长 → 防守 | ${classification.executionLevel === "D" ? "明显" : "部分发生"} | Nasdaq / Dow / 必需消费 | 市场是否开始降低风险预算。 |
| 债券 → 再定价 | ${formatPctValue(row(snapshot, "^TNX").changePct)} | 2Y、10Y 收益率 | 利率是否重新压住估值。 |
| BTC / 加密链 → 承压 | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} | BTC、MSTR、IBIT | 加密链是否成为风险放大器。 |
| 日元 carry → 风险升温 | ${formatPctValue(row(snapshot, "JPY=X").changePct)} | USDJPY、JGB | 若日元快速升值，高 beta 可能继续去杠杆。 |

### B. 关键联动

| 观测对 | 当前关系 | 变化 | 下周含义 |
|:---|:---|:---|:---|
| **半导体 / QQQ** | ${classification.marketStage} | ${classification.windLight} | QLD 不能按普通回踩处理。 |
| **10Y / QLD** | ${formatPrice(row(snapshot, "^TNX").last)} | ${formatPctValue(row(snapshot, "^TNX").changePct)} | 10Y 没回落前，不提高仓位。 |
| **BTC / MSTR** | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} vs ${formatPctValue(row(snapshot, "MSTR").changePct)} | ${classification.eventRisk} | MSTR 继续禁卖或仅观察。 |
| **USDJPY / 高 beta** | ${formatPrice(row(snapshot, "JPY=X").last)} | ${formatPctValue(row(snapshot, "JPY=X").changePct)} | carry 风险升温时暂停高 beta 卖 put。 |
| **SMH / SOXX vs INTC** | ${formatPctValue(row(snapshot, "INTC").changePct)} | 个股高波动 | INTC 不能机械跟随半导体指数卖 put。 |

### C. 谁在说真话

**本周真正说真话的是：SOX、2Y、10Y、BTC 和 USDJPY。**  
**我的判断：** 下周不是抄底竞赛，而是确认是否出现承接；先守住本金，再谈收权利金。

## 二、宏观资产数据

| 资产 | 最新状态 | 本周变化 | 解读 |
|:---|:---|:---|:---|
${macroRows(snapshot)}

## 三、风险资产表现

| 资产 | 本周表现 / 最新信号 | 结构判断 | 卖put含义 |
|:---|:---|:---|:---|
${riskRows(snapshot, "weekly")}

## 四、AI 交易拥挤度与接力真空观察

| 观察项 | 本周状态 | 下周含义 |
|:---|:---|:---|
| **AI / 半导体拥挤度** | ${classification.executionLevel === "D" ? "明显释放" : "仍在高位"} | 不急着抄底。 |
| **SOX 整体动量** | ${classification.windLight} | 是否仍有压力测试。 |
| **软件接力能力** | ${classification.executionLevel === "D" ? "不足" : "未确认"} | 硬件回撤后有没有板块接棒。 |
| **接力真空** | ${classification.executionLevel === "D" ? "风险上升" : "仍需观察"} | 当前最大风险是资金没有新去处。 |

## 五、AI 宏观工作流检查

| 环节 | 当前状态 | 下周操作含义 |
|:---|:---|:---|
| 宏观变量 | ${classification.marketStage} | 高 beta 是否降级。 |
| 市场结构 | ${classification.windLight} | 进攻还是防守。 |
| AI 拥挤度 | ${classification.executionLevel === "D" ? "明显释放但未完成" : "等待确认"} | 不急着抄底。 |
| 标的状态 | QLD / MSTR / INTC | 三个标的都不适合贴价卖 put。 |
| 期权卖方环境 | ${classification.putEnvironment} | premium 变肥不等于安全垫变厚。 |
| 仓位动作 | ${classification.executionLevel === "D" ? "等承接、低 Delta、小仓" : "低 Delta、小仓"} | 保留现金，等待二次确认。 |

## 六、驱动拆解

    ${classification.marketStage}
        ↓
    ${classification.capitalFlow}
        ↓
    ${classification.windLight} / ${classification.executionLevel}
        ↓
    QLD / MSTR / INTC 的卖 Put 约束同步变化

## 七、本周真正发生的结构性变化

1. **风险有没有从事件压制切回分化修复。**
2. **半导体链是否仍然是主线。**
3. **加密链是否继续拖后腿。**
4. **INTC 是否只是高波动，而不是低风险收租。**

## 八、下周关键观察点

| 关注点 | 重要性 | 影响 |
|:---|:---|:---|
| QQQ / QLD 是否重新站回 20 日线 | 🔴 高 | 决定 QLD 能否从观察转为执行候选。 |
| SMH / SOXX 是否继续强于 QQQ | 🔴 高 | 决定半导体主线是否仍可支撑风险偏好。 |
| VIX 是否回落到 20 日线下方 | 🔴 高 | 决定卖 Put 是否能提高一点 Delta。 |
| BTC 是否站稳，MSTR 是否停止相对走弱 | 🔴 高 | 这是 MSTR 从禁卖转观察的前提。 |
| INTC 是否守住关键区间 | 🔴 高 | 低于预期区间则暂停 INTC 卖 Put。 |
| DXY 是否继续上行 | 🟡 中 | 若美元继续强，EEM 与高 beta 都降级。 |

## 九、落到卖 put 策略

### 对 QLD

- **当前判断：** ${classification.executionLevel === "D" ? "暂停主动加仓 / 只允许极远 OTM 观察单。" : "只保留极远 OTM 小仓候选。"}
- **原因：** ${classification.executionLevel === "D" ? "芯片和风险偏好都没有给出足够确认。" : "有修复，但仍需要结构确认。"}
- **执行方式：** 等开盘后或下周开盘后确认，不在快速下杀中卖。

### 对 MSTR

- **当前判断：** 继续禁卖 / 0 交易。
- **原因：** BTC 未确认前，MSTR 的高 IV 主要是尾部风险，不是机会。

### 对 INTC

- **当前判断：** 只观察；不因 IV 极高开新仓。
- **原因：** INTC 是高波动个股，不是普通半导体 beta。

### 下周动作建议

- [ ] 直接卖 7 天内 Put
- [ ] 贴价卖 Put
- [ ] 因为 IV 高就开仓
- [x] 只允许小仓、远 OTM
- [x] 等收盘/盘后确认
- [x] QLD 先看结构
- [x] MSTR 暂停
- [x] INTC 只观察 / 极远 OTM

**一句话交易建议：${finalCommand}**

## 十、AI 市场风向解读

${aiBlock}

## 数据来源

- 周报所用的公开跨资产快照
- 美股 ETF / 个股：Nasdaq 公共接口
- 波动率 / 利率：FRED 官方公开数据
- AI 提示词：DeepSeek / GPT 可选

${dataSourceDetailsBlock(snapshot, "周报未单独补取金十快讯")}

> 本报告用于交易研究与风险控制记录，不构成自动下单指令.`
  };
}

function buildRuleMarkdown(meta, snapshot, classification, targets, aiText, retrievedAtLabel, jin10) {
  return meta.kind === "weekly"
    ? buildWeeklyMarkdown(meta, snapshot, classification, targets, aiText)
    : buildDailyMarkdown(meta, snapshot, classification, targets, retrievedAtLabel, aiText, jin10?.items || [], jin10?.source || "");
}

function marketPrompt() {
  return `你是熟悉美股、宏观、跨资产联动和期权卖方策略的市场分析助手。
任务：基于菜单6市场最小数据集、金十财经最近24小时快讯和最新美股行情，输出一段可嵌入Markdown报告的中文分析，风格要接近“市场结构日报 / 周报”。
要求：
1. 只分析市场风向，不给具体 strike，不抓取或假设期权链。
2. 先回答“市场在交易什么”，先给结论，再展开。
3. 强调资金流向异动、跨资产联动、谁在说真话，以及这对 QLD / MSTR / INTC 卖 put 的影响。
4. 如果美股盘中，优先解释最新盘中行情；如果盘前或盘后，优先对应时段数据；如果休市，说明当前阶段和下一交易窗口。
5. 不写空话，不写泛泛新闻摘要，不把长期看好当短线卖 put 理由。
6. 返回Markdown片段，以“## AI 市场风向解读”开头。`;
}

async function callOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) return { used: false, provider: "GPT", text: "## AI 市场风向解读\n\n未配置 OPENAI_API_KEY，本次使用规则版报告。" };
  const res = await timedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [{ role: "system", content: marketPrompt() }, { role: "user", content: JSON.stringify(payload) }],
    }),
  }, 15000);
  if (!res.ok) return { used: false, provider: "GPT", text: `## AI 市场风向解读\n\nGPT 调用失败：${res.status}。本次使用规则版报告。` };
  const data = await res.json();
  const text = data.output_text || (data.output || []).flatMap(item => item.content || []).map(c => c.text || "").join("");
  return { used: true, provider: "GPT", text: text || "## AI 市场风向解读\n\nGPT 返回为空，本次使用规则版报告。" };
}

async function callDeepSeek(payload) {
  if (!process.env.DEEPSEEK_API_KEY) return { used: false, provider: "DeepSeek", text: "## AI 市场风向解读\n\n未配置 DEEPSEEK_API_KEY，本次使用规则版报告。" };
  const res = await timedFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [{ role: "system", content: marketPrompt() }, { role: "user", content: JSON.stringify(payload) }],
      temperature: 0.2,
    }),
  }, 15000);
  if (!res.ok) return { used: false, provider: "DeepSeek", text: `## AI 市场风向解读\n\nDeepSeek 调用失败：${res.status}。本次使用规则版报告。` };
  const data = await res.json();
  return { used: true, provider: "DeepSeek", text: data.choices?.[0]?.message?.content || "## AI 市场风向解读\n\nDeepSeek 返回为空，本次使用规则版报告。" };
}

function callAI(payload, provider) {
  return String(provider || "deepseek").toLowerCase() === "openai" ? callOpenAI(payload) : callDeepSeek(payload);
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  try {
    const kind = normalizeReportKind(req.query.kind);
    const provider = String(req.query.provider || "deepseek").toLowerCase() === "openai" ? "openai" : "deepseek";
    const forceRefresh = ["1", "true", "yes"].includes(String(req.query.forceRefresh || "").toLowerCase());
    const meta = kindMeta(kind);
    const snapshot = await fetchMarketSnapshot(forceRefresh);
    const jin10 = { source: "", items: [] };
    const classification = classify(snapshot);
    const targets = targetRows(snapshot, classification);
    const ai = await callAI({ meta, snapshot, classification, targets, jin10 }, provider).catch(error => ({
      used: false,
      provider: provider === "openai" ? "GPT" : "DeepSeek",
      text: `## AI 市场风向解读\n\nAI 分析暂时不可用：${error.message || error}。本次使用规则版报告。`,
    }));
    const built = buildRuleMarkdown(meta, snapshot, classification, targets, ai.text, new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false }), jin10);
    const report = {
      id: `${meta.fileName}-${Date.now()}`,
      ...meta,
      ...classification,
      headline: built.headline,
      finalCommand: built.finalCommand,
      targets,
      aiProvider: ai.provider,
      usedAi: ai.used,
      retrievedAt: new Date().toISOString(),
      retrievedAtLabel: new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false }),
      markdown: built.markdown,
    };
    report.archiveRow = archiveRow(report);
    return sendJson(res, 200, { ok: true, report });
  } catch (error) {
    const message = error.message || String(error);
    return sendJson(res, 500, { ok: false, message });
  }
}
