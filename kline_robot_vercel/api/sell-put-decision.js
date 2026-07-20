const STOCKPRICE_URL = "https://raw.githubusercontent.com/jiangshenhk/donew/main/stockprice/data/latest-price.json";
const NEWS_URL = "https://api.github.com/repos/jiangshenhk/donew/contents/jin10news/data/latest-24h.json?ref=main";
const NEWS_CACHE_TTL = 5 * 60 * 1000;
const STOCKPRICE_CACHE_TTL = 5 * 60 * 1000;
const FOCUS_SYMBOLS = [
  { symbol: "QQQ", market: "us" }, { symbol: "SPY", market: "us" }, { symbol: "IWM", market: "us" },
  { symbol: "QLD", market: "us" }, { symbol: "SMH", market: "us" }, { symbol: "SOXX", market: "us" },
  { symbol: "BTC-USD", market: "crypto" }, { symbol: "^VIX", market: "us" },
  { symbol: "^TNX", market: "global" }, { symbol: "DX-Y.NYB", market: "global" },
  { symbol: "IBIT", market: "us" }, { symbol: "MSTR", market: "us" },
  { symbol: "INTC", market: "us" }, { symbol: "HOOD", market: "us" },
];

let stockpriceCache = null;
let newsCache = null;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
}

async function timedFetch(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) return "未取到";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false });
}

function symbolLabel(symbol) {
  const m = { "BTC-USD": "BTC", "^VIX": "VIX", "^TNX": "10Y", "DX-Y.NYB": "DXY" };
  return m[symbol] || symbol;
}

function normalizeRow(item) {
  const last = numberOrNull(item?.last ?? item?.price);
  const previousClose = numberOrNull(item?.previousClose);
  const changePct = numberOrNull(item?.changePct ?? item?.changePercent);
  return {
    symbol: item?.symbol || "", last, previousClose,
    changePct: changePct ?? (last !== null && previousClose ? (last / previousClose - 1) * 100 : null),
    marketTime: item?.marketTime || "", exchange: item?.exchange || item?.marketState || "",
    category: item?.category || "", source: item?.source || "", error: item?.error || "",
    retrievedAt: item?.retrievedAt || "", fetchMode: item?.fetchMode || "live",
    cacheStoredAt: item?.cacheStoredAt || "", stockpriceUpdatedAt: item?.stockpriceUpdatedAt || "",
    stockpriceCheckedAt: item?.stockpriceCheckedAt || "", currency: item?.currency || "",
    dailyAtr: item?.dailyAtr ?? null, weeklyAtr: item?.weeklyAtr ?? null,
  };
}

function pct(value) {
  const n = numberOrNull(value);
  if (n === null) return "未取到";
  const sign = n > 0 ? "+" : "";
  const cls = n > 0 ? "up" : n < 0 ? "dn" : "";
  return cls ? `<span class="${cls}">${sign}${n.toFixed(2)}%</span>` : `${sign}${n.toFixed(2)}%`;
}

async function loadStockpriceSnapshot() {
  if (stockpriceCache && Date.now() - stockpriceCache.cachedAt < STOCKPRICE_CACHE_TTL) {
    return { ...JSON.parse(JSON.stringify(stockpriceCache.payload)), fetchMode: "cache" };
  }
  const res = await timedFetch(STOCKPRICE_URL, { headers: { "User-Agent": "Mozilla/5.0" } }, 8000);
  if (!res.ok) throw new Error(`stockprice HTTP ${res.status}`);
  const payload = await res.json();
  if (!payload || !Array.isArray(payload.data)) throw new Error("stockprice snapshot invalid");
  stockpriceCache = { cachedAt: Date.now(), payload: JSON.parse(JSON.stringify(payload)) };
  return { ...JSON.parse(JSON.stringify(payload)), fetchMode: "live" };
}

