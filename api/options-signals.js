const BARCHART_ORIGIN = 'https://www.barchart.com';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

const signalCache = new Map();

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

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/[,%+]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,\s]+=)/) : [];
}

async function createBarchartSession(pagePath, controller) {
  const pageUrl = `${BARCHART_ORIGIN}${pagePath}`;
  const response = await fetch(pageUrl, {
    signal: controller.signal,
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; donew-options-signals/1.0)',
    },
  });
  if (!response.ok) throw new Error(`Barchart 页面返回 HTTP ${response.status}`);
  await response.text();

  const cookies = getSetCookies(response.headers).map((value) => value.split(';', 1)[0]);
  const xsrfCookie = cookies.find((value) => value.startsWith('XSRF-TOKEN='));
  if (!cookies.length || !xsrfCookie) throw new Error('Barchart 免费会话未建立');
  const xsrfToken = decodeURIComponent(xsrfCookie.slice('XSRF-TOKEN='.length));
  return {
    pageUrl,
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': cookies.join('; '),
      'Referer': pageUrl,
      'User-Agent': 'Mozilla/5.0 (compatible; donew-options-signals/1.0)',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': xsrfToken,
    },
  };
}

function ivChangeUrl() {
  const url = new URL(`${BARCHART_ORIGIN}/proxies/core-api/v1/options/get`);
  const params = {
    fields: 'symbol,baseSymbol,baseLastPrice,expirationDate,daysToExpiration,baseSymbolType,symbolType,strikePrice,moneyness,bidPrice,askPrice,volume,volatilityPercentChange,volatility,vega,delta,tradeTime',
    orderBy: 'volatilityPercentChange',
    baseSymbolTypes: 'stock',
    'gt(volatility,0)': '',
    'between(vega,0.02,)': '',
    'between(daysToExpiration,1,)': '',
    'between(lastPrice,.10,)': '',
    'between(baseLastPrice,2.00,)': '',
    orderDir: 'desc',
    limit: '20',
    'between(openInterest,100,)': '',
    'in(exchange,(AMEX,NYSE,NASDAQ,INDEX-CBOE))': '',
    'gt(volatilityPercentChange,20)': '',
    'between(volume,100,)': '',
    meta: 'field.shortName,field.type',
    raw: '1',
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function unusualVolumeUrl() {
  const url = new URL(`${BARCHART_ORIGIN}/proxies/core-api/v1/quotes/get`);
  const params = {
    list: 'options.mostActive.us',
    fields: 'symbol,symbolName,lastPrice,priceChange,percentChange,optionsImpliedVolatilityRank1y,optionsTotalVolume,optionsTotalVolumePercentChange1m,optionsPutVolume,optionsCallVolume,optionsPutCallVolumeRatio',
    'between(lastPrice,2.00,)': '',
    orderBy: 'optionsTotalVolumePercentChange1m',
    orderDir: 'desc',
    limit: '20',
    meta: 'field.shortName,field.type',
    raw: '1',
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

export function normalizeIvChangeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => {
    const raw = item?.raw || item || {};
    return {
      rank: index + 1,
      symbol: String(raw.baseSymbol || item.baseSymbol || '').trim().toUpperCase(),
      contractSymbol: String(raw.symbol || item.symbol || '').trim(),
      optionType: String(raw.symbolType || item.symbolType || ''),
      expirationDate: raw.expirationDate || item.expirationDate || null,
      daysToExpiration: numberOrNull(raw.daysToExpiration ?? item.daysToExpiration),
      strikePrice: numberOrNull(raw.strikePrice ?? item.strikePrice),
      underlyingPrice: numberOrNull(raw.baseLastPrice ?? item.baseLastPrice),
      impliedVolatilityPct: numberOrNull(raw.volatility) === null ? null : numberOrNull(raw.volatility) * 100,
      ivChangePct: numberOrNull(raw.volatilityPercentChange) === null ? null : numberOrNull(raw.volatilityPercentChange) * 100,
      volume: numberOrNull(raw.volume ?? item.volume),
      delta: numberOrNull(raw.delta ?? item.delta),
      tradeTime: raw.tradeTime || item.tradeTime || null,
    };
  }).filter((item) => item.symbol);
}

export function normalizeUnusualVolumeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => {
    const raw = item?.raw || item || {};
    return {
      rank: index + 1,
      symbol: String(raw.symbol || item.symbol || '').trim().toUpperCase(),
      name: String(item.symbolName || '').trim(),
      underlyingPrice: numberOrNull(raw.lastPrice ?? item.lastPrice),
      underlyingChangePct: numberOrNull(raw.percentChange) === null ? null : numberOrNull(raw.percentChange) * 100,
      ivRankPct: numberOrNull(raw.optionsImpliedVolatilityRank1y ?? item.optionsImpliedVolatilityRank1y),
      totalVolume: numberOrNull(raw.optionsTotalVolume ?? item.optionsTotalVolume),
      volumeVsMonthlyPct: numberOrNull(raw.optionsTotalVolumePercentChange1m) === null
        ? null
        : numberOrNull(raw.optionsTotalVolumePercentChange1m) * 100,
      putVolume: numberOrNull(raw.optionsPutVolume ?? item.optionsPutVolume),
      callVolume: numberOrNull(raw.optionsCallVolume ?? item.optionsCallVolume),
      putCallVolumeRatio: numberOrNull(raw.optionsPutCallVolumeRatio ?? item.optionsPutCallVolumeRatio),
    };
  }).filter((item) => item.symbol);
}

async function fetchSignal(type, forceRefresh = false) {
  const cached = !forceRefresh && signalCache.get(type);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.payload, fetchMode: 'cache' };
  }

  const isIvChange = type === 'iv-change';
  const pagePath = isIvChange
    ? '/options/volatility-percent-change/increase'
    : '/options/volume-change/stocks';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const session = await createBarchartSession(pagePath, controller);
    const response = await fetch(isIvChange ? ivChangeUrl() : unusualVolumeUrl(), {
      signal: controller.signal,
      headers: session.headers,
    });
    if (!response.ok) throw new Error(`Barchart 数据接口返回 HTTP ${response.status}`);
    const source = await response.json();
    const data = isIvChange
      ? normalizeIvChangeRows(source.data)
      : normalizeUnusualVolumeRows(source.data);
    if (!data.length) throw new Error('Barchart 榜单暂无数据');

    const payload = {
      ok: true,
      type,
      source: isIvChange ? 'Barchart IV Percent Change' : 'Barchart Unusual Options Volume',
      sourceUrl: session.pageUrl,
      delayed: true,
      delayNote: 'Barchart公开期权数据通常延迟约25至30分钟',
      retrievedAt: new Date().toISOString(),
      count: data.length,
      totalAvailable: numberOrNull(source.total),
      data,
    };
    signalCache.set(type, { cachedAt: Date.now(), payload });
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
    const type = String(req.query?.type || 'iv-change');
    if (!['iv-change', 'unusual-volume'].includes(type)) {
      return sendJson(res, 400, { ok: false, message: '不支持的榜单类型' });
    }
    const forceRefresh = String(req.query?.force || '') === '1';
    return sendJson(res, 200, await fetchSignal(type, forceRefresh));
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? '期权信号榜请求超时，请稍后重试'
      : (error?.message || '期权信号榜暂时不可用');
    return sendJson(res, 502, { ok: false, message });
  }
}
