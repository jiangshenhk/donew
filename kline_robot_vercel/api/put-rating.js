const STOCKPRICE_SNAPSHOT_URL = "https://raw.githubusercontent.com/jiangshenhk/donew/main/stockprice/data/latest-price.json";
const STOCKPRICE_SNAPSHOT_CACHE_TTL_MS = 10 * 60 * 1000;
const FOCUS_SYMBOLS = [
  { symbol: "QQQ", market: "us" },
  { symbol: "SPY", market: "us" },
  { symbol: "IWM", market: "us" },
  { symbol: "QLD", market: "us" },
  { symbol: "SMH", market: "us" },
  { symbol: "SOXX", market: "us" },
  { symbol: "BTC-USD", market: "crypto" },
  { symbol: "^VIX", market: "us" },
  { symbol: "^TNX", market: "global" },
  { symbol: "DX-Y.NYB", market: "global" },
  { symbol: "IBIT", market: "us" },
  { symbol: "MSTR", market: "us" },
  { symbol: "INTC", market: "us" },
  { symbol: "HOOD", market: "us" },
];
let stockpriceSnapshotCache = null;

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
  res.end(JSON.stringify(payload));
}

async function timedFetch(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(value) {
  const n = numberOrNull(value);
  if (n === null) return "未取到";
  const sign = n > 0 ? "+" : "";
  const cls = n > 0 ? "up" : n < 0 ? "dn" : "";
  return cls ? `<span class="${cls}">${sign}${n.toFixed(2)}%</span>` : `${sign}${n.toFixed(2)}%`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) return "未取到";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false });
}

function symbolLabel(symbol) {
  return {
    "BTC-USD": "BTC",
    "^VIX": "VIX",
    "^TNX": "10Y",
    "DX-Y.NYB": "DXY",
  }[symbol] || symbol;
}

function normalizeRow(item) {
  const last = numberOrNull(item?.last ?? item?.price);
  const previousClose = numberOrNull(item?.previousClose);
  const changePct = numberOrNull(item?.changePct ?? item?.changePercent);
  return {
    symbol: item?.symbol || "",
    last,
    previousClose,
    changePct: changePct ?? (last !== null && previousClose ? (last / previousClose - 1) * 100 : null),
    marketTime: item?.marketTime || "",
    exchange: item?.exchange || item?.marketState || "",
    category: item?.category || "",
    source: item?.source || "",
    error: item?.error || "",
    retrievedAt: item?.retrievedAt || "",
    fetchMode: item?.fetchMode || "live",
    cacheStoredAt: item?.cacheStoredAt || "",
    stockpriceUpdatedAt: item?.stockpriceUpdatedAt || "",
    stockpriceCheckedAt: item?.stockpriceCheckedAt || "",
    currency: item?.currency || "",
    dailyAtr: item?.dailyAtr ?? null,
    weeklyAtr: item?.weeklyAtr ?? null,
  };
}