function stockpriceRow(snapshot, symbol) {
  if (!snapshot?.data?.length) return null;
  return snapshot.data.find((i) => String(i?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase()) || null;
}

function normalizeStockpriceRow(item, meta) {
  if (!item) return null;
  return normalizeRow({
    symbol: item.symbol, price: item.price, previousClose: item.previousClose,
    changePercent: item.changePercent, marketTime: item.marketTime || "",
    exchange: item.exchange || "STOCKPRICE", category: item.category || "", source: "stockprice",
    retrievedAt: meta?.checkedAt || meta?.updatedAt || new Date().toISOString(),
    fetchMode: meta?.fetchMode === "cache" ? "cache" : "live",
    cacheStoredAt: meta?.cacheServedAt || meta?.checkedAt || meta?.updatedAt || new Date().toISOString(),
    stockpriceUpdatedAt: meta?.updatedAt || "", stockpriceCheckedAt: meta?.checkedAt || "",
    currency: item.currency || "", dailyAtr: item?.dailyAtr ?? null, weeklyAtr: item?.weeklyAtr ?? null,
  });
}

async function loadNews() {
  if (newsCache && Date.now() - newsCache.fetchedAt < NEWS_CACHE_TTL) return newsCache.data;
  const res = await timedFetch(NEWS_URL + "&t=" + Date.now(), {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "donew-sell-put-decision" },
  }, 10000);
  if (!res.ok) throw new Error(`News HTTP ${res.status}`);
  const meta = await res.json();
  const payload = JSON.parse(Buffer.from(String(meta.content || "").replace(/\n/g, ""), "base64").toString("utf8"));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .filter((i) => Date.parse(i.time) >= cutoff)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const data = { items: items.slice(0, 150), count: items.length };
  newsCache = { fetchedAt: Date.now(), data };
  return data;
}

function summarizeNews(items) {
  if (!items || !items.length) return "暂无最近24小时新闻。";
  const top = items.slice(0, 30);
  const lines = top.map((i) => {
    const time = new Date(i.time).toLocaleString("zh-HK", { hour: "2-digit", minute: "2-digit", hour12: false });
    const cats = (i.categories || []).join(",");
    return `[${time}][${cats}] ${(i.content || "").slice(0, 200)}`;
  });
  return lines.join("\n");
}

