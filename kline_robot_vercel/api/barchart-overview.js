const BARCHART_ORIGIN = 'https://www.barchart.com';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

const overviewCache = new Map();
const QUOTE_FIELDS = [
  'symbol',
  'optionsWeightedImpliedVolatility',
  'optionsWeightedImpliedVolatilityChange',
  'historicVolatility30d',
  'optionsImpliedVolatilityPercentile1y',
  'optionsImpliedVolatilityRank1y',
  'optionsWeightedImpliedVolatilityHigh1y',
  'optionsWeightedImpliedVolatilityHighDate1y',
  'optionsWeightedImpliedVolatilityLow1y',
  'optionsWeightedImpliedVolatilityLowDate1y',
  'optionsTotalVolume',
  'optionsTotalVolume1m',
  'optionsPutCallVolumeRatio',
  'optionsTotalOpenInterest',
  'optionsTotalOpenInterest1m',
  'optionsPutCallOpenInterestRatio',
].join(',');

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

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,\s]+=)/) : [];
}

export function parseBarchartOverviewHtml(html) {
  const source = String(html || '');
  const rows = [...source.matchAll(/<li[^>]*>\s*<span[^>]*class=["'][^"']*\bleft\b[^"']*["'][^>]*>[\s\S]*?<\/li>/gi)]
    .map((match) => textContent(match[0]))
    .filter(Boolean);
  if (rows.length < 10) {
    rows.push(...[...source.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match) => textContent(match[1]))
      .filter(Boolean));
  }
  if (!rows.length) throw new Error('Barchart 页面未包含期权概览');
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

  return metrics;
}

export function parseBarchartQuoteOverview(item = {}) {
  return {
    iv: numberText(item.optionsWeightedImpliedVolatility),
    ivChange: numberText(item.optionsWeightedImpliedVolatilityChange),
    hv: numberText(item.historicVolatility30d),
    ivPercentile: numberText(item.optionsImpliedVolatilityPercentile1y),
    ivRank: numberText(item.optionsImpliedVolatilityRank1y),
    ivHigh: numberText(item.optionsWeightedImpliedVolatilityHigh1y),
    ivHighDate: String(item.optionsWeightedImpliedVolatilityHighDate1y || '').trim(),
    ivLow: numberText(item.optionsWeightedImpliedVolatilityLow1y),
    ivLowDate: String(item.optionsWeightedImpliedVolatilityLowDate1y || '').trim(),
    expectedMove: '',
    expectedMovePct: '',
    expectedMoveDte: '',
    expectedRangeLow: '',
    expectedRangeHigh: '',
    putCallVolRatio: numberText(item.optionsPutCallVolumeRatio),
    putCallOiRatio: numberText(item.optionsPutCallOpenInterestRatio),
    todayVolume: numberText(item.optionsTotalVolume),
    volumeAvg30: numberText(item.optionsTotalVolume1m),
    todayOpenInterest: numberText(item.optionsTotalOpenInterest),
    openInterest30: numberText(item.optionsTotalOpenInterest1m),
  };
}

function normalizeSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('标的代码格式不正确');
  return symbol;
}

function normalizeSymbols(value) {
  const symbols = String(value || '')
    .split(/[\s,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeSymbol);
  return Array.from(new Set(symbols)).slice(0, 12);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const cookies = getSetCookies(response.headers).map((value) => value.split(';', 1)[0]);
    const xsrfCookie = cookies.find((value) => value.startsWith('XSRF-TOKEN='));
    const html = await response.text();
    let metrics = {};
    try {
      metrics = parseBarchartOverviewHtml(html);
    } catch { /* use the page data endpoint below */ }

    let populated = Object.values(metrics).filter((value) => String(value || '').trim()).length;
    let metricSource = 'page-html';
    let warning = '';
    if (populated < 10) {
      warning = '页面HTML期权概览字段不足，已使用Barchart data API回退；Expected Move与Expected Range可能缺失。';
      console.warn(`[barchart-overview] ${symbol}: ${warning}`);
      if (!cookies.length || !xsrfCookie) throw new Error('Barchart免费会话未建立');
      const quoteUrl = new URL(`${BARCHART_ORIGIN}/proxies/core-api/v1/quotes/get`);
      quoteUrl.searchParams.set('symbols', symbol);
      quoteUrl.searchParams.set('fields', QUOTE_FIELDS);
      quoteUrl.searchParams.set('raw', '1');
      const quoteResponse = await fetch(quoteUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': cookies.join('; '),
          'Referer': sourceUrl,
          'User-Agent': 'Mozilla/5.0 (compatible; donew-sell-put-overview/1.0)',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfCookie.slice('XSRF-TOKEN='.length)),
        },
      });
      if (!quoteResponse.ok) throw new Error(`Barchart概览接口返回 HTTP ${quoteResponse.status}`);
      const quotePayload = await quoteResponse.json();
      const quoteMetrics = parseBarchartQuoteOverview(quotePayload?.data?.[0] || {});
      metrics = { ...quoteMetrics, ...Object.fromEntries(Object.entries(metrics).filter(([, value]) => String(value || '').trim())) };
      populated = Object.values(metrics).filter((value) => String(value || '').trim()).length;
      metricSource = 'page-data-api';
    }
    if (populated < 8) throw new Error('Barchart期权概览字段不足');
    const payload = {
      ok: true,
      symbol,
      source: 'Barchart Options Overview',
      sourceUrl,
      delayed: true,
      delayNote: 'Barchart公开期权数据通常延迟约25至30分钟',
      retrievedAt: new Date().toISOString(),
      metricSource,
      warning,
      metrics,
    };
    overviewCache.set(symbol, { cachedAt: Date.now(), payload });
    return { ...payload, fetchMode: 'realtime' };
  } finally {
    clearTimeout(timer);
  }
}