async function fetchAtrData(symbol, retry = 2) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&events=history&includePrePost=false`;
  try {
    const res = await timedFetch(url, { headers: { "User-Agent": "Mozilla/5.0 donew-put-rating" } }, 10000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("No chart data");
    const timestamps = result?.timestamp || [];
    const quotes = result?.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const bars = [];
    for (let i = 0; i < Math.min(timestamps.length, closes.length); i += 1) {
      const close = numberOrNull(closes[i]);
      const high = numberOrNull(highs[i]);
      const low = numberOrNull(lows[i]);
      const ts = numberOrNull(timestamps[i]);
      if (close === null || ts === null) continue;
      bars.push({ timestamp: ts, close, high: high ?? close, low: low ?? close });
    }
    const dailyAtr = calculateAtr(bars, 14);
    const weekBars = aggregateToWeekly(bars);
    const weeklyAtr = calculateAtr(weekBars, 14);
    return { dailyAtr, weeklyAtr, barCount: bars.length };
  } catch (e) {
    if (retry > 0) { await sleep(2000); return fetchAtrData(symbol, retry - 1); }
    return { dailyAtr: null, weeklyAtr: null, error: e.message };
  }
}

function calculateAtr(bars, period = 14) {
  if (!bars || bars.length < period + 1) return null;
  let trSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trSum += tr;
  }
  let atr = trSum / period;
  for (let i = period + 1; i < bars.length; i += 1) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    atr = (atr * (period - 1) + tr) / period;
  }
  return Number(atr.toFixed(4));
}

function aggregateToWeekly(dailyBarsList) {
  const weekMap = new Map();
  for (const bar of dailyBarsList) {
    const date = new Date(bar.timestamp * 1000);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { high: bar.high, low: bar.low, close: bar.close, bars: 1 });
    } else {
      const week = weekMap.get(weekKey);
      week.high = Math.max(week.high, bar.high);
      week.low = Math.min(week.low, bar.low);
      week.close = bar.close;
      week.bars += 1;
    }
  }
  return Array.from(weekMap.values());
}

function sameSymbol(left, right) {
  return String(left || "").trim().toUpperCase() === String(right || "").trim().toUpperCase();
}

async function loadStockpriceSnapshot() {
  if (stockpriceSnapshotCache && Date.now() - stockpriceSnapshotCache.cachedAt < STOCKPRICE_SNAPSHOT_CACHE_TTL_MS) {
    return {
      ...JSON.parse(JSON.stringify(stockpriceSnapshotCache.payload)),
      fetchMode: "cache",
      cacheServedAt: new Date().toISOString(),
    };
  }
  const res = await timedFetch(STOCKPRICE_SNAPSHOT_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  }, 8000);
  if (!res.ok) throw new Error(`stockprice HTTP ${res.status}`);
  const payload = await res.json();
  if (!payload || !Array.isArray(payload.data)) throw new Error("stockprice snapshot invalid");
  stockpriceSnapshotCache = {
    cachedAt: Date.now(),
    payload: JSON.parse(JSON.stringify(payload)),
  };
  return {
    ...JSON.parse(JSON.stringify(payload)),
    fetchMode: "live",
    cacheServedAt: new Date().toISOString(),
  };
}

function stockpriceRow(snapshot, symbol) {
  if (!snapshot?.data?.length) return null;
  return snapshot.data.find((item) => String(item?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase()) || null;
}

function normalizeStockpriceRow(item, snapshotMeta) {
  if (!item) return null;
  return normalizeRow({
    symbol: item.symbol,
    price: item.price,
    previousClose: item.previousClose,
    changePercent: item.changePercent,
    marketTime: item.marketTime || "",
    exchange: item.exchange || "STOCKPRICE",
    category: item.category || "",
    source: "stockprice",
    retrievedAt: snapshotMeta?.checkedAt || snapshotMeta?.updatedAt || new Date().toISOString(),
    fetchMode: snapshotMeta?.fetchMode === "cache" ? "cache" : "live",
    cacheStoredAt: snapshotMeta?.cacheServedAt || snapshotMeta?.checkedAt || snapshotMeta?.updatedAt || new Date().toISOString(),
    stockpriceUpdatedAt: snapshotMeta?.updatedAt || "",
    stockpriceCheckedAt: snapshotMeta?.checkedAt || "",
    currency: item.currency || "",
    dailyAtr: item?.dailyAtr ?? null,
    weeklyAtr: item?.weeklyAtr ?? null,
  });
}

async function loadSnapshot(targetSymbol, targetMarket) {
  const items = [];
  let stockpriceSnapshot = null;
  let stockpriceSnapshotError = "";
  try {
    stockpriceSnapshot = await loadStockpriceSnapshot();
  } catch (snapshotError) {
    stockpriceSnapshotError = snapshotError?.message || "stockprice unavailable";
  }
  const queue = [
    { symbol: targetSymbol, market: targetMarket },
    ...FOCUS_SYMBOLS.filter((item) => !sameSymbol(item.symbol, targetSymbol)),
  ];
  for (const item of queue) {
    const primary = normalizeStockpriceRow(stockpriceRow(stockpriceSnapshot, item.symbol), stockpriceSnapshot);
    if (primary) {
      items.push(primary);
    } else {
      items.push(normalizeRow({
        symbol: item.symbol,
        last: null,
        previousClose: null,
        changePct: null,
        marketTime: "",
        exchange: "STOCKPRICE",
        category: "",
        source: "stockprice",
        error: stockpriceSnapshotError || "stockprice missing",
        retrievedAt: stockpriceSnapshot?.checkedAt || stockpriceSnapshot?.updatedAt || new Date().toISOString(),
        fetchMode: stockpriceSnapshot?.fetchMode === "cache" ? "cache" : "live",
        cacheStoredAt: stockpriceSnapshot?.cacheServedAt || stockpriceSnapshot?.checkedAt || stockpriceSnapshot?.updatedAt || new Date().toISOString(),
      }));
    }
  }
  let atrData = { dailyAtr: null, weeklyAtr: null };
  try {
    atrData = await fetchAtrData(targetSymbol);
  } catch (atrError) {
    atrData = { dailyAtr: null, weeklyAtr: null, error: atrError?.message };
  }
  const targetItem = items.find((item) => sameSymbol(item.symbol, targetSymbol));
  if (targetItem) {
    targetItem.dailyAtr = atrData.dailyAtr;
    targetItem.weeklyAtr = atrData.weeklyAtr;
  }
  return {
    checkedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: items,
    __meta: {
      stockpriceUpdatedAt: stockpriceSnapshot?.updatedAt || "",
      stockpriceCheckedAt: stockpriceSnapshot?.checkedAt || "",
      stockpriceFetchMode: stockpriceSnapshot?.fetchMode || "",
      stockpriceCacheServedAt: stockpriceSnapshot?.cacheServedAt || "",
      stockpriceError: stockpriceSnapshotError,
      atrDaily: atrData.dailyAtr,
      atrWeekly: atrData.weeklyAtr,
      atrError: atrData.error || "",
    },
  };
}

function row(snapshot, symbol) {
  const item = (snapshot.data || []).find((entry) => String(entry?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase());
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

  const downside = risk >= 7.5 ? "高（偏向再定价 / 跳空风险）" : risk >= 6.2 ? "中（仍需防突然转弱）" : "低（但不是无风险）";
  const putStance = risk >= 7.5 ? "不利" : risk >= 6.2 ? "谨慎" : "有利";
  const panicPremium = risk >= 7.5 ? "更像风险预警，不是舒服的恐慌溢价" : risk >= 6.2 ? "可能有一点溢价，但要防权利金陷阱" : "如果 IV 端配合，高概率是真溢价窗口";
  const blackSwan = risk >= 7.5 ? "🔴 高警戒" : risk >= 6.2 ? "🟡 需防范" : "🟢 常规防守";

  return {
    riskScore: risk.toFixed(1),
    downside,
    putStance,
    panicPremium,
    blackSwan,
    summary: `QQQ ${pct(qqq.changePct)} / SPY ${pct(spy.changePct)} / SMH ${pct(smh.changePct)} / VIX ${pct(vix.changePct)} / 10Y ${pct(tnx.changePct)} / DXY ${pct(dxy.changePct)} / BTC ${pct(btc.changePct)}`,
  };
}

function focusTable(snapshot, targetSymbol) {
  const symbols = Array.from(new Set([targetSymbol, ...FOCUS_SYMBOLS.map((item) => item.symbol)]));
  return symbols.map((symbol) => {
    const item = row(snapshot, symbol);
    const dailyAtrStr = item.dailyAtr != null ? item.dailyAtr.toFixed(2) : "-";
    const weeklyAtrStr = item.weeklyAtr != null ? item.weeklyAtr.toFixed(2) : "-";
    return `<tr><td>${safeHtml(symbolLabel(symbol))}</td><td>${item.last === null ? "未取到" : safeHtml(item.last.toFixed(2))}</td><td>${safeHtml(pct(item.changePct))}</td><td>${safeHtml(dailyAtrStr)}</td><td>${safeHtml(weeklyAtrStr)}</td><td>${safeHtml(item.exchange || "-")}</td><td>${safeHtml(formatDateTime(item.marketTime))}</td></tr>`;
  }).join("");
}

function formatSourceLabel(source) {
  if (!source) return "未取到";
  if (source === "stockprice") return "StockPrice Center";
  return source;
}

function formatSourceNote(error) {
  const text = String(error || "").trim();
  if (!text) return "-";
  if (/stockprice missing/i.test(text)) return "统一行情中心未取到";
  if (/stockprice/i.test(text) && /HTTP/i.test(text)) return "行情中心读取失败";
  return text;
}

function dataSourceRows(snapshot, targetSymbol) {
  const symbols = Array.from(new Set([targetSymbol, ...FOCUS_SYMBOLS.map((item) => item.symbol)]));
  return symbols.map((symbol) => {
    const item = row(snapshot, symbol);
    const status = item.last === null ? "缺失" : (item.source === "stockprice" ? "回退" : "正常");
    return `<tr><td>${safeHtml(symbolLabel(symbol))}</td><td>${safeHtml(formatSourceLabel(item.source))}</td><td>${safeHtml(item.fetchMode === "cache" ? "缓存" : "实时")}</td><td>${safeHtml(formatDateTime(item.cacheStoredAt || item.retrievedAt))}</td><td>${safeHtml(formatDateTime(item.marketTime))}</td><td>${safeHtml(status)}</td><td>${safeHtml(formatSourceNote(item.error))}</td></tr>`;
  }).join("");
}

function dataSourceDetailsBlock(snapshot, targetSymbol) {
  const meta = snapshot.__meta || {};
  return `
