const MARKET_SYMBOLS = [
  "QQQ", "SPY", "IWM", "QLD", "TQQQ", "SMH", "SOXX", "MAGS",
  "EEM", "FXI", "KWEB", "^VIX", "VIXY", "IBIT", "BTC-USD", "MSTR",
  "DX-Y.NYB", "^TNX", "^2YR", "JPY=X", "CNY=X", "CL=F", "GC=F", "INTC", "HOOD",
];

const REQUIRED_TARGETS = ["QLD", "EEM", "MSTR", "INTC", "HOOD"];
const CRITICAL_SYMBOLS = [
  "QQQ", "SPY", "IWM", "SMH", "SOXX", "BTC-USD", "^VIX",
  "^TNX", "DX-Y.NYB", "MSTR", "INTC", "HOOD",
];
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
  "^2YR": "2Y",
  "JPY=X": "USDJPY",
  "CNY=X": "USDCNY",
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
  "^2YR": "DGS2",
  "DX-Y.NYB": "DTWEXBGS",
};
const STOCKPRICE_SNAPSHOT_URL = "https://raw.githubusercontent.com/jiangshenhk/donew/main/stockprice/data/latest-price.json";
const STOCKPRICE_SNAPSHOT_CACHE_TTL_MS = 10 * 60 * 1000;
const STRATEGY_BASELINE_URL = "https://raw.githubusercontent.com/jiangshenhk/donew/main/docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md";
const STRATEGY_BASELINE_CACHE_TTL_MS = 60 * 60 * 1000;
let strategyBaselineCache = { text: "", fetchedAt: 0 };

async function fetchStrategyBaseline(forceRefresh = false) {
  if (!forceRefresh && strategyBaselineCache.text && Date.now() - strategyBaselineCache.fetchedAt < STRATEGY_BASELINE_CACHE_TTL_MS) {
    return strategyBaselineCache.text;
  }
  const res = await timedFetch(STRATEGY_BASELINE_URL, {}, 8000);
  if (!res.ok) throw new Error(`Strategy baseline HTTP ${res.status}`);
  const text = await res.text();
  if (!text || text.length < 100) throw new Error("Strategy baseline too short or empty");
  strategyBaselineCache = { text, fetchedAt: Date.now() };
  return text;
}

const MARKET_SYMBOL_FETCH_DELAY_MIN_MS = 200;
const MARKET_SYMBOL_FETCH_DELAY_MAX_MS = 1000;
const MARKET_CACHE_TTL_MS = 10 * 60 * 1000;
const marketDataCache = new Map();
let stockpriceSnapshotCache = null;

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

function normalizeStockpriceRow(item, snapshotMeta, fetchMode) {
  const last = numberOrNull(item?.price);
  const previousClose = numberOrNull(item?.previousClose);
  const changePct = numberOrNull(item?.changePercent);
  return {
    symbol: item?.symbol,
    last,
    changePct: changePct ?? (last !== null && previousClose ? (last / previousClose - 1) * 100 : null),
    vs20Pct: null,
    vs50Pct: null,
    marketState: item?.exchange || "STOCKPRICE",
    retrievedAt: snapshotMeta?.checkedAt || snapshotMeta?.updatedAt || new Date().toISOString(),
    marketDataAt: item?.marketTime || "",
    error: "",
    source: "stockprice",
    fetchMode,
    cacheStoredAt: snapshotMeta?.checkedAt || snapshotMeta?.updatedAt || new Date().toISOString(),
    stockpriceUpdatedAt: snapshotMeta?.updatedAt || "",
    stockpriceCheckedAt: snapshotMeta?.checkedAt || "",
    previousClose,
    currency: item?.currency || "",
    exchange: item?.exchange || "",
  };
}