// ── Signal page: display latest agent signal as HTML ──────────
const SIGNALS_URL = 'https://raw.githubusercontent.com/jiangshenhk/donew/main/stockprice/data/sell-put-signals.json';
let signalCache = { data: null, fetchedAt: 0 };

async function fetchSignals() {
  const now = Date.now();
  if (signalCache.data && (now - signalCache.fetchedAt) < 5 * 60 * 1000) return signalCache.data;
  try {
    const r = await fetch(SIGNALS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return signalCache.data || null;
    const data = await r.json();
    signalCache = { data, fetchedAt: now };
    return data;
  } catch { return signalCache.data || null; }
}

const fmtTs = (ts) => new Date(ts).toLocaleString('zh-HK', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const riskCol = (r) => r >= 7 ? '#ff6b7d' : r >= 5 ? '#ffd54a' : '#45d483';
const bg = (v) => v === 'red' ? 'background:#3d1e2a;color:#ff6b7d' : v === 'yellow' ? 'background:#2a3520;color:#ffd54a' : 'background:#1b3a2a;color:#45d483';

async function signalPage(req, res) {
  const sym = String(req.query.symbol || '').trim().toUpperCase();
  if (!sym) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send('<!doctype html><html><body style="font-family:monospace;padding:20px;color:#6b7fa3"><p>用法: <code>/api/sell-put-signal?symbol=MSTR</code></p></body></html>');
  }
  const all = await fetchSignals();
  const s = all?.[sym];
  if (!s) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!doctype html><html><body style="font-family:monospace;padding:20px;background:#0d1522;color:#cddbf7"><h2>无信号</h2><p>${sym} 暂无最新信号数据</p></body></html>`);
  }
  const mid = s.contract?.mid?.toFixed(2) || '--';
  const otm = s.otm != null ? s.otm.toFixed(1)+'%' : '--';
  const d = s.decision || {};
  const st = d.stance === '可卖Put' ? '<span style="color:#45d483;font-weight:700">可卖Put</span>' : d.stance === '谨慎卖Put' ? '<span style="color:#ffd54a;font-weight:700">谨慎卖Put</span>' : '<span style="color:#ff6b7d;font-weight:700">暂不卖Put</span>';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sym} · Sell Put 信号</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1522;color:#cddbf7;padding:24px;max-width:700px;margin:0 auto}
h1{font-size:1.4rem;margin-bottom:4px}.muted{color:#6b7fa3;font-size:.82rem}
.card{background:#111d2f;border:1px solid #1f2b44;border-radius:10px;padding:20px;margin:16px 0}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1a2942}
.row:last-child{border-bottom:none}.label{color:#6b7fa3;font-size:.82rem}.value{font-weight:600;text-align:right}
.stance{font-size:1.2rem;margin:8px 0}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.78rem;font-weight:600;margin-left:6px}
.section{margin:16px 0;line-height:1.6;color:#b0c4e8;font-size:.88rem;white-space:pre-wrap}
.footer{text-align:center;color:#6b7fa3;font-size:.75rem;margin-top:24px;padding-top:16px;border-top:1px solid #1a2942}
a{color:#4d9eff;text-decoration:none}
</style>
</head>
<body>
<h1>${sym} · Sell Put 信号</h1>
<p class="muted">${fmtTs(s.timestamp)} | Agent v0.5.0</p>
<div class="card">
  <div class="stance">${st}
    <span class="badge" style="${bg(d.riskScore>=7?'red':d.riskScore>=5?'yellow':'green')}">风险 ${d.riskScore}/10</span>
    <span class="badge" style="${bg(d.putStance==='不利'?'red':d.putStance==='有利'?'green':'yellow')}">${d.putStance||'--'}</span>
    <span class="badge" style="${bg(d.temperature==='高温'?'red':'yellow')}">${d.temperature||'--'}</span>
    <span class="badge" style="${bg(d.blackSwan==='红灯'?'red':d.blackSwan==='绿灯'?'green':'yellow')}">${d.blackSwan||'--'}</span>
  </div>
</div>
<div class="card">
  <div class="row"><span class="label">价格</span><span class="value">$${s.price?.toFixed(2)||'--'}</span></div>
  <div class="row"><span class="label">合约</span><span class="value">$${s.contract?.strike?.toFixed(0)}P DTE${s.contract?.dte}</span></div>
  <div class="row"><span class="label">Bid/Mid/Ask</span><span class="value">$${s.contract?.bid?.toFixed(2)} / $${mid} / $${s.contract?.ask?.toFixed(2)||'--'}</span></div>
  <div class="row"><span class="label">OTM安全垫</span><span class="value">${otm}</span></div>
  <div class="row"><span class="label">Δ</span><span class="value">${s.contract?.delta!=null?s.contract.delta.toFixed(3):'--'}</span></div>
  <div class="row"><span class="label">IV</span><span class="value">${s.contract?.iv!=null?(s.contract.iv*100).toFixed(1)+'%':'--'}</span></div>
  <div class="row"><span class="label">年化收益</span><span class="value">${s.annual||'--'}%</span></div>
  <div class="row"><span class="label">严格安全价</span><span class="value">${s.safePrice!=null?'$'+s.safePrice.toFixed(2):'--'}</span></div>
  <div class="row"><span class="label">操作</span><span class="value">${s.action||'--'}</span></div>
</div>
<div class="section">
<strong>判断理由：</strong><br>
${(d.reasoning||'--').replace(/\n/g,'<br>')}
</div>
<div class="footer">数据来源: <a href="https://github.com/jiangshenhk/donew">Sell Put Agent</a> · 自动更新 · 仅供参考</div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Signal mode: display latest agent signal as HTML
  if (req.query.mode === 'signal') return signalPage(req, res);

  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, message: 'Method not allowed' });

  try {
    const symbols = normalizeSymbols(req.query?.symbols);
    if (symbols.length) {
      const forceRefresh = String(req.query?.force || '') === '1';
      const data = [];
      const errors = [];
      for (let index = 0; index < symbols.length; index += 1) {
        const symbol = symbols[index];
        try {
          data.push(await fetchOverview(symbol, forceRefresh));
        } catch (error) {
          errors.push({
            symbol,
            message: error?.name === 'AbortError'
              ? 'Barchart期权概览请求超时'
              : (error?.message || 'Barchart期权概览暂时不可用'),
          });
        }
        if (index < symbols.length - 1) await wait(350);
      }
      return sendJson(res, 200, {
        ok: data.length > 0,
        requested: symbols.length,
        count: data.length,
        failedCount: errors.length,
        retrievedAt: new Date().toISOString(),
        delayed: true,
        delayNote: 'Barchart公开期权数据通常延迟约25至30分钟',
        data,
        errors,
      });
    }
    const symbol = normalizeSymbol(req.query?.symbol);
    const forceRefresh = String(req.query?.force || '') === '1';
    const includeChain = String(req.query?.chain || '') === '1';

    const overview = await fetchOverview(symbol, forceRefresh);

    if (includeChain && overview.ok) {
      try {
        const { fetchOptionsChain, selectBestContract } = await import('./_lib/barchart-options-chain.js');
        const contracts = await fetchOptionsChain(symbol);
        const best = selectBestContract(contracts);
        if (best) {
          overview.bestContract = {
            strike: best.strikePrice,
            delta: best.delta ? Math.round(best.delta * 1000) / 1000 : null,
            bid: best.bidPrice,
            ask: best.askPrice,
            mid: best.bidPrice && best.askPrice ? Math.round((best.bidPrice + best.askPrice) / 2 * 100) / 100 : null,
            expiryDate: best.expireDate,
            dte: best.daysToExpiration,
            iv: best.iv ? Math.round(best.iv * 1000) / 10 : null,
          };
        }
      } catch { /* chain fetch failed, proceed with overview only */ }
    }

    return sendJson(res, 200, overview);
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'Barchart期权概览请求超时'
      : (error?.message || 'Barchart期权概览暂时不可用');
    return sendJson(res, 502, { ok: false, message });
  }
}