<details>
  <summary>数据来源与行情时间</summary>
  <p>本文行情统一只读取 <code>stockprice/data/latest-price.json</code>，不再额外请求外部实时行情源。</p>
  <p>行情中心文件更新时间：${safeHtml(formatDateTime(meta.stockpriceUpdatedAt))}；行情中心读取时间：${safeHtml(formatDateTime(meta.stockpriceCheckedAt || meta.stockpriceCacheServedAt))}；行情中心读取模式：${safeHtml(meta.stockpriceFetchMode === "cache" ? "缓存" : meta.stockpriceFetchMode ? "实时" : "未使用")}。</p>
  <table>
    <thead>
      <tr><th>指标</th><th>实际来源</th><th>方式</th><th>数据获取时间</th><th>行情时间</th><th>状态</th><th>备注</th></tr>
    </thead>
    <tbody>
      ${dataSourceRows(snapshot, targetSymbol)}
    </tbody>
  </table>
</details>`.trim();
}

function formatOptionMetrics(metrics = {}) {
  const entries = [
    ["IV", metrics.iv, "%"],
    ["HV", metrics.hv, "%"],
    ["IV Percentile", metrics.ivPercentile, "%"],
    ["IV Rank", metrics.ivRank, "%"],
    ["Expected Move", metrics.expectedMove, ""],
    ["Expected Move %", metrics.expectedMovePct, "%"],
    ["Expected Range Low", metrics.expectedRangeLow, ""],
    ["Expected Range High", metrics.expectedRangeHigh, ""],
    ["Put/Call Vol Ratio", metrics.putCallVolRatio, ""],
    ["Put/Call OI Ratio", metrics.putCallOiRatio, ""],
    ["Today's Volume", metrics.todayVolume, ""],
    ["Volume Avg 30D", metrics.volumeAvg30, ""],
    ["Today's Open Interest", metrics.todayOpenInterest, ""],
    ["Open Int 30D", metrics.openInterest30, ""],
    ["IV High", metrics.ivHigh, "%"],
    ["IV Low", metrics.ivLow, "%"],
  ];
  return entries
    .filter(([, value]) => String(value ?? "").trim() !== "")
    .map(([label, value, suffix]) => `${label}: ${String(value).trim()}${suffix}`)
    .join("\n");
}

function normalizeMetricValue(value) {
  return String(value ?? "").trim();
}

function sanitizeOptionMetrics(raw = {}) {
  return {
    iv: normalizeMetricValue(raw.iv),
    hv: normalizeMetricValue(raw.hv),
    ivPercentile: normalizeMetricValue(raw.ivPercentile),
    ivRank: normalizeMetricValue(raw.ivRank),
    expectedMove: normalizeMetricValue(raw.expectedMove),
    expectedMovePct: normalizeMetricValue(raw.expectedMovePct),
    expectedRangeLow: normalizeMetricValue(raw.expectedRangeLow),
    expectedRangeHigh: normalizeMetricValue(raw.expectedRangeHigh),
    putCallVolRatio: normalizeMetricValue(raw.putCallVolRatio),
    putCallOiRatio: normalizeMetricValue(raw.putCallOiRatio),
    todayVolume: normalizeMetricValue(raw.todayVolume),
    volumeAvg30: normalizeMetricValue(raw.volumeAvg30),
    todayOpenInterest: normalizeMetricValue(raw.todayOpenInterest),
    openInterest30: normalizeMetricValue(raw.openInterest30),
    ivHigh: normalizeMetricValue(raw.ivHigh),
    ivLow: normalizeMetricValue(raw.ivLow),
  };
}

function parseLooseJson(text) {
  const source = String(text || "").trim();
  if (!source) throw new Error("解析服务未返回内容。");
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : source;
  return JSON.parse(candidate);
}

async function parseOptionMetricsFromImage(symbol, imageDataUrl) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("未配置截图解析服务，请先手动录入。");
  }
  const res = await timedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "你是一个严格的截图字段提取器。请从用户上传的 Barchart Options Overview 截图中，尽量提取以下字段，返回 JSON，不要任何解释：iv,hv,ivPercentile,ivRank,expectedMove,expectedMovePct,expectedRangeLow,expectedRangeHigh,putCallVolRatio,putCallOiRatio,todayVolume,volumeAvg30,todayOpenInterest,openInterest30,ivHigh,ivLow。无法识别的字段返回空字符串。",
            },
          ],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: `标的：${symbol || "未提供"}` },
            { type: "input_image", image_url: imageDataUrl, detail: "low" },
          ],
        },
      ],
    }),
  }, 30000);
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).trim();
    if (res.status === 429) {
      throw new Error("截图解析服务当前较忙，请稍后重试，或先手动录入关键字段。");
    }
    if (detail.includes("image") && detail.includes("not support")) {
      throw new Error("当前AI模型不支持图片识别，请手动录入字段，或使用本地OCR识别。");
    }
    throw new Error(`截图解析失败：${res.status}`);
  }
  const json = await res.json();
  return sanitizeOptionMetrics(parseLooseJson(extractTextFromResponse(json)));
}

function extractTextFromResponse(json) {
  return json?.output_text
    || (json?.output || []).flatMap((item) => item.content || []).map((c) => c.text || "").join("")
    || "";
}

function analyzeAtrVsPut(target, optionMetrics) {
  const price = target?.last;
  const dailyAtr = target?.dailyAtr;
  if (price == null || dailyAtr == null || price <= 0 || dailyAtr <= 0) {
    return { hasData: false, atrPct: null, safeStrike: null, atrSafetyMargin: null, atrSuitability: "" };
  }
  const atrPct = (dailyAtr / price) * 100;
  const safeStrike = price - 1.5 * dailyAtr;
  let atrSuitability = "";
  if (atrPct < 1.5) atrSuitability = "低波动，权利金较少但价格相对稳定";
  else if (atrPct <= 4) atrSuitability = "波动适中，适合卖Put";
  else if (atrPct <= 6) atrSuitability = "波动偏高，权利金丰厚但风险较大";
  else atrSuitability = "波动过高，需卖更低行权价或减少仓位";
  let atrSafetyMargin = null;
  let marginNote = "";
  const targetStrike = numberOrNull(optionMetrics?.targetStrike);
  const expiryDate = optionMetrics?.expiryDate || "";
  if (targetStrike != null && targetStrike > 0) {
    const strikeGap = targetStrike - safeStrike;
    const strikeGapPct = ((strikeGap / safeStrike) * 100).toFixed(2);
    if (targetStrike > safeStrike) {
      marginNote = `你选择的行权价($${targetStrike.toFixed(2)})高于ATR安全行权价($${safeStrike.toFixed(2)})，安全垫偏薄，需注意风险`;
    } else {
      marginNote = `你选择的行权价($${targetStrike.toFixed(2)})低于ATR安全行权价($${safeStrike.toFixed(2)})，ATR提供额外${Math.abs(strikeGapPct)}%安全垫`;
    }
  }
  return {
    hasData: true,
    atrPct: atrPct.toFixed(2),
    safeStrike: safeStrike.toFixed(2),
    atrSafetyMargin,
    marginNote,
    atrSuitability,
    targetStrike: targetStrike?.toFixed(2) || null,
    expiryDate: expiryDate || null,
  };
}

function promptText(payload, snapshot, risk) {
  const target = row(snapshot, payload.symbol);
  const optionMetricsText = formatOptionMetrics(payload.optionMetrics);
  const atrAnalysis = analyzeAtrVsPut(target, payload.optionMetrics);
  const atrInfo = [];
  if (target?.dailyAtr != null) atrInfo.push(`日线ATR(14)：${target.dailyAtr}`);
  if (target?.weeklyAtr != null) atrInfo.push(`周线ATR(14)：${target.weeklyAtr}`);
  if (atrAnalysis.hasData) {
    atrInfo.push(`ATR占价格比例：${atrAnalysis.atrPct}%`);
    atrInfo.push(`ATR安全行权价(当前价-1.5×ATR)：${atrAnalysis.safeStrike}`);
    atrInfo.push(`ATR适用性评估：${atrAnalysis.atrSuitability}`);
  }
  const marketInfo = [
    `标的：${payload.symbol}`,
    `市场：${payload.market || "us"}`,
    `当前价格：${target.last ?? "未取到"}`,
    `日变化：${pct(target.changePct)}`,
    atrInfo.length ? `ATR波动指标：\n${atrInfo.join("\n")}` : "",
    `市场环境风险评分：${risk.riskScore}/10`,
    `市场环境概览：${risk.summary}`,
    `卖Put环境初判：${risk.putStance}`,
    `黑天鹅灯号：${risk.blackSwan}`,
    optionMetricsText ? `用户录入的期权温度数据：\n${optionMetricsText}` : "",
    payload.notes ? `用户补充关注点：${payload.notes}` : "",
  ].join("\n");

  return `你是一个专门帮用户判断“当前卖Put是否有利”的美股期权研究助手。

