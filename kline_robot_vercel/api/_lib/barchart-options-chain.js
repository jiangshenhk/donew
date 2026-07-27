// barchart-options-chain.js — Barchart 期权链数据获取
// 复用 options-signals.js 中的 Barchart session 模式

const BARCHART_ORIGIN = 'https://www.barchart.com';

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[,%+]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,\s]+=)/) : [];
}

async function createBarchartSession(symbol, timeoutMs = 15000) {
  const pageUrl = `${BARCHART_ORIGIN}/stocks/quotes/${symbol}/overview`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; donew-options-chain/1.0)',
      },
    });
    if (!response.ok) throw new Error(`Barchart HTTP ${response.status}`);
    await response.text();

    const cookies = getSetCookies(response.headers).map(v => v.split(';', 1)[0]);
    const xsrfCookie = cookies.find(v => v.startsWith('XSRF-TOKEN='));
    if (!cookies.length || !xsrfCookie) throw new Error('Barchart session 建立失败');

    return {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookies.join('; '),
        'Referer': pageUrl,
        'User-Agent': 'Mozilla/5.0 (compatible; donew-options-chain/1.0)',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': decodeURIComponent(xsrfCookie.slice('XSRF-TOKEN='.length)),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOptionsChain(symbol, options = {}) {
  const {
    targetDte = 10,
    dteMin = 5,
    dteMax = 25,
    targetDelta = 0.15,
    timeoutMs = 20000,
  } = options;

  const session = await createBarchartSession(symbol, timeoutMs);

  const url = new URL(`${BARCHART_ORIGIN}/proxies/core-api/v1/options/get`);
  const params = {
    fields: 'symbol,baseSymbol,expirationDate,daysToExpiration,symbolType,strikePrice,bidPrice,askPrice,volume,openInterest,volatility,vega,delta,tradeTime,baseLastPrice',
    orderBy: 'daysToExpiration',
    orderDir: 'asc',
    limit: '100',
    raw: '1',
    meta: 'field.shortName,field.type',
    'in(symbolType,(put))': '',
    'gt(bidPrice,0.01)': '',
    [`between(daysToExpiration,${dteMin},${dteMax})`]: '',
    'between(openInterest,10,)': '',
    'gt(baseLastPrice,1.00)': '',
    [`eq(baseSymbol,${symbol})`]: '',
  };
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: session.headers,
    });
    if (!response.ok) throw new Error(`Barchart API HTTP ${response.status}`);

    const body = await response.json();
    const rows = (Array.isArray(body.data) ? body.data : []);

    const contracts = rows.map(item => {
      const raw = item?.raw || item;
      return {
        contractSymbol: String(raw.symbol || '').trim(),
        symbol: String(raw.baseSymbol || '').trim().toUpperCase(),
        optionType: String(raw.symbolType || ''),
        expireDate: raw.expirationDate || null,
        daysToExpiration: numberOrNull(raw.daysToExpiration),
        strikePrice: numberOrNull(raw.strikePrice),
        bidPrice: numberOrNull(raw.bidPrice) || 0,
        askPrice: numberOrNull(raw.askPrice),
        iv: numberOrNull(raw.volatility),
        delta: numberOrNull(raw.delta),
        volume: numberOrNull(raw.volume) || 0,
        openInterest: numberOrNull(raw.openInterest) || 0,
        underlyingPrice: numberOrNull(raw.baseLastPrice),
      };
    }).filter(c =>
      c.symbol === symbol.toUpperCase()
      && c.optionType.toLowerCase() === 'put'
      && c.strikePrice
      && c.daysToExpiration >= dteMin && c.daysToExpiration <= dteMax
      && c.bidPrice > 0
      && c.openInterest >= 10
    );

    contracts.sort((a, b) => {
      const scoreA = Math.abs(Math.abs(a.delta) - targetDelta) * 50 + a.daysToExpiration;
      const scoreB = Math.abs(Math.abs(b.delta) - targetDelta) * 50 + b.daysToExpiration;
      return scoreA - scoreB;
    });

    return contracts;
  } finally {
    clearTimeout(timer);
  }
}

export function selectBestContract(contracts, _targetDte, targetDelta = 0.15) {
  if (!contracts || !contracts.length) return null;
  let best = contracts[0];
  let bestScore = Infinity;
  const tdl = targetDelta ?? 0.15;
  for (const c of contracts) {
    const score = Math.abs(Math.abs(c.delta) - tdl) * 50 + c.daysToExpiration;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