async function fetchKlineData(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&events=history&includePrePost=false`;
  try {
    const res = await timedFetch(url, { headers: { "User-Agent": "Mozilla/5.0 donew-sell-put-decision" } }, 10000);
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("No chart data");
    const timestamps = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const a = result.indicators?.adjclose?.[0] || {};
    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = numberOrNull(timestamps[i]);
      const open = numberOrNull(q.open?.[i]);
      const high = numberOrNull(q.high?.[i]);
      const low = numberOrNull(q.low?.[i]);
      const close = numberOrNull(q.close?.[i]);
      const volume = numberOrNull(q.volume?.[i]);
      const adjclose = numberOrNull(a.adjclose?.[i]);
      if (ts === null || close === null) continue;
      bars.push({ ts, open: open ?? close, high: high ?? close, low: low ?? close, close, volume: volume ?? 0, adjclose: adjclose ?? close });
    }
    return bars;
  } catch (e) {
    return { error: e.message };
  }
}

function computeKlineStats(bars) {
  if (!Array.isArray(bars) || bars.length < 5) return null;
  const n = bars.length;
  const last = bars[n - 1];
  const prev = bars[n - 2];

  const returns = {};
  if (n >= 2) returns.d1 = ((last.close / prev.close) - 1) * 100;
  if (n >= 6) returns.d5 = ((last.close / bars[n - 6].close) - 1) * 100;
  if (n >= 11) returns.d10 = ((last.close / bars[n - 11].close) - 1) * 100;
  if (n >= 21) returns.d20 = ((last.close / bars[n - 21].close) - 1) * 100;

  const recentHigh = Math.max(...bars.slice(-21).map((b) => b.high));
  const recentLow = Math.min(...bars.slice(-21).map((b) => b.low));
  const range = recentHigh - recentLow;
  const pricePosition = range > 0 ? ((last.close - recentLow) / range) * 100 : 50;

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const avgVolume = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  const lastVolume = last.volume;
  const volumeRatio = avgVolume > 0 ? lastVolume / avgVolume : 1;

  function sma(data, period) {
    if (data.length < period) return null;
    return data.slice(-period).reduce((s, v) => s + v, 0) / period;
  }
  const sma5 = sma(closes, 5);
  const sma10 = sma(closes, 10);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, Math.min(50, closes.length));

  const atr = computeAtr(bars, 14);
  const atrPct = last.close > 0 ? (atr / last.close) * 100 : null;

  const patterns = detectPatterns(bars);

  const support = [recentLow, last.close - atr * 1.5, sma20, sma50].filter((v) => v !== null && v > 0);
  const resistance = [recentHigh, last.close + atr * 1.5, sma20, sma50].filter((v) => v !== null && v > 0);

  const last15 = bars.slice(-15).map((b) => ({
    d: new Date(b.ts * 1000).toISOString().slice(5, 10),
    o: b.open.toFixed(2), h: b.high.toFixed(2), l: b.low.toFixed(2), c: b.close.toFixed(2),
    v: b.volume > 1000000 ? (b.volume / 1000000).toFixed(1) + "M" : b.volume > 1000 ? (b.volume / 1000).toFixed(0) + "K" : String(b.volume),
  }));

  return {
    barsCount: n,
    lastClose: last.close,
    lastOpen: last.open,
    lastHigh: last.high,
    lastLow: last.low,
    returns,
    recentHigh, recentLow, range, pricePosition: pricePosition.toFixed(1),
    sma5, sma10, sma20, sma50,
    atr: atr.toFixed(4), atrPct: atrPct ? atrPct.toFixed(2) : null,
    volumeRatio: volumeRatio.toFixed(2),
    patterns,
    supportMin: Math.min(...support).toFixed(2),
    supportMax: Math.max(...support).toFixed(2),
    resistanceMin: Math.min(...resistance).toFixed(2),
    resistanceMax: Math.max(...resistance).toFixed(2),
    last15,
  };
}

function computeAtr(bars, period) {
  if (!bars || bars.length < period + 1) return 0;
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const h = bars[i].high, l = bars[i].low, pc = bars[i - 1].close;
    trSum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  let atr = trSum / period;
  for (let i = period + 1; i < bars.length; i++) {
    const h = bars[i].high, l = bars[i].low, pc = bars[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    atr = (atr * (period - 1) + tr) / period;
  }
  return atr;
}

function detectPatterns(bars) {
  const result = [];
  if (bars.length < 3) return result;
  const last = bars[bars.length - 1];
  const p1 = bars[bars.length - 2];
  const p2 = bars[bars.length - 3];

  const body = Math.abs(last.close - last.open);
  const upper = last.high - Math.max(last.open, last.close);
  const lower = Math.min(last.open, last.close) - last.low;
  const total = last.high - last.low;

  const p1Body = Math.abs(p1.close - p1.open);

  if (total > 0 && body / total < 0.15 && upper > 0 && lower > 0) {
    if (upper > 2 * lower) result.push("墓碑十字/流星(上影线长)");
    else if (lower > 2 * upper) result.push("蜻蜓十字/锤子线(下影线长)");
    else result.push("十字星(犹豫)");
  }

  if (total > 0 && body / total < 0.35) {
    if (lower >= 2 * body && upper < body) result.push("锤子线(长下影)");
    if (upper >= 2 * body && lower < body) result.push("流星线(长上影)");
  }

  if (p1.close < p1.open && last.close > last.open && last.open < p1.close && last.close > p1.open) {
    result.push("看涨吞没");
  }
  if (p1.close > p1.open && last.close < last.open && last.open > p1.close && last.close < p1.open) {
    result.push("看跌吞没");
  }

  if (p1.close > p1.open && last.close < last.open && last.open > p1.high && last.close < p1.close) {
    result.push("乌云盖顶");
  }
  if (p1.close < p1.open && last.close > last.open && last.open < p1.low && last.close > p1.close) {
    result.push("刺透形态");
  }

  const trend3 = bars.slice(-4, -1).map((b) => b.close);
  if (trend3.length === 3) {
    if (trend3[0] < trend3[1] && trend3[1] < trend3[2]) result.push("近3日连续上涨");
    if (trend3[0] > trend3[1] && trend3[1] > trend3[2]) result.push("近3日连续下跌");
  }

  const closes = bars.slice(-5).map((b) => b.close);
  const upDays = closes.filter((c, i) => i > 0 && c > closes[i - 1]).length;
  if (closes.length >= 5) {
    if (upDays >= 4) result.push("最近5天上涨4天(强势)");
    if (upDays <= 1) result.push("最近5天下跌4天(弱势)");
  }

  return [...new Set(result)];
}

function formatKlineStats(stats) {
  if (!stats) return "K线数据不足，无法分析。";
  const lines = [
    `最新收盘: ${stats.lastClose} | 开盘: ${stats.lastOpen} | 最高: ${stats.lastHigh} | 最低: ${stats.lastLow}`,
    `近20日高点: ${stats.recentHigh} | 低点: ${stats.recentLow} | 当前在区间位置: ${stats.pricePosition}%`,
    `涨幅: 1日 ${stats.returns.d1?.toFixed(2) ?? "N/A"}% | 5日 ${stats.returns.d5?.toFixed(2) ?? "N/A"}% | 10日 ${stats.returns.d10?.toFixed(2) ?? "N/A"}% | 20日 ${stats.returns.d20?.toFixed(2) ?? "N/A"}%`,
    `均线: SMA5=${stats.sma5?.toFixed(2) ?? "N/A"} | SMA10=${stats.sma10?.toFixed(2) ?? "N/A"} | SMA20=${stats.sma20?.toFixed(2) ?? "N/A"} | SMA50=${stats.sma50?.toFixed(2) ?? "N/A"}`,
    `ATR(14): ${stats.atr} | ATR占比: ${stats.atrPct}% | 量比( vs 60日均): ${stats.volumeRatio}`,
    `支撑区间: ${stats.supportMin} ~ ${stats.supportMax}`,
    `阻力区间: ${stats.resistanceMin} ~ ${stats.resistanceMax}`,
  ];
  if (stats.patterns.length) {
    lines.push(`检测到的K线形态: ${stats.patterns.join(", ")}`);
  }
  lines.push(`\n最近15个交易日(日期|开|高|低|收|量):`);
  for (const d of stats.last15) {
    lines.push(`  ${d.d} O=${d.o} H=${d.h} L=${d.l} C=${d.c} V=${d.v}`);
  }
  return lines.join("\n");
}

function row(snapshot, symbol) {
  const item = (snapshot.data || []).find((e) => String(e?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase());
  return normalizeRow(item || { symbol });
}

function marketRisk(snapshot, targetSymbol) {
  const qqq = row(snapshot, "QQQ");
  const spy = row(snapshot, "SPY");
  const iwm = row(snapshot, "IWM");
  const smh = row(snapshot, "SMH");
  const soxx = row(snapshot, "SOXX");
  const btc = row(snapshot, "BTC-USD");
  const vix = row(snapshot, "^VIX");
  const tnx = row(snapshot, "^TNX");
  const dxy = row(snapshot, "DX-Y.NYB");
  const target = row(snapshot, targetSymbol);

  let risk = 5.2;
  if ((vix.changePct || 0) > 5) risk += 1.2;
  if ((tnx.changePct || 0) > 1) risk += 0.7;
  if ((dxy.changePct || 0) > 0.3) risk += 0.6;
  if ((qqq.changePct || 0) < -1 || (spy.changePct || 0) < -1) risk += 0.9;
  if ((smh.changePct || 0) < -1 || (soxx.changePct || 0) < -1) risk += 0.7;
  if ((btc.changePct || 0) < -2.5) risk += 0.5;
  if ((iwm.changePct || 0) > (spy.changePct || 0)) risk -= 0.2;
  if ((target.changePct || 0) < -3) risk += 0.6;
  risk = Math.max(1, Math.min(9.5, risk));

  const putStance = risk >= 7.5 ? "不利" : risk >= 6.2 ? "谨慎" : "有利";
  return {
    riskScore: risk.toFixed(1),
    putStance,
    blackSwan: risk >= 7.5 ? "🔴 高警戒" : risk >= 6.2 ? "🟡 需防范" : "🟢 常规防守",
    summary: `QQQ ${pct(qqq.changePct)} / SPY ${pct(spy.changePct)} / SMH ${pct(smh.changePct)} / VIX ${pct(vix.changePct)} / 10Y ${pct(tnx.changePct)} / DXY ${pct(dxy.changePct)} / BTC ${pct(btc.changePct)}`,
  };
}

function focusTable(snapshot, targetSymbol) {
  const symbols = Array.from(new Set([targetSymbol, ...FOCUS_SYMBOLS.map((i) => i.symbol)]));
  return symbols.map((s) => {
    const item = row(snapshot, s);
    return `<tr><td>${safeHtml(symbolLabel(s))}</td><td>${item.last === null ? "未取到" : safeHtml(item.last.toFixed(2))}</td><td>${safeHtml(pct(item.changePct))}</td><td>${safeHtml(item.exchange || "-")}</td><td>${safeHtml(formatDateTime(item.marketTime))}</td></tr>`;
  }).join("");
}

function formatOptionMetrics(metrics = {}) {
  const entries = [
    ["IV", metrics.iv, "%"], ["HV", metrics.hv, "%"],
    ["IV Percentile", metrics.ivPercentile, "%"], ["IV Rank", metrics.ivRank, "%"],
    ["Expected Move", metrics.expectedMove, ""], ["Expected Move %", metrics.expectedMovePct, "%"],
    ["Put/Call Vol Ratio", metrics.putCallVolRatio, ""], ["Put/Call OI Ratio", metrics.putCallOiRatio, ""],
    ["Today's Volume", metrics.todayVolume, ""], ["Volume Avg 30D", metrics.volumeAvg30, ""],
    ["Today's Open Interest", metrics.todayOpenInterest, ""], ["Open Int 30D", metrics.openInterest30, ""],
  ];
  return entries.filter(([, v]) => String(v ?? "").trim() !== "").map(([l, v, s]) => `${l}: ${String(v).trim()}${s}`).join("\n");
}

function sanitizeOptionMetrics(raw = {}) {
  return {
    iv: String(raw.iv ?? "").trim(), hv: String(raw.hv ?? "").trim(),
    ivPercentile: String(raw.ivPercentile ?? "").trim(), ivRank: String(raw.ivRank ?? "").trim(),
    expectedMove: String(raw.expectedMove ?? "").trim(), expectedMovePct: String(raw.expectedMovePct ?? "").trim(),
    expectedRangeLow: String(raw.expectedRangeLow ?? "").trim(), expectedRangeHigh: String(raw.expectedRangeHigh ?? "").trim(),
    putCallVolRatio: String(raw.putCallVolRatio ?? "").trim(), putCallOiRatio: String(raw.putCallOiRatio ?? "").trim(),
    todayVolume: String(raw.todayVolume ?? "").trim(), volumeAvg30: String(raw.volumeAvg30 ?? "").trim(),
    todayOpenInterest: String(raw.todayOpenInterest ?? "").trim(), openInterest30: String(raw.openInterest30 ?? "").trim(),
  };
}

function parseLooseJson(text) {
  const source = String(text || "").trim();
  if (!source) throw new Error("解析服务未返回内容。");
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : source;
  return JSON.parse(candidate);
}

function extractTextFromResponse(json) {
  return json?.output_text || (json?.output || []).flatMap((i) => i.content || []).map((c) => c.text || "").join("") || "";
}

async function parseOptionMetricsFromImage(symbol, imageDataUrl) {
  if (!process.env.OPENAI_API_KEY) throw new Error("未配置截图解析服务，请先手动录入。");
  const res = await timedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5",
      input: [
        { role: "system", content: [{ type: "input_text", text: "你是一个严格的截图字段提取器。请从用户上传的 Barchart Options Overview 截图中，尽量提取以下字段，返回 JSON，不要任何解释：iv,hv,ivPercentile,ivRank,expectedMove,expectedMovePct,expectedRangeLow,expectedRangeHigh,putCallVolRatio,putCallOiRatio,todayVolume,volumeAvg30,todayOpenInterest,openInterest30。无法识别的字段返回空字符串。" }] },
        { role: "user", content: [{ type: "input_text", text: `标的：${symbol || "未提供"}` }, { type: "input_image", image_url: imageDataUrl, detail: "low" }] },
      ],
    }),
  }, 30000);
  if (!res.ok) {
    if (res.status === 429) throw new Error("截图解析服务当前较忙，请稍后重试，或先手动录入关键字段。");
    throw new Error(`截图解析失败：${res.status}`);
  }
  const json = await res.json();
  return sanitizeOptionMetrics(parseLooseJson(extractTextFromResponse(json)));
}

function buildPrompt({ symbol, market, optionMetricsText, stockpriceSnapshot, newsText, klineStatsFormatted, notes }) {
  const target = row(stockpriceSnapshot, symbol);
  return `你是一个专门帮助美股卖Put交易者做综合决策的分析助手。

请根据以下所有信息，生成一份完整的卖Put决策分析报告。

## 用户标的
- 标的：${symbol}
- 市场：${market || "us"}
- 当前价格：${target?.last ?? "未取到"}
- 日变化：${pct(target?.changePct)}

## 期权温度数据
${optionMetricsText || "用户未提供期权温度数据，请根据市场环境和技术面给出一般性建议。"}

## 市场行情快照
${marketRisk(stockpriceSnapshot, symbol).summary}

## 最新24小时新闻要点
${newsText || "暂无新闻数据。"}

## K线技术分析
${klineStatsFormatted || "暂无K线数据。"}

${notes ? `## 用户补充关注点\n${notes}` : ""}

## 报告生成要求

请生成一份结构完整的 HTML 代码（不要包 markdown 代码块 \`\`\`），包含以下章节：

<section class="section hero-judgement">
  <h2>综合结论</h2>
  — 立即回答"当前卖Put有利/谨慎/不利"
  — 用一句话总结核心判断理由
</section>

<section class="section">
  <h2>市场环境</h2>
  — 基于行情快照和新闻的宏观判断
  — VIX、QQQ、SMH、DXY、10Y等关键信号
  — 当前是否适合卖Put
</section>

<section class="section">
  <h2>期权温度解读</h2>
  — IV vs HV 对比
  — IV Percentile / IV Rank 位置
  — Put/Call Ratio 信号
  — Expected Move 安全垫评估
  — 是否存在恐慌溢价
</section>

<section class="section">
  <h2>K线技术信号</h2>
  — 趋势方向判断（基于均线排列、价格位置）
  — 检测到的K线形态及含义
  — 支撑/阻力位
  — ATR波动分析
  — 量价配合情况
</section>

<section class="section">
  <h2>综合卖Put建议</h2>
  — 动作建议（可卖/谨慎卖/暂不卖）
  — 关键风险点
  — 如果必须操作的注意事项
  — 建议的行权价参考区间（基于支撑位和ATR）
</section>

<section class="section">
  <h2>未来3-5个交易日关注清单</h2>
  — 需要盯的关键事件或数据
  — 可能改变判断的信号
</section>

样式要求（直接用内联style，不要用class）：
- 小节标题(h2)颜色: #ffd54a (金黄色)
- 关键指标使用高亮色：涨/偏多用 #45d483 (绿色)，跌/偏空用 #ff6b7d (红色)，中性/警告用 #ffd54a (黄色)
- 每个分析要点前用 🔹 或其他符号区分
- 表格边框色: #314566
- 背景深色为主，文字浅色 #e8eefc
- 整体在 <div class="page"> 内部

语气要求：
- 务实、不写空话
- 面向卖Put交易者
- 明确区分事实判断和主观推测
- 风险点必须明确指出`;
}