任务：
1. 阅读用户手动录入的 Barchart Options Overview 关键字段；
2. 重点评估 IV、HV、IV Percentile、IV Rank、Expected Move、Expected Range、Put/Call Ratio、Open Interest；
3. 结合下面给你的市场快照，判断当前卖Put到底是：
   - 有利（是真正的恐慌溢价）
   - 谨慎（有溢价，但容易变成陷阱）
   - 不利（更像风险预警，不值得拿这点权利金）

请严格输出 HTML 片段，不要输出 Markdown，不要包 \`\`\`。

结构固定为：
<section class="section hero-judgement">...</section>
<section class="section">
  <h2>期权温度怎么读</h2>
  ...
</section>
<section class="section">
  <h2>市场环境过滤</h2>
  ...
</section>
<section class="section">
  <h2>卖Put动作建议</h2>
  ...
</section>

具体要求：
- 第一段必须给结论，直接回答“当前卖Put有利 / 谨慎 / 不利”；
- 明确回答“这是不是恐慌溢价”；
- 明确回答“未来3-5个交易日的大跌/跳空风险高不高”；
- 不给具体 strike，不做期权链选价；
- 语气务实，不写空话；
- 重点服务 Sell Put：权利金值不值得冒尾部风险。

你可参考的市场背景：
${marketInfo}`;
}

