const SYMBOLS = [
  "QQQ", "SPY", "IWM", "QLD", "TQQQ",
  "SMH", "SOXX", "MAGS",
  "EEM", "FXI", "KWEB",
  "^VIX", "VIXY",
  "IBIT", "BTC-USD", "MSTR",
  "DX-Y.NYB", "^TNX", "JPY=X",
  "CL=F", "GC=F",
  "INTC", "HOOD"
];

const CACHE_TTL = 3 * 60 * 1000;
let memoryCache = null;
let cacheTime = 0;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`);

  const json = await response.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`${symbol}: no data`);

  const meta = result.meta || {};
  const price = meta.regularMarketPrice ?? null;
  const previous = meta.chartPreviousClose ?? null;

  return {
    symbol,
    price,
    change: price !== null && previous !== null ? price - previous : null,
    changePercent: price !== null && previous ? ((price - previous) / previous) * 100 : null,
    currency: meta.currency || null,
    exchange: meta.exchangeName || null,
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
  };
}

async function buildCache() {
  const data = {};

  for (const symbol of SYMBOLS) {
    try {
      data[symbol] = await fetchQuote(symbol);
    } catch (e) {
      data[symbol] = { symbol, error: e.message };
    }

    await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
  }

  memoryCache = {
    cacheUpdatedAt: new Date().toISOString(),
    data
  };

  cacheTime = Date.now();
  return memoryCache;
}

export default async function handler(req, res) {
  try {
    if (memoryCache && Date.now() - cacheTime < CACHE_TTL) {
      return send(res, 200, memoryCache);
    }

    const result = await buildCache();
    return send(res, 200, result);
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
}