async function callAI(symbol, prompt) {
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
      const res = await timedFetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2 }),
      }, 60000);
      if (res.ok) {
        const json = await res.json();
        const html = json?.choices?.[0]?.message?.content?.trim() || "";
        if (html) return { provider: "DeepSeek", html };
      }
    } catch (e) { /* fall through */ }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await timedFetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5",
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        }),
      }, 60000);
      if (res.ok) {
        const json = await res.json();
        const html = extractTextFromResponse(json).trim();
        if (html) return { provider: "GPT", html };
      }
    } catch (e) { /* fall through */ }
  }
  return { provider: "规则版", html: "" };
}

function buildRuleHtml(symbol, market, risk, klineStats, optionMetricsText, snapshot) {
  const stanceClass = risk.putStance === "有利" ? "good" : risk.putStance === "谨慎" ? "warn" : "bad";
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeHtml(symbol)} 综合卖Put决策</title>
<style>
  :root { --bg:#0f172a; --panel:#17233a; --line:#314566; --text:#e8eefc; --muted:#94a3b8; --gold:#ffd54a; --blue:#60a5fa; --green:#45d483; --red:#ff6b7d; }
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.65}
  .page{max-width:1160px;margin:0 auto;padding:28px}
  h1{font-size:38px;line-height:1.1;margin:0 0 12px;color:var(--gold)}
  h2{font-size:26px;margin:32px 0 14px;color:var(--gold);border-bottom:1px solid var(--line);padding-bottom:8px}
  h3{font-size:20px;margin:20px 0 10px;color:#b0c4e8}
  p{margin:0 0 12px;line-height:1.7}
  .hero{background:linear-gradient(180deg,#17233a 0%,#131d31 100%);border:1px solid var(--line);border-radius:24px;padding:28px;margin-bottom:24px}
  .section{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:18px}
  .up{color:var(--red);font-weight:700} .dn{color:var(--green);font-weight:700} .warn{color:var(--gold);font-weight:700}
  .good{color:var(--green);font-weight:800} .bad{color:var(--red);font-weight:800}
  .highlight{color:var(--blue);font-weight:800}
  .meta{color:var(--muted);font-size:14px}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
  .chip{border:1px solid #334155;background:#1d2943;color:#dce7fb;border-radius:999px;padding:8px 14px;font-weight:700;font-size:14px}
  table{width:100%;border-collapse:collapse;margin:12px 0;border-radius:12px;overflow:hidden;font-size:14px}
  th,td{border:1px solid var(--line);padding:10px 12px;text-align:left}
  th{background:#22304d}
  ul{margin:8px 0;padding-left:20px} li{margin-bottom:6px}
</style></head>
<body><div class="page">
<section class="hero">
  <h1>${safeHtml(symbol)} 综合卖Put决策</h1>
  <p class="meta">${safeHtml(market.toUpperCase())} · 规则版报告（AI暂不可用）</p>
  <div class="chips">
    <span class="chip">卖Put环境：${safeHtml(risk.putStance)}</span>
    <span class="chip">黑天鹅灯号：${safeHtml(risk.blackSwan)}</span>
    <span class="chip">风险评分：${safeHtml(risk.riskScore)}/10</span>
  </div>
</section>

<section class="section">
  <h2>综合结论</h2>
  <p><span class="highlight">当前卖Put：</span><span class="${stanceClass}">${safeHtml(risk.putStance)}</span></p>
  <p><span class="highlight">市场环境：</span>${risk.summary}</p>
  <p><span class="highlight">规则版说明：</span>AI暂不可用，以下基于规则引擎判断。建议结合截图期权数据综合评估。</p>
</section>

<section class="section">
  <h2>市场环境过滤</h2>
  <p>${risk.summary}</p>
  <p><span class="highlight">风险评分：</span>${safeHtml(risk.riskScore)}/10 | <span class="highlight">卖Put判定：</span><span class="${stanceClass}">${safeHtml(risk.putStance)}</span></p>
</section>

${klineStats ? `
<section class="section">
  <h2>K线技术信号（规则版）</h2>
  <p><span class="highlight">最新收盘：</span>${safeHtml(klineStats.lastClose)} | <span class="highlight">ATR(14)：</span>${safeHtml(klineStats.atr)} | <span class="highlight">ATR占比：</span>${safeHtml(klineStats.atrPct)}%</p>
  <p><span class="highlight">涨幅：</span>1日 ${safeHtml(klineStats.returns.d1?.toFixed(2) ?? "N/A")}% | 5日 ${safeHtml(klineStats.returns.d5?.toFixed(2) ?? "N/A")}% | 20日 ${safeHtml(klineStats.returns.d20?.toFixed(2) ?? "N/A")}%</p>
  <p><span class="highlight">支撑区间：</span>${safeHtml(klineStats.supportMin)} ~ ${safeHtml(klineStats.supportMax)}</p>
  <p><span class="highlight">阻力区间：</span>${safeHtml(klineStats.resistanceMin)} ~ ${safeHtml(klineStats.resistanceMax)}</p>
  ${klineStats.patterns.length ? `<p><span class="highlight">检测K线形态：</span>${safeHtml(klineStats.patterns.join("、"))}</p>` : ""}
  <p><span class="highlight">规则说明：</span>基于最近3个月日线数据计算，仅作为辅助参考。完整分析需要AI支持。</p>
</section>` : ""}

${optionMetricsText ? `
<section class="section">
  <h2>期权温度数据</h2>
  <pre style="background:#0a0f1a;padding:14px;border-radius:10px;overflow-x:auto;font-size:13px;color:#b0c4e8">${safeHtml(optionMetricsText)}</pre>
</section>` : ""}

<section class="section">
  <h2>规则版卖Put建议</h2>
  <ul>
    <li><span class="highlight">${safeHtml(symbol)} 当前市场环境${safeHtml(risk.putStance)}：</span>${risk.putStance === "有利" ? "风险评分偏低，市场环境相对稳定，可考虑卖Put，但需结合期权IV/HV判断。" : risk.putStance === "谨慎" ? "风险评分中等，市场存在不确定性，建议减少仓位或选择更虚值行权价。" : "风险评分偏高，VIX/半导体/国债收益率等信号偏空，建议等待市场稳定。"}</li>
    <li>期权温度数据（如有截图录入）应重点观察：IV是否高于HV、IV Percentile是否处于高位、Expected Move是否提供足够安全垫。</li>
    <li>K线支撑位可作为行权价参考，ATR安全行权价 = 当前价 - 1.5 × ATR。</li>
    <li>建议结合新闻事件日历判断未来3-5天的尾部风险。</li>
  </ul>
</section>

<table><thead><tr><th>标的</th><th>价格</th><th>变化</th><th>来源</th><th>行情时间</th></tr></thead><tbody>${focusTable(snapshot, symbol)}</tbody></table>
</div></body></html>`;
}

function buildAiReportWrapper(symbol, market, risk, aiHtml, snapshot) {
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeHtml(symbol)} 综合卖Put决策</title>
<style>
  :root { --bg:#0f172a; --panel:#17233a; --line:#314566; --text:#e8eefc; --muted:#94a3b8; --gold:#ffd54a; --blue:#60a5fa; --green:#45d483; --red:#ff6b7d; --dn:#45d483; --up:#ff6b7d; }
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.65}
  .page{max-width:1160px;margin:0 auto;padding:28px}
  h1{font-size:38px;line-height:1.1;margin:0 0 12px;color:var(--gold)}
  h2{font-size:24px;margin:24px 0 14px;color:var(--gold);padding-bottom:6px;border-bottom:1px solid var(--line)}
  p{margin:0 0 10px;line-height:1.7}
  .meta{color:var(--muted);font-size:14px}
  .hero{background:linear-gradient(180deg,#17233a 0%,#131d31 100%);border:1px solid var(--line);border-radius:24px;padding:28px;margin-bottom:20px}
  .section{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:18px}
  .hero-judgement{border-left:6px solid ${risk.putStance === "有利" ? "var(--dn)" : risk.putStance === "谨慎" ? "var(--gold)" : "var(--up)"};background:#1b2741}
  .up{color:var(--up);font-weight:700} .dn{color:var(--dn);font-weight:700} .warn{color:var(--gold);font-weight:700}
  .good{color:var(--dn);font-weight:800} .bad{color:var(--up);font-weight:800}
  .highlight{color:var(--blue);font-weight:800}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
  .chip{border:1px solid #334155;background:#1d2943;color:#dce7fb;border-radius:999px;padding:8px 14px;font-weight:700;font-size:14px}
  table{width:100%;border-collapse:collapse;margin:12px 0;border-radius:12px;overflow:hidden;font-size:14px}
  th,td{border:1px solid var(--line);padding:10px 12px;text-align:left}
  th{background:#22304d}
  ul{margin:8px 0;padding-left:20px} li{margin-bottom:6px}
  details{margin:16px 0} details>summary{cursor:pointer;font-size:15px;font-weight:700;color:var(--muted);padding:10px 14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;list-style:none}
  details>summary::-webkit-details-marker{display:none} details>summary::before{content:"▸ "} details[open]>summary::before{content:"▾ "}
</style></head>
<body><div class="page">
<section class="hero">
  <h1>${safeHtml(symbol)} 综合卖Put决策</h1>
  <p class="meta">${safeHtml(market.toUpperCase())} · 综合新闻/行情/K线/期权数据</p>
  <div class="chips">
    <span class="chip">卖Put环境：${safeHtml(risk.putStance)}</span>
    <span class="chip">黑天鹅灯号：${safeHtml(risk.blackSwan)}</span>
    <span class="chip">风险评分：${safeHtml(risk.riskScore)}/10</span>
  </div>
</section>
${aiHtml}
<details><summary>实时行情快照</summary><div class="section"><table><thead><tr><th>标的</th><th>最新价</th><th>日变化</th><th>来源</th><th>行情时间</th></tr></thead><tbody>${focusTable(snapshot, symbol)}</tbody></table></div></details>
</div></body></html>`;
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  const startTime = Date.now();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const market = String(body.market || "us").trim().toLowerCase();
    const imageDataUrl = String(body.imageDataUrl || "").trim();
    const notes = String(body.notes || "").trim();
    const rawMetrics = (body.optionMetrics && typeof body.optionMetrics === "object") ? body.optionMetrics : {};

    if (!symbol) return sendJson(res, 400, { ok: false, message: "缺少标的代码。" });

    let optionMetrics = sanitizeOptionMetrics(rawMetrics);
    const hasManualMetrics = Object.values(optionMetrics).some((v) => String(v ?? "").trim() !== "");

    if (!hasManualMetrics && imageDataUrl.startsWith("data:image/")) {
      try {
        optionMetrics = await parseOptionMetricsFromImage(symbol, imageDataUrl);
      } catch (ocrError) {
        return sendJson(res, 400, { ok: false, message: ocrError.message || "截图解析失败，请手动录入。" });
      }
    }

    const optionMetricsText = formatOptionMetrics(optionMetrics);

    const [stockpriceSnapshot, newsData] = await Promise.all([
      loadStockpriceSnapshot().catch(() => ({ data: [], checkedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })),
      loadNews().catch(() => ({ items: [], count: 0 })),
    ]);

    const risk = marketRisk(stockpriceSnapshot, symbol);

    const newsText = summarizeNews(newsData.items);

    const klineRaw = await fetchKlineData(symbol);
    const klineStats = Array.isArray(klineRaw) ? computeKlineStats(klineRaw) : null;
    const klineStatsFormatted = formatKlineStats(klineStats);

    const prompt = buildPrompt({
      symbol, market, optionMetricsText,
      stockpriceSnapshot, newsText,
      klineStatsFormatted, notes,
    });

    const ai = await callAI(symbol, prompt);

    const finalHtml = ai.html
      ? buildAiReportWrapper(symbol, market, risk, ai.html, stockpriceSnapshot)
      : buildRuleHtml(symbol, market, risk, klineStats, optionMetricsText, stockpriceSnapshot);

    return sendJson(res, 200, {
      ok: true,
      symbol, market,
      provider: ai.provider,
      used_ai: !!ai.html,
      status: risk.putStance,
      risk_score: risk.riskScore,
      message: ai.html
        ? `综合报告已生成（${ai.provider}）`
        : "AI暂不可用，已生成规则版报告（含K线技术指标）。",
      filename: `${symbol}-sell-put-decision.html`,
      html: finalHtml,
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: error?.name === "AbortError" ? "服务端处理超时，请重试。" : (error?.message || "生成失败"),
    });
  }
}