async function callOpenAI(payload, snapshot, risk) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      used: false,
      provider: "GPT",
      html: "",
      message: "未配置 OPENAI_API_KEY，返回规则版报告。",
    };
  }
  const res = await timedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        { role: "system", content: promptText(payload, snapshot, risk) },
        {
          role: "user",
          content: [
            { type: "input_text", text: `请根据 ${payload.symbol} 的 Barchart Options Overview 手工录入字段，并结合市场快照给出卖Put判断。\n\n${formatOptionMetrics(payload.optionMetrics)}` },
          ],
        },
      ],
    }),
  }, 25000);

  if (!res.ok) {
    return {
      used: false,
      provider: "GPT",
      html: "",
      message: `GPT 调用失败：${res.status}`,
    };
  }
  const json = await res.json();
  return {
    used: true,
    provider: "GPT",
    html: extractTextFromResponse(json).trim(),
    message: "已调用 GPT 读取截图并生成卖Put判断。",
  };
}

async function callDeepSeek(payload, snapshot, risk) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      used: false,
      provider: "DeepSeek",
      html: "",
      message: "未配置 DEEPSEEK_API_KEY，返回规则版报告。",
    };
  }
  const model = process.env.DEEPSEEK_VISION_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const res = await timedFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: promptText(payload, snapshot, risk) },
        {
          role: "user",
          content: `请根据 ${payload.symbol} 的 Barchart Options Overview 手工录入字段，并结合市场快照给出卖Put判断。\n\n${formatOptionMetrics(payload.optionMetrics)}`,
        },
      ],
      temperature: 0.2,
    }),
  }, 25000);

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).trim();
    return {
      used: false,
      provider: "DeepSeek",
      html: "",
      message: detail ? `DeepSeek 调用失败：${res.status}` : `DeepSeek 调用失败：${res.status}`,
    };
  }
  const json = await res.json();
  const html = json?.choices?.[0]?.message?.content?.trim() || "";
  if (!html) {
    return {
      used: false,
      provider: "DeepSeek",
      html: "",
      message: "DeepSeek 未返回有效识图结果。",
    };
  }
  return {
    used: true,
    provider: "DeepSeek",
    html,
    message: "已调用 DeepSeek 读取截图并生成卖Put判断。",
  };
}

