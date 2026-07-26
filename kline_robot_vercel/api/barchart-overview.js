const BARCHART_ORIGIN = 'https://www.barchart.com';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

const overviewCache = new Map();

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  };
}

function sendJson(res, status, data) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  return res.status(status).json(data);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function textContent(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function numberText(value) {
  const match = String(value || '').match(/[+-]?(?:\d[\d,]*)(?:\.\d+)?/);
  return match ? match[0].replace(/,/g, '') : '';
}

function matchValue(text, pattern, group = 1) {
  const match = String(text || '').match(pattern);
  return match?.[group] ? String(match[group]).replace(/,/g, '').trim() : '';
}

export function parseBarchartOverviewHtml(html) {
  const start = String(html || '').indexOf('Options Overview');
  if (start < 0) throw new Error('Barchart 页面未包含期权概览');

  const section = String(html).slice(start, start + 40000);
  const rows = [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => textContent(match[1]))
    .filter(Boolean);
  const find = (label) => rows.find((row) => row.startsWith(label)) || '';

  const impliedVolatility = find('Implied Volatility');
  const historicalVolatility = find('Historical Volatility');
  const ivPercentile = find('IV Percentile');
  const ivRank = find('IV Rank');
  const ivHigh = find('IV High');
  const ivLow = find('IV Low');
  const expectedMove = rows.find((row) => /^Expected Move \(DTE \d+\)/i.test(row)) || '';
  const expectedRange = find('Expected Range');

  const metrics = {
    iv: matchValue(impliedVolatility, /Implied Volatility\s+([0-9.]+)%/i),
    ivChange: matchValue(impliedVolatility, /\(\s*([+-]?[0-9.]+)%\s*\)/i),
    hv: matchValue(historicalVolatility, /Historical Volatility\s+([0-9.]+)%/i),
    ivPercentile: matchValue(ivPercentile, /IV Percentile\s+([0-9.]+)%/i),
    ivRank: matchValue(ivRank, /IV Rank\s+([0-9.]+)%/i),
    ivHigh: matchValue(ivHigh, /IV High\s+([0-9.]+)%/i),
    ivHighDate: matchValue(ivHigh, /\bon\s+([0-9/]+)/i),
    ivLow: matchValue(ivLow, /IV Low\s+([0-9.]+)%/i),
    ivLowDate: matchValue(ivLow, /\bon\s+([0-9/]+)/i),
    expectedMove: matchValue(expectedMove, /\)\s+([0-9.]+)\s+\(/i),
    expectedMovePct: matchValue(expectedMove, /\(\s*([0-9.]+)%\s*\)\s*$/i),
    expectedMoveDte: matchValue(expectedMove, /Expected Move \(DTE\s+(\d+)\)/i),
    expectedRangeLow: matchValue(expectedRange, /Expected Range\s+([0-9.]+)\s+to/i),
    expectedRangeHigh: matchValue(expectedRange, /\bto\s+([0-9.]+)\s*$/i),
    putCallVolRatio: numberText(find('Put/Call Vol Ratio').replace('Put/Call Vol Ratio', '')),
    putCallOiRatio: numberText(find('Put/Call OI Ratio').replace('Put/Call OI Ratio', '')),
    todayVolume: numberText(find("Today's Volume").replace("Today's Volume", '')),
    volumeAvg30: numberText(find('Volume Avg (30-Day)').replace('Volume Avg (30-Day)', '')),
    todayOpenInterest: numberText(find("Today's Open Interest").replace("Today's Open Interest", '')),
    openInterest30: numberText(find('Open Int (30-Day)').replace('Open Int (30-Day)', '')),
  };

  const populated = Object.values(metrics).filter((value) => String(value || '').trim()).length;
  if (populated < 10) throw new Error('Barchart 期权概览字段不完整');
  return metrics;
}

function normalizeSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('标的代码格式不正确');
  return symbol;
}

async function fetchOverview(symbol, forceRefresh = false) {
  const cached = !forceRefresh && overviewCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.payload, fetchMode: 'cache' };
  }

  const sourceUrl = `${BARCHART_ORIGIN}/stocks/quotes/${encodeURIComponent(symbol)}/overview`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; donew-sell-put-overview/1.0)',
      },
    });
    if (!response.ok) throw new Error(`Barchart 页面返回 HTTP ${response.status}`);
    const html = await response.text();
    const metrics = parseBarchartOverviewHtml(html);
    const payload = {
      ok: true,
      symbol,
      source: 'Barchart Options Overview',
      sourceUrl,
      delayed: true,
      delayNote: 'Barchart公开期权数据通常延迟约25至30分钟',
      retrievedAt: new Date().toISOString(),
      metrics,
    };
    overviewCache.set(symbol, { cachedAt: Date.now(), payload });
    return { ...payload, fetchMode: 'realtime' };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, message: 'Method not allowed' });

  try {
    const symbol = normalizeSymbol(req.query?.symbol);
    const forceRefresh = String(req.query?.force || '') === '1';
    return sendJson(res, 200, await fetchOverview(symbol, forceRefresh));
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'Barchart期权概览请求超时'
      : (error?.message || 'Barchart期权概览暂时不可用');
    return sendJson(res, 502, { ok: false, message });
  }
}
