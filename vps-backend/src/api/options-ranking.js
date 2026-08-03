const SOURCE_URL = 'https://www.webull.com/quote/us/options';
const RANKING_API = 'https://quotes-gw.webullfintech.com/api/wlas/option/rank/list';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const PAGE_SIZE = 50;

let rankingCache = null;

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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeWebullOptionsRanking(sourceRows, offset = 0) {
  if (!Array.isArray(sourceRows)) return [];
  return sourceRows.map((item, index) => {
    const ticker = item?.ticker || {};
    const values = item?.values || {};
    const callPutVolumeRatio = numberOrNull(values.volumeCallPutRatio);
    const changeRatio = numberOrNull(values.changeRatio ?? ticker.changeRatio);
    const callSharePct = callPutVolumeRatio === null || callPutVolumeRatio < 0
      ? null
      : (callPutVolumeRatio / (1 + callPutVolumeRatio)) * 100;

    return {
      rank: offset + index + 1,
      symbol: String(ticker.symbol || ticker.disSymbol || '').trim().toUpperCase(),
      name: String(ticker.name || '').trim(),
      totalVolume: numberOrNull(values.volume),
      openInterest: numberOrNull(values.position),
      callPutVolumeRatio,
      callSharePct,
      callPutOiRatio: numberOrNull(values.positionCallPutRatio),
      underlyingPrice: numberOrNull(values.price ?? ticker.close),
      underlyingChangePct: changeRatio === null ? null : changeRatio * 100,
      marketTime: ticker.tradeTime || null,
      exchange: ticker.disExchangeCode || ticker.exchangeCode || '',
    };
  }).filter((item) => item.symbol);
}

async function fetchRankPage(pageIndex, controller) {
  const url = new URL(RANKING_API);
  url.searchParams.set('regionId', '6');
  url.searchParams.set('rankType', 'totalVolume');
  url.searchParams.set('pageIndex', String(pageIndex));
  url.searchParams.set('pageSize', String(PAGE_SIZE));

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': SOURCE_URL,
      'User-Agent': 'Mozilla/5.0 (compatible; donew-options-ranking/1.0)',
    },
  });
  if (!response.ok) throw new Error(`Webull 榜单第${pageIndex}页返回 HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error(`Webull 榜单第${pageIndex}页暂无数据`);
  return payload;
}

async function loadRanking(limit, forceRefresh = false) {
  const cached = !forceRefresh && rankingCache && Date.now() - rankingCache.cachedAt < CACHE_TTL_MS;
  if (cached) return { ...rankingCache.payload, fetchMode: 'cache' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const pageCount = Math.ceil(limit / PAGE_SIZE);
    const pages = await Promise.all(
      Array.from({ length: pageCount }, (_, index) => fetchRankPage(index + 1, controller))
    );
    const data = pages.flatMap((page, index) =>
      normalizeWebullOptionsRanking(page.data, index * PAGE_SIZE)
    ).slice(0, limit);
    if (!data.length) throw new Error('Webull 热门期权榜暂无数据');

    const latestUpdateMs = Math.max(
      ...pages.map((page) => Number(page.latestUpdateTime) || 0)
    );
    const payload = {
      ok: true,
      source: 'Webull Options Total Volume Ranking',
      sourceUrl: SOURCE_URL,
      retrievedAt: new Date().toISOString(),
      rankingUpdatedAt: latestUpdateMs ? new Date(latestUpdateMs).toISOString() : null,
      count: data.length,
      requestedLimit: limit,
      publicSourceLimit: data.length < limit,
      data,
    };
    rankingCache = { cachedAt: Date.now(), payload };
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
    const limit = Math.max(1, Math.min(Number(req.query?.limit) || 100, 100));
    const forceRefresh = String(req.query?.force || '') === '1';
    return sendJson(res, 200, await loadRanking(limit, forceRefresh));
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? '热门期权榜请求超时，请稍后重试'
      : (error?.message || '热门期权榜暂时不可用');
    return sendJson(res, 502, { ok: false, message });
  }
}