async function callAI(payload, snapshot, risk) {
  if (String(payload.provider || "deepseek").toLowerCase() === "openai") return callOpenAI(payload, snapshot, risk);
  const deepseek = await callDeepSeek(payload, snapshot, risk);
  if (deepseek.used) return deepseek;
  if (process.env.OPENAI_API_KEY) {
    const openai = await callOpenAI(payload, snapshot, risk);
    if (openai.used) {
      return {
        ...openai,
        provider: "DeepSeek -> GPT",
        message: "DeepSeek 识图失败，已自动切换 GPT 继续生成报告。",
      };
    }
  }
  return {
    used: false,
    provider: "规则版",
    html: "",
    message: "AI 识图暂不可用，本次已切换为规则版判断。",
  };
}

function ruleHtml(payload, snapshot, risk, aiMessage = "") {
  const target = row(snapshot, payload.symbol);
  const stanceClass = risk.putStance === "有利" ? "good" : risk.putStance === "谨慎" ? "warn" : "bad";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeHtml(payload.symbol)} 卖Put温度判断</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #17233a;
      --panel-soft: #22304d;
      --line: #314566;
      --text: #e8eefc;
      --muted: #94a3b8;
      --gold: #ffd54a;
      --blue: #60a5fa;
      --green: #45d483;
      --red: #ff6b7d;
      --dn: #45d483;
      --up: #ff6b7d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.65;
    }
    .page { max-width: 1160px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 44px; line-height: 1.1; margin: 0 0 12px; color: var(--gold); }
    h2 { font-size: 28px; margin: 0 0 14px; color: var(--blue); }
    p { margin: 0 0 14px; }
    .meta, .status { color: var(--muted); font-size: 15px; }
    .hero {
      background: linear-gradient(180deg, #17233a 0%, #131d31 100%);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      margin-bottom: 20px;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .chip {
      border: 1px solid #334155;
      background: #1d2943;
      color: #dce7fb;
      border-radius: 999px;
      padding: 8px 14px;
      font-weight: 700;
      font-size: 14px;
    }
    .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 24px;
      margin-bottom: 18px;
    }
    .hero-judgement {
      border-left: 6px solid ${risk.putStance === "有利" ? "var(--dn)" : risk.putStance === "谨慎" ? "var(--gold)" : "var(--up)"};
      background: #1b2741;
    }
    .decision {
      display: inline-block;
      padding: 10px 14px;
      border-radius: 14px;
      font-weight: 800;
      font-size: 18px;
      background: ${risk.putStance === "有利" ? "rgba(69,212,131,.16)" : risk.putStance === "谨慎" ? "rgba(255,213,74,.16)" : "rgba(255,107,125,.16)"};
      color: ${risk.putStance === "有利" ? "var(--dn)" : risk.putStance === "谨慎" ? "var(--gold)" : "var(--up)"};
    }
    .highlight { color: var(--blue); font-weight: 800; }
    .good { color: var(--dn); font-weight: 800; }
    .warn { color: var(--gold); font-weight: 800; }
    .bad { color: var(--up); font-weight: 800; }
    .up { color: var(--up); font-weight: 700; }
    .dn { color: var(--dn); font-weight: 700; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      overflow: hidden;
      border-radius: 16px;
      font-size: 15px;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 12px 14px;
      text-align: left;
      vertical-align: top;
    }
    th { background: var(--panel-soft); }
    details { margin-bottom: 18px; }
    details > summary {
      cursor: pointer;
      font-size: 16px;
      font-weight: 700;
      color: var(--muted);
      padding: 14px 18px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      list-style: none;
    }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before { content: "▸ "; }
    details[open] > summary::before { content: "▾ "; }
    details > .section { margin-top: 12px; margin-bottom: 0; border: none; padding: 0; background: none; }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${safeHtml(payload.symbol)}｜卖Put温度判断</h1>
      <p class="meta">${safeHtml(payload.market.toUpperCase())} 市场 · 截图来源：Barchart Options Overview · 实时行情读取时间：${safeHtml(formatDateTime(snapshot.checkedAt || snapshot.updatedAt))}</p>
      <div class="chips">
        <span class="chip">卖Put环境：${safeHtml(risk.putStance)}</span>
        <span class="chip">黑天鹅灯号：${safeHtml(risk.blackSwan)}</span>
        <span class="chip">风险评分：${safeHtml(risk.riskScore)}/10</span>
      </div>
    </section>

    <section class="section hero-judgement">
      <h2>当前结论</h2>
      <p><span class="decision">${safeHtml(payload.symbol)} 当前卖Put：${safeHtml(risk.putStance)}</span></p>
      <p><span class="highlight">这是不是恐慌溢价？</span> ${safeHtml(risk.panicPremium)}</p>
      <p><span class="highlight">未来3-5个交易日的大跌/跳空风险：</span> ${safeHtml(risk.downside)}</p>
      <p><span class="highlight">一句话动作：</span> ${safeHtml(risk.putStance === "有利" ? "可以筛选，但只拿你愿意接货的标的。" : risk.putStance === "谨慎" ? "只允许极远OTM、小仓、分批，重点防跳空。" : "先不为这点权利金暴露尾部风险。")}</p>
    </section>

    ${aiMessage ? `<section class="section"><h2>AI 说明</h2><p class="status">${safeHtml(aiMessage)}</p></section>` : ""}

    <section class="section">
      <h2>市场环境过滤</h2>
      <p>实时行情显示：<span class="${stanceClass}">${safeHtml(risk.summary)}</span></p>
    </section>

    ${(() => {
      const target = row(snapshot, payload.symbol);
      const atrAnalysis = analyzeAtrVsPut(target, payload.optionMetrics);
      if (!atrAnalysis.hasData) return "";
      return `
    <section class="section">
      <h2>ATR波动分析</h2>
      <p><span class="highlight">ATR占价格比例：</span> ${safeHtml(atrAnalysis.atrPct)}% ｜ <span class="${parseFloat(atrAnalysis.atrPct) >= 2 && parseFloat(atrAnalysis.atrPct) <= 4 ? 'good' : 'warn'}">${safeHtml(atrAnalysis.atrSuitability)}</span></p>
      <p><span class="highlight">ATR安全行权价（当前价 - 1.5 × ATR）：</span> $${safeHtml(atrAnalysis.safeStrike)}</p>
      ${atrAnalysis.targetStrike ? `
      <p><span class="highlight">你选择的目标行权价：</span> $${safeHtml(atrAnalysis.targetStrike)} ${atrAnalysis.expiryDate ? `｜ 到期日：${safeHtml(atrAnalysis.expiryDate)}` : ""}</p>
      ${atrAnalysis.marginNote ? `<p><span class="highlight">ATR与行权价对比：</span> ${safeHtml(atrAnalysis.marginNote)}</p>` : ""}
      ` : ""}
      <ul>
        <li>ATR 衡量波动性：ATR 越大，股价波动越大，期权权利金越高</li>
        <li>筛选标的：ATR% 在 2-4% 的股票适合卖 Put，波动适中</li>
        <li>安全行权价 ≈ 当前价 - 1.5 × ATR，作为行权价参考</li>
        <li>仓位管理：ATR 高时减少合约数量，ATR 低时可适当增加</li>
      </ul>
    </section>`;
    })()}

    <section class="section">
      <h2>规则版卖Put建议</h2>
      <ul>
        <li>${safeHtml(payload.symbol)} 的 Barchart 截图应重点观察：IV 是否高于 HV、IV Percentile 是否处于高位、Expected Move 是否提供足够安全垫。</li>
        <li>如果 IV 高，但同时 VIX、10Y、DXY 与半导体一起恶化，这更像风险预警，不是舒服的权利金。</li>
        <li>如果只是局部恐慌而主线结构没坏，才有可能形成值得拿的小仓风险溢价。</li>
      </ul>
    </section>

    <details>
      <summary>实时行情快照</summary>
      <div class="section">
        <p class="status">${safeHtml(risk.summary)}</p>
        <table>
          <thead><tr><th>标的</th><th>最新价格</th><th>日变化</th><th>日线ATR</th><th>周线ATR</th><th>来源</th><th>行情时间</th></tr></thead>
          <tbody>${focusTable(snapshot, payload.symbol)}</tbody>
        </table>
      </div>
    </details>
    ${dataSourceDetailsBlock(snapshot, payload.symbol)}
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const mode = String(body.mode || "").trim().toLowerCase();
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const market = String(body.market || "us").trim().toLowerCase();
    const provider = String(body.provider || "deepseek").trim().toLowerCase();
    const imageDataUrl = String(body.imageDataUrl || "").trim();
    const notes = String(body.notes || "").trim();
    const optionMetrics = (body.optionMetrics && typeof body.optionMetrics === "object") ? body.optionMetrics : {};

    if (mode === "parse-image") {
      if (!imageDataUrl.startsWith("data:image/")) return sendJson(res, 400, { ok: false, message: "请先上传截图。" });
      const parsed = await parseOptionMetricsFromImage(symbol, imageDataUrl);
      return sendJson(res, 200, {
        ok: true,
        optionMetrics: parsed,
        message: "已根据截图自动填入字段，请检查后再生成。",
      });
    }

    if (!symbol) return sendJson(res, 400, { ok: false, message: "缺少标的代码。" });
    const hasMetrics = Object.values(optionMetrics).some((value) => String(value ?? "").trim() !== "");
    if (!hasMetrics) return sendJson(res, 400, { ok: false, message: "请先录入 Barchart 关键字段。" });

    const snapshot = await loadSnapshot(symbol, market);
    const risk = marketRisk(snapshot, symbol);
    const ai = await callAI({ symbol, market, provider, imageDataUrl, notes, optionMetrics }, snapshot, risk);
    const finalHtml = ai.used && ai.html
      ? `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeHtml(symbol)} 卖Put温度判断</title>
<style>
  :root { --bg:#0f172a; --panel:#17233a; --line:#314566; --text:#e8eefc; --muted:#94a3b8; --gold:#ffd54a; --blue:#60a5fa; --green:#45d483; --red:#ff6b7d; --dn:#45d483; --up:#ff6b7d; }
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.65}
  .page{max-width:1160px;margin:0 auto;padding:28px}
  h1{font-size:44px;line-height:1.1;margin:0 0 12px;color:var(--gold)}
  h2{font-size:28px;margin:0 0 14px;color:var(--blue)}
  .meta{color:var(--muted);font-size:15px}
  .hero,.section{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:24px;margin-bottom:18px}
  .hero{padding:28px}
  table{width:100%;border-collapse:collapse;margin-top:12px;border-radius:16px;overflow:hidden;font-size:15px}
  th,td{border:1px solid var(--line);padding:12px 14px;text-align:left;vertical-align:top}
  th{background:#22304d}
  .status{color:var(--muted)}
  .up{color:var(--up);font-weight:700} .dn{color:var(--dn);font-weight:700}
  .highlight{color:var(--blue);font-weight:800} .good{color:var(--dn);font-weight:800} .warn{color:var(--gold);font-weight:800} .bad{color:var(--up);font-weight:800}
  details{margin-bottom:18px} details>summary{cursor:pointer;font-size:16px;font-weight:700;color:var(--muted);padding:14px 18px;background:var(--panel);border:1px solid var(--line);border-radius:14px;list-style:none} details>summary::-webkit-details-marker{display:none} details>summary::before{content:"▸ "} details[open]>summary::before{content:"▾ "}
</style></head><body><div class="page">
<section class="hero"><h1>${safeHtml(symbol)}｜卖Put温度判断</h1><p class="meta">${safeHtml(market.toUpperCase())} 市场 · 截图来源：Barchart Options Overview · 实时行情读取时间：${safeHtml(formatDateTime(snapshot.checkedAt || snapshot.updatedAt))}</p></section>
${ai.html}
<section class="section"><h2>市场环境过滤</h2><p class="status">${safeHtml(risk.summary)}</p></section>
${(() => {
  const target = row(snapshot, symbol);
  const atrAnalysis = analyzeAtrVsPut(target, body.optionMetrics || {});
  if (!atrAnalysis.hasData) return "";
  return `