async function loadStockpriceSnapshot(forceRefresh = false) {
  if (!forceRefresh && stockpriceSnapshotCache && Date.now() - stockpriceSnapshotCache.cachedAt < STOCKPRICE_SNAPSHOT_CACHE_TTL_MS) {
    return {
      ...cloneRow(stockpriceSnapshotCache.payload),
      fetchMode: "cache",
      cacheServedAt: new Date().toISOString(),
    };
  }
  const res = await timedFetch(STOCKPRICE_SNAPSHOT_URL, {
    headers: browserHeaders("https://raw.githubusercontent.com/"),
  }, 8000);
  if (!res.ok) throw new Error(`stockprice HTTP ${res.status}`);
  const payload = await res.json();
  if (!payload || !Array.isArray(payload.data)) throw new Error("stockprice snapshot invalid");
  stockpriceSnapshotCache = {
    cachedAt: Date.now(),
    payload: cloneRow(payload),
  };
  return {
    ...cloneRow(payload),
    fetchMode: "live",
    cacheServedAt: new Date().toISOString(),
  };
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
  const res = await timedFetch(url, { headers: browserHeaders("https://fred.stlouisfed.org/") }, 3500);
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
  const res = await timedFetch(url, { headers: browserHeaders("https://www.binance.com/") }, 3000);
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
  const res = await timedFetch(url, { headers: browserHeaders("https://www.binance.com/") }, 3000);
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

async function fetchYahooChartSnapshot(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&events=history&includePrePost=false`;
  const res = await timedFetch(url, { headers: browserHeaders("https://finance.yahoo.com/") }, 3500);
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const payload = await res.json();
  const result = payload?.chart?.result?.[0];
  if (!result) {
    const detail = payload?.chart?.error?.description || payload?.chart?.error?.code || "";
    throw new Error(detail || "Yahoo no chart result");
  }
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const closes = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = quote.close?.[i];
    if (close === null || close === undefined || Number.isNaN(Number(close))) continue;
    closes.push(Number(close));
  }
  if (closes.length < 5) throw new Error("Yahoo insufficient closes");
  const last = numberOrNull(meta.regularMarketPrice) ?? closes.at(-1);
  const prev = closes.at(-2) || closes.at(-1);
  const sma20 = avg(closes.slice(-20));
  const sma50 = avg(closes.slice(-50));
  return {
    symbol,
    last,
    changePct: prev ? (last / prev - 1) * 100 : null,
    vs20Pct: sma20 ? (last / sma20 - 1) * 100 : null,
    vs50Pct: sma50 ? (last / sma50 - 1) * 100 : null,
    marketState: meta.marketState || "YAHOO",
    retrievedAt: new Date().toISOString(),
    marketDataAt: Number.isFinite(Number(meta.regularMarketTime))
      ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
      : Number.isFinite(Number(timestamps.at(-1)))
        ? new Date(Number(timestamps.at(-1)) * 1000).toISOString()
        : "",
    error: "",
    source: "yahoo",
  };
}

async function fetchNasdaqInfo(symbol, assetClass) {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=${encodeURIComponent(assetClass)}`;
  const res = await timedFetch(url, {
    headers: {
      ...browserHeaders("https://www.nasdaq.com/"),
      "Origin": "https://www.nasdaq.com",
    },
  }, 2800);
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
  }, 2800);
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
  const snapshot = await loadStockpriceSnapshot(forceRefresh);
  const rowMap = Object.fromEntries(
    (snapshot.data || [])
      .filter(item => item?.symbol)
      .map(item => [item.symbol, normalizeStockpriceRow(item, snapshot, snapshot.fetchMode)])
  );
  const rows = {};
  for (const symbol of MARKET_SYMBOLS) {
    rows[symbol] = rowMap[symbol] || {
      symbol,
      last: null,
      changePct: null,
      vs20Pct: null,
      vs50Pct: null,
      retrievedAt: snapshot.cacheServedAt || snapshot.checkedAt || snapshot.updatedAt || new Date().toISOString(),
      marketDataAt: "",
      error: "stockprice missing",
      source: "stockprice",
      fetchMode: snapshot.fetchMode || "live",
      cacheStoredAt: snapshot.cacheServedAt || snapshot.checkedAt || snapshot.updatedAt || new Date().toISOString(),
      stockpriceUpdatedAt: snapshot.updatedAt || "",
      stockpriceCheckedAt: snapshot.checkedAt || "",
    };
  }
  rows.__meta = {
    source: "stockprice",
    updatedAt: snapshot.updatedAt || "",
    checkedAt: snapshot.checkedAt || "",
    fetchMode: snapshot.fetchMode || "live",
    cacheServedAt: snapshot.cacheServedAt || "",
    successCount: snapshot.successCount ?? rows.__meta?.successCount ?? 0,
    failCount: snapshot.failCount ?? rows.__meta?.failCount ?? 0,
  };
  return rows;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomFetchDelayMs() {
  return Math.round(
    MARKET_SYMBOL_FETCH_DELAY_MIN_MS +
    Math.random() * (MARKET_SYMBOL_FETCH_DELAY_MAX_MS - MARKET_SYMBOL_FETCH_DELAY_MIN_MS)
  );
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
  const res = await timedFetch(url, { headers: browserHeaders("https://quote.eastmoney.com/") }, 3000);
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
  if (source === "stockprice") return "StockPrice Center";
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
  if (/stockprice missing/i.test(text)) return "统一行情中心未取到";
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
  const meta = snapshot.__meta || {};
  const focusSymbols = ["QQQ", "SPY", "IWM", "SMH", "SOXX", "BTC-USD", "^VIX", "^TNX", "DX-Y.NYB", "MSTR", "INTC", "HOOD"];
  const rowsHtml = focusSymbols.map(symbol => {
    const item = row(snapshot, symbol);
    const status = hasUsableSnapshot(item) ? "正常" : "缺失";
    return `<tr><td>${symbolLabel(symbol)}</td><td>${formatSourceLabel(item.source)}</td><td>${item.fetchMode === "cache" ? "缓存" : "实时"}</td><td>${formatRetrievedAt(item.cacheStoredAt || item.retrievedAt)}</td><td>${formatRetrievedAt(item.marketDataAt)}</td><td>${status}</td><td>${formatSourceNote(item.error)}</td></tr>`;
  }).join("");
  return `
<details>
  <summary>本文所使用的价格数据来源 + 时间</summary>
  <p>行情中心文件更新时间：${formatRetrievedAt(meta.updatedAt)}；本次读取时间：${formatRetrievedAt(meta.checkedAt || meta.cacheServedAt)}；读取模式：${meta.fetchMode === "cache" ? "缓存" : "实时读取"}；成功 ${meta.successCount ?? "?"} / 失败 ${meta.failCount ?? "?"}。</p>
  <p>新闻补充源：${extraSourceLabel || "暂未启用"}。</p>
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
  const snapshot = await loadStockpriceSnapshot(forceRefresh);
  const item = (snapshot.data || []).find(entry => cacheKeyFor(entry?.symbol) === cacheKeyFor(symbol));
  if (!item) {
    return {
      symbol,
      last: null,
      changePct: null,
      vs20Pct: null,
      vs50Pct: null,
      retrievedAt: snapshot.cacheServedAt || snapshot.checkedAt || snapshot.updatedAt || new Date().toISOString(),
      error: "stockprice missing",
      source: "stockprice",
      fetchMode: snapshot.fetchMode || "live",
      cacheStoredAt: snapshot.cacheServedAt || snapshot.checkedAt || snapshot.updatedAt || new Date().toISOString(),
      stockpriceUpdatedAt: snapshot.updatedAt || "",
      stockpriceCheckedAt: snapshot.checkedAt || "",
    };
  }
  return storeMarketRow(normalizeStockpriceRow(item, snapshot, snapshot.fetchMode));
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
  if ((qqq.changePct || 0) < 0 || (spy.changePct || 0) < 0) risk += 0.8;
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

function buildMarketDataInput(meta, snapshot, classification, targets, jin10Items = [], focusSymbols = ["QLD", "MSTR", "INTC"]) {
  const now = new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false });
  const focusData = focusSymbols.map(s => {
    const item = row(snapshot, s);
    return `- ${symbolLabel(s)}：最新价 ${formatPrice(item.last)}，日变化 ${formatPctValue(item.changePct)}，相对20日线 ${formatPctValue(item.vs20Pct)}，相对50日线 ${formatPctValue(item.vs50Pct)}`;
  }).join("\n");
  return `## 本次重点分析标的
${focusSymbols.map(s => `- ${symbolLabel(s)}`).join("、")}

请在第 9 节重点分析以上标的的卖 Put 可行性，给出明确的当前判断（可卖 / 谨慎卖 / 暂不卖）和原因。

### 重点标的行情数据
${focusData}

## 当前时间与报告参数
- 生成时间：${now}
- 报告类型：${meta.kind === "weekly" ? "周报" : meta.sessionLabel || "日报"}
- 市场阶段：${meta.marketPhaseLabel || "美股最新阶段"}

## 行情快照表
| 标的 | 最新价 | 日变化 | 相对20日线 | 相对50日线 |
|:---|---:|---:|---:|---:|
${MARKET_SYMBOLS.map(symbol => {
  const item = row(snapshot, symbol);
  return `| ${symbolLabel(symbol)} | ${item.last === null ? "-" : item.last?.toFixed?.(2)} | ${formatPctValue(item.changePct)} | ${formatPctValue(item.vs20Pct)} | ${formatPctValue(item.vs50Pct)} |`;
}).join("\n")}

## 风险评分与执行等级
- 风险评分：${classification.riskScore} / 10
- 风向灯号：${classification.windLight}
- 执行等级：${classification.executionLevel}
- 卖Put环境：${classification.putEnvironment}

## 卖Put候选标的
${targets.map(t => `- ${t.symbol}：动作=${t.action}，Delta=${t.delta}，DTE=${t.dte}，安全垫=${t.cushion}，仓位=${t.size}`).join("\n")}

## 最近新闻
${jin10Items.slice(0, 10).map(item => `- ${item}`.trim()).join("\n") || "暂无"}

请严格按照策略框架中的固定输出结构，生成完整的市场结构日报/周报。`;
}

async function callOpenAI(systemPrompt, userInput) {
  if (!process.env.OPENAI_API_KEY) return { used: false, provider: "GPT", text: "" };
  const res = await timedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [{ role: "system", content: systemPrompt }, { role: "user", content: userInput }],
    }),
  }, 15000);
  if (!res.ok) return { used: false, provider: "GPT", text: "" };
  const data = await res.json();
  const text = data.output_text || (data.output || []).flatMap(item => item.content || []).map(c => c.text || "").join("");
  return { used: true, provider: "GPT", text: text || "" };
}

async function callDeepSeek(systemPrompt, userInput) {
  if (!process.env.DEEPSEEK_API_KEY) return { used: false, provider: "DeepSeek", text: "" };
  const res = await timedFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userInput }],
      temperature: 0.2,
    }),
  }, 15000);
  if (!res.ok) return { used: false, provider: "DeepSeek", text: "" };
  const data = await res.json();
  return { used: true, provider: "DeepSeek", text: data.choices?.[0]?.message?.content || "" };
}

async function callAI(systemPrompt, userInput, provider) {
  return String(provider || "deepseek").toLowerCase() === "openai"
    ? callOpenAI(systemPrompt, userInput)
    : callDeepSeek(systemPrompt, userInput);
}

async function legacyHandler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  try {
    const kind = normalizeReportKind(req.query.kind);
    const provider = String(req.query.provider || "deepseek").toLowerCase() === "openai" ? "openai" : "deepseek";
    const forceRefresh = ["1", "true", "yes"].includes(String(req.query.forceRefresh || "").toLowerCase());
    const focusRaw = String(req.query.focus || "QLD,MSTR,INTC").toUpperCase();
    const focusSymbols = focusRaw.split(",").map(s => s.trim()).filter(Boolean);
    const meta = kindMeta(kind);
    const snapshot = await fetchMarketSnapshot(forceRefresh);
    const jin10 = await fetchJin10News();
    const classification = classify(snapshot);
    const targets = targetRows(snapshot, classification);
    const strategyBaseline = await fetchStrategyBaseline();
    const userInput = buildMarketDataInput(meta, snapshot, classification, targets, jin10.items, focusSymbols);
    const ai = await callAI(strategyBaseline, userInput, provider).catch(error => ({
      used: false,
      provider: provider === "openai" ? "GPT" : "DeepSeek",
      text: "",
    }));
    const markdown = ai.text || `# ${meta.title}\n\nAI 报告生成失败，请稍后重试。`;
    const report = {
      id: `${meta.fileName}-${Date.now()}`,
      ...meta,
      ...classification,
      headline: meta.title,
      finalCommand: "按策略规则执行",
      targets,
      focus: focusSymbols,
      aiProvider: ai.provider,
      usedAi: ai.used,
      retrievedAt: new Date().toISOString(),
      retrievedAtLabel: new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false }),
      markdown,
    };
    report.archiveRow = archiveRow(report);
    return sendJson(res, 200, { ok: true, report });
  } catch (error) {
    const message = error.message || String(error);
    return sendJson(res, 500, { ok: false, message });
  }
}

export default async function handler(req, res) {
  await legacyHandler(req, res);
}