<section class="section"><h2>ATR波动分析</h2>
<p><span class="highlight">ATR占价格比例：</span> ${safeHtml(atrAnalysis.atrPct)}% ｜ <span class="${parseFloat(atrAnalysis.atrPct) >= 2 && parseFloat(atrAnalysis.atrPct) <= 4 ? 'good' : 'warn'}">${safeHtml(atrAnalysis.atrSuitability)}</span></p>
<p><span class="highlight">ATR安全行权价（当前价 - 1.5 × ATR）：</span> $${safeHtml(atrAnalysis.safeStrike)}</p>
${atrAnalysis.targetStrike ? `<p><span class="highlight">你选择的目标行权价：</span> $${safeHtml(atrAnalysis.targetStrike)} ${atrAnalysis.expiryDate ? `｜ 到期日：${safeHtml(atrAnalysis.expiryDate)}` : ""}</p>` : ""}
${atrAnalysis.marginNote ? `<p><span class="highlight">ATR与行权价对比：</span> ${safeHtml(atrAnalysis.marginNote)}</p>` : ""}
</section>`;
})()}
<details><summary>实时行情快照</summary><div class="section"><table><thead><tr><th>标的</th><th>最新价格</th><th>日变化</th><th>日线ATR</th><th>周线ATR</th><th>来源</th><th>行情时间</th></tr></thead><tbody>${focusTable(snapshot, symbol)}</tbody></table></div></details>
${dataSourceDetailsBlock(snapshot, symbol)}
</div></body></html>`
      : ruleHtml({ symbol, market }, snapshot, risk, "");

    return sendJson(res, 200, {
      ok: true,
      symbol,
      market,
      provider: ai.provider || provider,
      used_ai: ai.used,
      status: risk.putStance,
      risk_score: risk.riskScore,
      message: ai.message || "已生成规则版判断。",
      filename: `${symbol}-sell-put-rating.html`,
      html: finalHtml,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: error?.name === "AbortError" ? "服务端处理超时，请重试。" : (error?.message || "生成失败"),
    });
  }
}
