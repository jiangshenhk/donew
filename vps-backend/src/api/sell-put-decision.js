import { securityCheck } from './_lib/security.js';
import { analyzeKlineStructure } from './report.js';
import { analyzePutRatingSnapshot } from './put-rating.js';
import {
  analyzeDecisionNews,
  loadRecentMarketNews,
} from './news-summary.js';
import {
  adjustRiskWithKline,
  adjustRiskWithOptionMetrics,
  analyzeOptionTemperature,
  assessDecisionReadiness,
  calculateMarketRisk,
  evaluateOptionContract,
} from './_lib/sell-put-decision-core.js';
import { fetchOptionsChain, selectBestContract } from './_lib/barchart-options-chain.js';

const STOCKPRICE_URL = "http://localhost:3000/api/stock/prices";
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

async function withTimeLimit(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(message);
          error.name = "TimeoutError";
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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

function detectMarket(symbol, requestedMarket) {
  const requested = String(requestedMarket || "").trim().toLowerCase();
  if (requested) return requested;
  const value = String(symbol || "").trim().toUpperCase().replace(/\s+/g, "");
  if (["BTC", "BTCUSD", "BTC/USD", "BTC-USD", "ETH", "ETH-USD"].includes(value)) return "crypto";
  if (/\.HK$/.test(value) || /^0?\d{4}$/.test(value)) return "hk";
  if (/^(?:SH|SZ)?\d{6}(?:\.(?:SS|SZ|SH))?$/.test(value)) return "cn";
  if (/\.NYB$/.test(value) || /=F$/.test(value) || ["^TNX", "^DXY"].includes(value)) return "global";
  return "us";
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

export function preferDirectTargetQuote(snapshot, symbol, klineStructure) {
  const quote = klineStructure?.latestQuote;
  const last = numberOrNull(quote?.last);
  const previousClose = numberOrNull(quote?.previousClose);
  const changePct = numberOrNull(quote?.changePct);
  if (last === null || previousClose === null || changePct === null) return snapshot;

  const direct = normalizeRow({
    symbol,
    last,
    previousClose,
    changePct,
    marketTime: quote.marketTime || "",
    exchange: quote.exchange || "",
    source: `kline:${quote.source || "行情源"}`,
    retrievedAt: new Date().toISOString(),
    fetchMode: "live",
  });
  const data = Array.isArray(snapshot?.data) ? [...snapshot.data] : [];
  const index = data.findIndex((item) => String(item?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase());
  if (index >= 0) data[index] = direct;
  else data.unshift(direct);
  return {
    ...(snapshot || {}),
    data,
    targetQuoteMode: "direct",
    targetQuoteSource: quote.source || "行情源",
  };
}

function formatEventRisks(events) {
  if (!events || !events.length) return "";
  const byCategory = {};
  for (const e of events) {
    (byCategory[e.category] ||= []).push(e);
  }
  const lines = [];
  for (const [cat, items] of Object.entries(byCategory)) {
    const summaries = items.map((e) => `[${e.timeLabel}] ${e.content}`);
    lines.push(`**${cat}事件：**\n${summaries.join("\n")}`);
  }
  return `\n## 近期事件风险扫描结果\n以下为最近24小时内市场快讯中提到的事件风险，请结合标的到期日综合判断：\n\n${lines.join("\n\n")}`;
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

function formatKlineStructure(structure) {
  if (!structure?.analysisAngles) return "K线相似度引擎未返回有效结果。";
  const similarity = structure.analysisAngles.similarity || {};
  const trend = structure.historicalTrendStats || {};
  const abc = structure.analysisAngles.abc || {};
  const matches = (structure.top5 || []).map((item) => `${item.name} ${item.score}% ${item.bias}`).join("；") || "无超过阈值的经典形态";
  return [
    `典型K线匹配：${similarity.title || "未取到"} | 匹配度：${similarity.score ?? "未取到"}% | 方向：${similarity.bias || "中性"}`,
    `前五匹配：${matches}`,
    trend.valid >= 8
      ? `历史相似样本：${trend.valid}个 | 后${trend.horizon}根K线 偏多${trend.bullProbability}% / 偏空${trend.bearProbability}% / 震荡${trend.flatProbability}%`
      : "历史相似样本不足，不输出历史方向概率。",
    `ABC/2B结构：${abc.stage || "未取到"} | ${abc.bias || "中性"} | ${abc.positionLabel || "待确认"}`,
  ].join("\n");
}

function row(snapshot, symbol) {
  const item = (snapshot.data || []).find((e) => String(e?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase());
  return normalizeRow(item || { symbol });
}

function marketRisk(snapshot, targetSymbol, optionMetrics = {}) {
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

  const result = adjustRiskWithOptionMetrics(
    calculateMarketRisk({ qqq, spy, iwm, smh, soxx, btc, vix, tnx, dxy, target }),
    optionMetrics,
  );
  return {
    ...result,
    summary: `QQQ ${pct(qqq.changePct)} / SPY ${pct(spy.changePct)} / SMH ${pct(smh.changePct)} / VIX ${pct(vix.changePct)} / 10Y ${pct(tnx.changePct)} / DXY ${pct(dxy.changePct)} / BTC ${pct(btc.changePct)}`,
  };
}

function adjustedRisk(risk, klineStats, klineStructure) {
  return adjustRiskWithKline(risk, klineStats, klineStructure);
}

function focusTable(snapshot, targetSymbol) {
  const symbols = Array.from(new Set([targetSymbol, ...FOCUS_SYMBOLS.map((i) => i.symbol)]));
  return symbols.map((s) => {
    const item = row(snapshot, s);
    const source = item.source?.startsWith("kline:")
      ? `K线行情 / ${item.source.slice(6)}`
      : item.source === "stockprice"
        ? "最新行情中心"
        : (item.source || item.exchange || "-");
    return `<tr><td>${safeHtml(symbolLabel(s))}</td><td>${item.last === null ? "未取到" : safeHtml(item.last.toFixed(2))}</td><td>${pct(item.changePct)}</td><td>${safeHtml(source)}</td><td>${safeHtml(formatDateTime(item.marketTime))}</td></tr>`;
  }).join("");
}

function formatOptionMetrics(metrics = {}) {
  const entries = [
    ["IV", metrics.iv, "%"], ["IV Change", metrics.ivChange, "%"], ["HV", metrics.hv, "%"],
    ["IV Percentile", metrics.ivPercentile, "%"], ["IV Rank", metrics.ivRank, "%"],
    ["IV High", metrics.ivHigh, "%"], ["IV High Date", metrics.ivHighDate, ""],
    ["IV Low", metrics.ivLow, "%"], ["IV Low Date", metrics.ivLowDate, ""],
    ["Expected Move", metrics.expectedMove, ""], ["Expected Move %", metrics.expectedMovePct, "%"], ["Expected Move DTE", metrics.expectedMoveDte, ""],
    ["Expected Range Low", metrics.expectedRangeLow, ""], ["Expected Range High", metrics.expectedRangeHigh, ""],
    ["Put/Call Vol Ratio", metrics.putCallVolRatio, ""], ["Put/Call OI Ratio", metrics.putCallOiRatio, ""],
    ["Today's Volume", metrics.todayVolume, ""], ["Volume Avg 30D", metrics.volumeAvg30, ""],
    ["Today's Open Interest", metrics.todayOpenInterest, ""], ["Open Int 30D", metrics.openInterest30, ""],
  ];
  return entries.filter(([, v]) => String(v ?? "").trim() !== "").map(([l, v, s]) => `${l}: ${String(v).trim()}${s}`).join("\n");
}

function sanitizeOptionMetrics(raw = {}) {
  return {
    iv: String(raw.iv ?? "").trim(), ivChange: String(raw.ivChange ?? "").trim(), hv: String(raw.hv ?? "").trim(),
    ivPercentile: String(raw.ivPercentile ?? "").trim(), ivRank: String(raw.ivRank ?? "").trim(),
    ivHigh: String(raw.ivHigh ?? "").trim(), ivHighDate: String(raw.ivHighDate ?? "").trim(),
    ivLow: String(raw.ivLow ?? "").trim(), ivLowDate: String(raw.ivLowDate ?? "").trim(),
    expectedMove: String(raw.expectedMove ?? "").trim(), expectedMovePct: String(raw.expectedMovePct ?? "").trim(),
    expectedMoveDte: String(raw.expectedMoveDte ?? "").trim(),
    expectedRangeLow: String(raw.expectedRangeLow ?? "").trim(), expectedRangeHigh: String(raw.expectedRangeHigh ?? "").trim(),
    putCallVolRatio: String(raw.putCallVolRatio ?? "").trim(), putCallOiRatio: String(raw.putCallOiRatio ?? "").trim(),
    todayVolume: String(raw.todayVolume ?? "").trim(), volumeAvg30: String(raw.volumeAvg30 ?? "").trim(),
    todayOpenInterest: String(raw.todayOpenInterest ?? "").trim(), openInterest30: String(raw.openInterest30 ?? "").trim(),
  };
}

function analyzeAtrVsPut(targetRow, klineStats, targetStrike, expiryDate) {
  const price = targetRow?.last;
  const dailyAtr = numberOrNull(klineStats?.atr);
  if (price == null || dailyAtr == null || price <= 0 || dailyAtr <= 0) {
    return { hasData: false, atrPct: null, safeStrike: null, marginNote: "", atrSuitability: "" };
  }
  let daysToExpiry = null;
  if (expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  }
  const atrPct = (dailyAtr / price) * 100;
  const atrDteMultiplier = daysToExpiry !== null && daysToExpiry > 0 ? Math.max(1.5, Math.sqrt(daysToExpiry)) : 1.5;
  const safeStrike = price - atrDteMultiplier * dailyAtr;
  let atrSuitability = "";
  if (atrPct < 1.5) atrSuitability = "低波动，权利金较少但价格相对稳定";
  else if (atrPct <= 4) atrSuitability = "波动适中，适合卖Put";
  else if (atrPct <= 6) atrSuitability = "波动偏高，权利金丰厚但风险较大";
  else atrSuitability = "波动过高，需卖更低行权价或减少仓位";
  let marginNote = "";
  const strike = numberOrNull(targetStrike);
  if (strike != null && strike > 0) {
    const strikeGapPct = ((strike - safeStrike) / safeStrike * 100);
    if (strike > safeStrike) {
      marginNote = `你选择的行权价($${strike.toFixed(2)})高于ATR安全行权价($${safeStrike.toFixed(2)})，安全垫偏薄(高于安全价${strikeGapPct.toFixed(2)}%)，需注意风险`;
    } else {
      marginNote = `你选择的行权价($${strike.toFixed(2)})低于ATR安全行权价($${safeStrike.toFixed(2)})，ATR提供额外${Math.abs(strikeGapPct.toFixed(2))}%安全垫`;
    }
  }
  return {
    hasData: true,
    atrPct: atrPct.toFixed(2),
    safeStrike: safeStrike.toFixed(2),
    atrDteMultiplier: atrDteMultiplier.toFixed(2),
    marginNote,
    atrSuitability,
    strike: strike?.toFixed(2) || null,
    expiryDate: expiryDate || null,
    daysToExpiry,
  };
}

function normalizeContractDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const chinese = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (chinese) return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  return "";
}

function extractContractFromNotes(notes) {
  const text = String(notes || "");
  const targetStrike = text.match(/(?:行权价(?:格)?|strike)\s*[:：为=]?\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1] || "";
  const delta = text.match(/(?:delta)\s*[:：为=]?\s*(-?[0-9]+(?:\.[0-9]+)?)/i)?.[1] || "";
  const bid = text.match(/(?:bid|买价)\s*[:：为=]?\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1] || "";
  const ask = text.match(/(?:ask|卖价)\s*[:：为=]?\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1] || "";
  const rawDate = text.match(/(?:到期日|到期日期|expiry(?:\s*date)?)\s*[:：为=]?\s*((?:\d{4}[-/]\d{1,2}[-/]\d{1,2})|(?:\d{4}年\d{1,2}月\d{1,2}日))/i)?.[1] || "";
  return { targetStrike, delta, bid, ask, expiryDate: normalizeContractDate(rawDate) };
}

function stripCodeFenceAndExtract(html) {
  let text = String(html || "").trim();
  text = text.replace(/^[\s\S]*?```html\s*/i, "").replace(/```[\s\S]*$/, "").trim();
  if (!text) return "";
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) text = bodyMatch[1].trim();
  const pageMatch = text.match(/(<div\s+[^>]*class=["']page["'][^>]*>[\s\S]*)/i);
  if (pageMatch) text = pageMatch[1];
  return text;
}

function sanitizeAiHtml(html) {
  let text = String(html || "");
  text = text.replace(/<\/?(?:script|iframe|object|embed|form|input|button|textarea|select|option|link|meta|base|svg|math)[^>]*>/gi, "");
  text = text.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  text = text.replace(/\s+(?:href|src)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi, "");
  text = text.replace(/\s+style\s*=\s*(["'])([\s\S]*?)\1/gi, (attribute, quote, value) => {
    return /expression\s*\(|url\s*\(|@import/i.test(value) ? "" : attribute;
  });
  return text.trim();
}

function ensureKlineMatchLine(html, klineStructure) {
  const source = String(html || "");
  const heading = /<h2[^>]*>\s*K线技术信号\s*<\/h2>/i;
  const headingMatch = heading.exec(source);
  if (!headingMatch) return source;

  const sectionEnd = source.indexOf("</section>", headingMatch.index);
  const scopedEnd = sectionEnd >= 0 ? sectionEnd : source.length;
  const sectionHtml = source.slice(headingMatch.index, scopedEnd);
  if (/典型K线匹配\s*[：:]/.test(sectionHtml)) return source;

  const similarity = klineStructure?.analysisAngles?.similarity || {};
  const title = similarity.title || "未取到超过阈值的典型形态";
  const score = similarity.score === null || similarity.score === undefined ? "未取到" : `${similarity.score}%`;
  const bias = similarity.bias || "中性";
  const line = `<p class="kline-match-line"><strong class="signal-label">典型K线匹配：</strong>${safeHtml(title)}（匹配度 ${safeHtml(score)}，方向：${safeHtml(bias)}）</p>`;
  const flex = /<div[^>]*class=["'][^"']*flex-between[^"']*["'][^>]*>[\s\S]*?<\/div>/i;
  const flexMatch = flex.exec(sectionHtml);
  const insertAt = flexMatch
    ? headingMatch.index + flexMatch.index + flexMatch[0].length
    : headingMatch.index + headingMatch[0].length;
  return `${source.slice(0, insertAt)}\n${line}${source.slice(insertAt)}`;
}

function mergeClassAttribute(attributes, className) {
  const attrs = String(attributes || "");
  const classMatch = attrs.match(/\sclass=(["'])(.*?)\1/i);
  if (!classMatch) return `${attrs} class="${className}"`;
  const classes = new Set(classMatch[2].split(/\s+/).filter(Boolean));
  classes.add(className);
  return attrs.replace(classMatch[0], ` class=${classMatch[1]}${[...classes].join(" ")}${classMatch[1]}`);
}

export function normalizeReportSections(html) {
  return String(html || "").replace(/<section([^>]*)>([\s\S]*?)<\/section>/gi, (section, attributes, body) => {
    let normalized = body;
    normalized = normalized.replace(/<ul(?![^>]*\bclass=)([^>]*)>/gi, '<ul class="bullet-list"$1>');
    normalized = normalized.replace(/<table(?![^>]*\bclass=)([^>]*)>/gi, '<table class="report-table"$1>');
    normalized = normalized.replace(
      /(<h2[^>]*>[\s\S]*?<\/h2>\s*)<p(?![^>]*\bclass=)([^>]*)>/i,
      '$1<p class="section-summary"$2>',
    );
    return `<section${mergeClassAttribute(attributes, "report-section")}>${normalized}</section>`;
  });
}

function reportSectionCss() {
  return `
  .report-section{padding:22px;margin-bottom:18px}
  .report-section>h2{margin:0 0 14px;font-size:24px;line-height:1.35;color:var(--gold);border-bottom:1px solid var(--line);padding-bottom:9px}
  .section-summary{margin:0 0 14px;padding:12px 14px;background:#1a2338;border-left:3px solid var(--blue);border-radius:8px;color:var(--text);font-weight:600;line-height:1.65}
  .metric-grid{display:flex;align-items:center;flex-wrap:wrap;gap:10px 18px;margin:0 0 14px;padding:12px 14px;background:#131d31;border:1px solid var(--line);border-radius:10px}
  .action-bar{background:#1a2338}
  .report-table{width:100%;margin:0 0 14px;font-size:14px;border-collapse:collapse}
  .report-table th,.report-table td{padding:10px 12px;border:1px solid var(--line);text-align:left;vertical-align:top}
  .report-table th{background:#22304d;color:var(--text)}
  .bullet-list{list-style:none;padding:0;margin:0}
  .bullet-list li{position:relative;margin:0;padding:9px 8px 9px 18px;border-bottom:1px solid #263653;line-height:1.7}
  .bullet-list li:last-child{border-bottom:0}
  .bullet-list li::before{content:"";position:absolute;left:2px;top:18px;width:6px;height:6px;border-radius:50%;background:var(--blue)}
  .section-note{margin-top:14px;padding:12px 14px;background:#1f2b44;border-left:3px solid var(--gold);border-radius:8px;color:var(--text)}
  .report-section pre{margin:0 0 14px;background:#0f172a!important;border:1px solid var(--line);border-radius:10px;padding:14px!important;color:var(--muted)!important}
  @media(max-width:720px){.report-section{padding:16px}.report-section>h2{font-size:21px}.metric-grid{align-items:flex-start;flex-direction:column}.flex-between{align-items:flex-start;gap:8px}}
`;
}

function riskDecisionStatus(risk) {
  if (risk?.putStance === "不利") return "暂不卖Put";
  if (risk?.putStance === "谨慎") return "谨慎卖Put";
  return "可卖Put";
}

function riskToneClass(risk) {
  if (risk?.putStance === "不利") return "chip-bad";
  if (risk?.putStance === "谨慎") return "chip-warn";
  return "chip-good";
}

function decisionToneClass(status) {
  if (status === "暂不卖Put") return "chip-bad";
  if (status === "谨慎卖Put") return "chip-warn";
  return "chip-good";
}

function ruleDecisionFromRiskOptionAndContract(risk, contractDecision) {
  const marketDecision = riskDecisionStatus(risk);
  let status = decisionSeverity(contractDecision?.status) > decisionSeverity(marketDecision)
    ? contractDecision.status
    : marketDecision;
  const temperature = risk?.optionTemperature || analyzeOptionTemperature({});
  const lowPremium = temperature.level === "低温"
    || (temperature.iv !== null && temperature.hv !== null && temperature.iv < temperature.hv);
  if (status === "可卖Put" && lowPremium) status = "谨慎卖Put";
  if (status === "谨慎卖Put" && lowPremium && contractDecision?.warnings?.length) status = "暂不卖Put";
  return status;
}

function extractAiDecisionStatus(html) {
  const source = String(html || "");
  const badge = source.match(/<span[^>]*class=["'][^"']*judge-badge[^"']*["'][^>]*>\s*(可卖Put|谨慎卖Put|暂不卖Put)\s*<\/span>/i);
  if (badge) return badge[1];
  const text = source.replace(/<[^>]+>/g, " ");
  if (/暂不卖Put|暂不宜卖\s*Put|暂时不宜卖\s*Put|不建议卖\s*Put|不适合卖\s*Put|避免卖\s*Put|先观望|观望为主|禁止自动下单/i.test(text)) return "暂不卖Put";
  if (/谨慎卖Put|谨慎开仓|小仓卖\s*Put|降低仓位|只适合小仓|可以观察性卖\s*Put/i.test(text)) return "谨慎卖Put";
  if (/可卖Put|适合卖\s*Put|可以卖\s*Put/i.test(text)) return "可卖Put";
  return "";
}

function decisionSeverity(status) {
  return { "可卖Put": 0, "谨慎卖Put": 1, "暂不卖Put": 2 }[status] ?? -1;
}

function contractGateHtml(contractDecision) {
  if (!contractDecision) return "";
  const tone = contractDecision.approved ? "good" : "bad";
  const blockers = contractDecision.blockers?.length
    ? `<ul>${contractDecision.blockers.map((item) => `<li class="bad">${safeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="good">未触发硬阻断条件。</p>`;
  const warnings = contractDecision.warnings?.length
    ? `<ul>${contractDecision.warnings.map((item) => `<li class="warn">${safeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `
<section class="section contract-gate">
  <h2>具体合约执行门槛</h2>
  <p><span class="highlight">代码结论：</span><span class="${tone}">${contractDecision.approved ? "通过，可进入下单前复核" : "不通过，禁止自动下单"}</span></p>
  <table>
    <thead><tr><th>项目</th><th>数值</th><th>规则</th><th>结果</th></tr></thead>
    <tbody>
      <tr><td>Delta</td><td>${safeHtml(contractDecision.delta?.toFixed(3) ?? "-")}</td><td>${safeHtml(`${contractDecision.deltaRange.min.toFixed(2)}-${contractDecision.deltaRange.max.toFixed(2)}`)}</td><td class="${contractDecision.delta !== null && contractDecision.delta <= contractDecision.deltaRange.max ? "good" : "bad"}">${contractDecision.delta !== null && contractDecision.delta <= contractDecision.deltaRange.max ? "通过" : "阻断"}</td></tr>
      <tr><td>Bid / Ask / Mid</td><td>${safeHtml(`${contractDecision.bid?.toFixed(2) ?? "-"} / ${contractDecision.ask?.toFixed(2) ?? "-"} / ${contractDecision.mid?.toFixed(2) ?? "-"}`)}</td><td>价差 ≤ max($0.10, Mid×15%)</td><td class="${contractDecision.spreadPass ? "good" : "bad"}">${contractDecision.spreadPass ? "通过" : "阻断"}</td></tr>
      <tr><td>价差</td><td>${safeHtml(`${contractDecision.spread?.toFixed(2) ?? "-"}（${contractDecision.spreadPct?.toFixed(2) ?? "-"}%）`)}</td><td>流动性硬门槛</td><td class="${contractDecision.spreadPass ? "good" : "bad"}">${contractDecision.spreadPass ? "合格" : "过宽"}</td></tr>
      <tr><td>行权价安全</td><td>${safeHtml(`Strike ${contractDecision.strike?.toFixed(2) ?? "-"} / 安全价 ${contractDecision.strictSafeStrike?.toFixed(2) ?? "-"}`)}</td><td>Strike ≤ min(现价-ATR×sqrt(DTE), Expected Range Low)</td><td class="${contractDecision.strikePass ? "good" : "bad"}">${contractDecision.strikePass ? "通过" : "阻断"}</td></tr>
      <tr><td>OTM安全垫</td><td>${safeHtml(`${contractDecision.otmPct?.toFixed(2) ?? "-"}%`)}</td><td>信息项</td><td>-</td></tr>
      <tr><td>年化收益</td><td>${safeHtml(`现金担保 ${contractDecision.collateralAnnualized?.toFixed(2) ?? "-"}% / 净接货成本 ${contractDecision.netCostAnnualized?.toFixed(2) ?? "-"}%`)}</td><td>不含手续费</td><td>-</td></tr>
    </tbody>
  </table>
  ${blockers}${warnings}
</section>`;
}

function buildPrecheckHtml(symbol, market, readiness, risk, klineStats, optionMetricsText, snapshot, generatedAt) {
  const componentRows = [
    ["市场行情", readiness.components.market],
    ["K线技术数据", readiness.components.kline],
    ["近期新闻", readiness.components.news],
    ["期权温度", readiness.components.optionTemperature],
    ["期权合约", readiness.components.optionContract],
  ].map(([label, ok]) => `<tr><td>${safeHtml(label)}</td><td class="${ok ? "good" : "warn"}">${ok ? "已具备" : "待补充"}</td></tr>`).join("");
  const missingItems = readiness.missing.map((item) => `<li>${safeHtml(item)}</li>`).join("");

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeHtml(symbol)} 卖Put预检查</title><style>
:root{--bg:#0f172a;--panel:#17233a;--line:#314566;--text:#e8eefc;--muted:#94a3b8;--gold:#ffd54a;--green:#45d483}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.65}
.page{max-width:1160px;margin:0 auto;padding:28px}.hero,.section{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:18px}
h1{font-size:36px;margin:0 0 8px;color:var(--gold)}h2{font-size:24px;color:var(--gold);border-bottom:1px solid var(--line);padding-bottom:8px}
.meta{color:var(--muted)}.notice{border-left:5px solid var(--gold);background:#242b3a;padding:14px 16px}.good{color:var(--green);font-weight:700}.warn{color:var(--gold);font-weight:700}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}th,td{border:1px solid var(--line);padding:10px 12px;text-align:left}th{background:#22304d}
.up{color:#ff6b7d;font-weight:700}.dn{color:#45d483;font-weight:700}ul{padding-left:22px}
</style></head><body><div class="page">
<section class="hero"><h1>${safeHtml(symbol)} 卖Put预检查</h1><p class="meta">报告生成时间：${safeHtml(formatDateTime(generatedAt))}</p><p class="meta">${safeHtml(market.toUpperCase())} · 数据完整前不输出卖Put结论</p></section>
<section class="section notice"><strong>当前仅完成预检查。</strong> 关键数据不完整，因此不会判断“可卖Put”、不会判断恐慌溢价，也不会给出具体合约建议。</section>
<section class="section"><h2>数据完整性</h2><table><thead><tr><th>判断模块</th><th>状态</th></tr></thead><tbody>${componentRows}</tbody></table><p class="warn">仍需补充：</p><ul>${missingItems}</ul></section>
<section class="section"><h2>已取得的市场观察</h2><p>${risk.summary}</p>${klineStats ? `<p>K线最新收盘 ${safeHtml(klineStats.lastClose)}，ATR占比 ${safeHtml(klineStats.atrPct)}%，近20日变化 ${safeHtml(klineStats.returns.d20?.toFixed(2) ?? "未取到")}%。</p>` : `<p class="meta">K线数据不足。</p>`}${optionMetricsText ? `<pre style="white-space:pre-wrap;color:#c8d4eb">${safeHtml(optionMetricsText)}</pre>` : `<p class="meta">期权温度数据不足。</p>`}</section>
<section class="section"><h2>下一步</h2><p>补齐上述数据后，系统才会运行新闻、K线、期权温度和具体合约的综合判断。</p></section>
<details><summary>行情快照</summary><table><thead><tr><th>标的</th><th>价格</th><th>变化</th><th>来源</th><th>行情时间</th></tr></thead><tbody>${focusTable(snapshot, symbol)}</tbody></table></details>
</div></body></html>`;
}

function buildPrompt({ symbol, market, optionMetricsText, optionTemperature, stockpriceSnapshot, newsText, klineStatsFormatted, klineStructureFormatted, notes, targetStrike, expiryDate, klineStats, risk, rawRisk, eventRisksText, contractDecision }) {
  const target = row(stockpriceSnapshot, symbol);
  const atrAnalysis = analyzeAtrVsPut(target, klineStats, targetStrike, expiryDate);

  let strikeSection = "";
  let atrSection = "";
  if (targetStrike || contractDecision?.mid || expiryDate) {
    const strike = numberOrNull(targetStrike);
    const price = numberOrNull(contractDecision?.mid);
    let dte = atrAnalysis.daysToExpiry;
    strikeSection = `\n## 具体期权合约与代码硬门槛
- 行权价格：${strike != null ? `$${strike}` : "未提供"}
- Delta：${contractDecision?.delta?.toFixed(3) ?? "未提供"}（规则区间 ${contractDecision?.deltaRange?.min?.toFixed(2) ?? "-"}-${contractDecision?.deltaRange?.max?.toFixed(2) ?? "-"}）
- Bid / Ask / Mid：${contractDecision?.bid?.toFixed(2) ?? "-"} / ${contractDecision?.ask?.toFixed(2) ?? "-"} / ${price != null ? price.toFixed(2) : "-"}
- 价差：${contractDecision?.spread?.toFixed(2) ?? "-"}（${contractDecision?.spreadPct?.toFixed(2) ?? "-"}%）
- 到期日：${expiryDate || "未提供"}${dte != null ? `（距离到期${dte}天）` : ""}
- OTM安全垫：${contractDecision?.otmPct?.toFixed(2) ?? "-"}%
- 严格安全行权价：${contractDecision?.strictSafeStrike?.toFixed(2) ?? "-"}（DTE调整ATR安全价与Expected Range Low取更低值）
- 现金担保年化：${contractDecision?.collateralAnnualized?.toFixed(2) ?? "-"}%
- 净接货成本年化：${contractDecision?.netCostAnnualized?.toFixed(2) ?? "-"}%
- 合约执行门槛：${contractDecision?.approved ? "通过" : "不通过"}
- 硬阻断：${contractDecision?.blockers?.length ? contractDecision.blockers.join("；") : "无"}
- 提醒：${contractDecision?.warnings?.length ? contractDecision.warnings.join("；") : "无"}
`;
  }
  if (atrAnalysis.hasData) {
    atrSection = `\n## ATR波动分析与行权价安全评估
- ATR(14)：${numberOrNull(klineStats?.atr)?.toFixed(4)} | ATR占价格比例：${atrAnalysis.atrPct}% | ${atrAnalysis.atrSuitability}
- DTE调整ATR安全行权价（当前价 - ATR × sqrt(DTE)，最低1.5×ATR）：$${atrAnalysis.safeStrike}
${atrAnalysis.strike ? `- 你选择的行权价：$${atrAnalysis.strike} | ${atrAnalysis.marginNote}
- 安全垫评估：请AI在报告中判断当前行权价的安全垫是否充足
` : ""}`;
  }

  return `你是一个专门帮助美股卖Put交易者做综合决策的分析助手。

请根据以下所有信息，生成一份完整的卖Put决策分析报告。

## 用户标的
- 标的：${symbol}
- 市场：${market || "us"}
- 当前价格：${target?.last ?? "未取到"}
- 日变化：${pct(target?.changePct)}

## 期权温度数据
${optionMetricsText || "未取到（完整性门槛应已阻断完整报告）。"}
独立卖Put温度引擎：${optionTemperature?.level || "数据不足"}${optionTemperature?.premiumSpread !== null && optionTemperature?.premiumSpread !== undefined ? ` | IV-HV ${optionTemperature.premiumSpread.toFixed(2)}个百分点` : ""}
${strikeSection}${atrSection}
## 市场行情快照
${risk.summary}
市场风险评分：${risk.riskScore}/10${risk.adjusted ? `（原始 ${rawRisk.riskScore}，${risk.adjustmentNotes.join("，")} 后上调）` : ""}
卖Put环境判定：${risk.putStance} | 尾部风险灯号（启发式）：${risk.blackSwan}

## 最新24小时新闻要点
${newsText || "暂无新闻数据。"}
${eventRisksText || ""}

## K线技术分析
${klineStatsFormatted || "暂无K线数据。"}

## K线相似度、历史样本与ABC结构
${klineStructureFormatted || "暂无K线结构判断。"}

${notes ? `## 用户补充关注点\n${notes}` : ""}

## 报告生成要求

**核心理念：你是一个专门帮用户判断"当前是否适合卖Put"的美股期权研究助手。你的任务是整合所有数据源，判断当前卖Put到底是：可卖Put（真正的恐慌溢价，权利金值得拿）、谨慎卖Put（有溢价但容易变陷阱）、还是暂不卖Put（风险大于收益）。**

**重要约束：**
- 绝对不要输出"买入/卖出/做多/做空"等股票交易建议。你只判断期权卖方策略（Sell Put）的利弊
- 你的三个结论选项固定为：可卖Put、谨慎卖Put、暂不卖Put（不是买/卖/持有）
- 所有行动建议的措辞必须以"卖Put"为落脚点，例如"当前适合卖Put"而非"当前适合买入"
- “合约执行门槛”是代码硬约束。门槛不通过时必须输出“暂不卖Put”，不得因高IV或高年化改成更激进结论
- Delta、Bid、Ask、Mid、价差和收益率只能引用上方代码计算结果，不得猜测或补造
- 尾部风险灯号只是启发式风险可视化，不是真正的黑天鹅检测或黑天鹅预测

**重要：严格输出规则**
- 不要输出 \`\`\`html 或 \`\`\` 代码块，不要输出 DOCTYPE、<html>、<head>、<body> 等外层标签
- 不要输出任何前言/后记/解释文字（如"以下是您所需的"）
- 直接从第一个 <section> 标签开始输出，到最后一个 </section> 结束
- 报告层级必须清晰：每个大节使用 h2；节内判断项名称使用 <strong class="signal-label">判断项：</strong>；普通解释保持正文颜色
- 只有方向性结论使用红绿黄：偏多/有利/低风险用 highlight-green，偏空/不利/高风险用 highlight-red，中性/谨慎/待确认用 highlight-yellow
- 不要把整段正文染色；每个判断只着色最短的结论词或关键短语
- 六个大节必须使用同一套内容骨架，顺序不得变化：
  1. <h2>小节标题</h2>
  2. <p class="section-summary"><strong class="signal-label">本节结论：</strong>一句话结论</p>
  3. <div class="metric-grid">核心数字或标签；没有核心数字时可省略</div>
  4. <ul class="bullet-list">详细分析，每条以蓝色粗体判断项开头</ul>
  5. 必要时追加 <div class="section-note">风险提醒或行动条件</div>
- 不得让某一节只有散落的普通段落；不得使用不同风格的自定义大卡片替代上述骨架

**风险判断铁律（必须在报告中体现）：**
- "这是不是恐慌溢价？"必须回答并着色：是=<span class="dn">是</span>（绿色），不是=<span class="up">不是</span>（红色），不确定=<span class="warn">不确定</span>（黄色）
- "未来3-5个交易日的大跌/跳空风险高不高？"必须回答并着色：高=<span class="up">高</span>（红色），低=<span class="dn">低</span>（绿色），中=<span class="warn">中</span>（黄色）
- "权利金值不值得冒尾部风险？"必须回答并着色：值得=<span class="dn">值得</span>（绿色），不值得=<span class="up">不值得</span>（红色），谨慎=<span class="warn">谨慎</span>（黄色）
- ATR% > 6% 或价格位于所有均线下方且20日跌幅>15%，自动倾向"谨慎卖Put"或"暂不卖Put"
- IV Rank > 90% 是高溢价信号，但必须结合趋势方向综合判断，不能只看IV就给出"可卖Put"
- **事件风险强制约束**：只能引用本次输入的“最新24小时新闻要点”和“近期事件风险扫描结果”。
  · 不得利用训练记忆自行补充财报、FOMC、非农、CPI、PPI、GDP、OPEC等未来日期
  · 只有新闻原文明确包含事件名称和日期时，才能写成已确认事件
  · 新闻只提到事件但没有日期时，必须标注“日期未验证”
  · 没有取得已验证未来事件时，必须明确写“未取得已验证事件日历”，不得猜测
  · 如果用户提供了到期日（${expiryDate || "未提供"}），只能对已验证事件判断其是否落在到期日前
  对于已验证事件，在综合结论中用 <span class="highlight-red">⚠️ 事件风险：[事件名+已验证日期]</span> 显眼标出
- 语气务实，不写空话，面向卖Put交易者，明确区分事实和推测

### 第1节 · 综合结论 (<section class="section hero-judgement">)
- 先输出 <h2>综合结论</h2>
- 第一行用大徽章给出结论：<span class="judge-badge" style='background:#1a3a2a;color:#45d483;'>可卖Put</span>（可卖Put→#45d483绿底，谨慎卖Put→#ffd54a黄底text:#333，暂不卖Put→#ff6b7d红底）
- 第二行必须输出 <p class="section-summary"><strong class="signal-label">本节结论：</strong><span class="judge-reason">一句核心判断理由</span></p>
- 然后必须逐条回答三个关键问题（每行用 class="highlight" 标关键字，答案必须着色）：
  · "这是不是恐慌溢价？" — 是/不是/不确定
  · "未来3-5个交易日的大跌/跳空风险？" — 高/低/中
  · "权利金值不值得冒尾部风险？" — 值得/不值得/谨慎
- **如果新闻中出现近期（7天内）的财报/FOMC/非农/CPI等重大事件，必须在此用一行 <span class="highlight-red">⚠️ 近期事件风险：列出事件名称和日期</span> 显眼警示**
- 下方用 1-2 行补充关键量化数据

### 第2节 · 市场环境 (<section class="section">)
- 先输出 <h2>市场环境</h2>
- 先输出 class="section-summary" 的一句话市场结论
- 然后用 <div class="metric-grid"> 包裹一排 class="data-item" 标签展示关键行情：<span class="data-item">QQQ <span style="color:#45d483;">+0.68%</span></span>
- 然后用 <ul class="bullet-list"> 列出 3-5 条要点，涵盖：宏观/地缘、半导体/科技情绪、利率与美元、近期事件风险、综合判断
- 每条必须以蓝色粗体判断项开头，例如：<li><strong class="signal-label">科技情绪：</strong>半导体呈现 <span class="highlight-red">偏弱</span>，随后用普通正文解释原因。</li>

### 第3节 · 期权温度解读 (<section class="section">)
- 先输出 <h2>期权温度解读</h2>
- 先输出 class="section-summary" 的一句话期权温度结论
- 然后用 <div class="metric-grid"> 展示核心数据+解读（不要只罗列数字，必须标注含义）：
  示例格式：
  <div style="display:flex;flex-wrap:wrap;gap:16px 30px;margin-bottom:12px;">
    <div><span class="tag">IV 104.23%</span> vs <span class="tag">HV 94.28%</span> <span class="highlight-yellow">IV > HV 约10%</span></div>
    <div><span class="tag">IV Rank 100.00%</span> <span class="highlight-red">历史极值</span></div>
    <div><span class="tag">Put/Call Vol 0.47</span> <span class="highlight-green">call活跃</span> / OI 0.96 <span class="warn">中性</span></div>
    <div><span class="tag">Expected Move 5.23%</span> (±5.16点)</div>
  </div>
  （每条先用 class="tag" 显示指标数值，紧接着用 class="highlight-green/highlight-red/highlight-yellow" 或 class="up/dn/warn" 标注含义）
- 然后用 <ul class="bullet-list"> 列出 4-5 条详细解读，涵盖：
  · IV vs HV 对比及含义（溢价水平）
  · IV Percentile / IV Rank 位置及对卖Put的意义
  · Put/Call Ratio 信号解读（成交量 PCR vs 持仓量 PCR，分别说明）
  · Expected Move 安全垫评估（与行权价的距离比较）
  · 恐慌溢价判断（是不是真正的恐慌溢价，还是风险预警）
- 每条必须以蓝色粗体判断项开头，例如：<li><strong class="signal-label">IV 与 HV：</strong>当前溢价处于 <span class="highlight-yellow">中性</span>，随后用普通正文解释。</li>

### 第4节 · K线技术信号 (<section class="section">)
- 先输出 <h2>K线技术信号</h2>
- 先输出 class="section-summary" 的一句话技术面结论
- 然后用 <div class="metric-grid flex-between"> 展示趋势概况和强弱（必须包含具体数值）：
  示例格式：
  <div class="flex-between">
    <span><span class="highlight-red">趋势：空头</span> (SMA5=100.18 < SMA10=104.70 < SMA20=117.70)</span>
    <span><span class="badge-red">弱势</span> 近5日4跌</span>
  </div>
  （不要在 <span class="tag"> 里写"趋势：强烈下跌"，要用 highlight-green/highlight-red 着色趋势，并在括号里给出具体均线数值或涨跌天数）
- 第二行必须单独输出典型K线匹配，不得省略“典型K线匹配：”标签：
  <p class="kline-match-line"><strong class="signal-label">典型K线匹配：</strong>流星/墓碑十字（匹配度 82%，方向：偏空）</p>
  形态名称、匹配度和方向必须直接引用“K线相似度结构”的最高形态匹配结果；未取到时明确写“未取到超过阈值的典型形态”，不得编造。
- 然后用一个标准表格展示 SMA5/10/20/50：
  <table>
    <tr><th>均线</th><th>SMA5</th><th>SMA10</th><th>SMA20</th><th>SMA50</th></tr>
    <tr><td>数值</td><td>100.18</td><td>104.70</td><td>117.70</td><td>116.97</td></tr>
    <tr><td>价格相对</td><td><span class="highlight-red">↓ 下方</span></td><td>...</td></tr>
  </table>
  （价格相对位置必须着色：上方用 class="highlight-green"，下方用 class="highlight-red"，远下方加"远"字）
- 然后用 <ul class="bullet-list"> 列出 5 条详细解读，涵盖：
  · 趋势判断（均线排列是多头还是空头，中期趋势方向）
  · K线形态含义（检测到的形态代表的信号，是看涨还是看跌）
  · 支撑/阻力位（引用支撑区间和阻力区间的具体数值）
  · ATR波动分析+行权价安全垫（ATR占比、ATR安全行权价、用户选择的行权价是否低于安全价）
  · 量价配合（成交量是否配合趋势，放量涨还是放量跌，缩量反弹等）
- 每条必须以蓝色粗体判断项开头，例如：<li><strong class="signal-label">趋势结构：</strong>均线排列为 <span class="highlight-red">空头</span>，随后用普通正文解释。</li>

### 第5节 · 综合卖Put建议 (<section class="section">)
- 先输出 <h2>综合卖Put建议</h2>
- 先输出 class="section-summary" 的一句话行动结论
- 然后用 <div class="metric-grid action-bar"> 包裹动作建议、徽章和标签，格式必须如下：
  <div class="metric-grid action-bar">
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
      <span style="font-size:1.5rem;font-weight:700;">动作建议</span>
      <span class="badge-red" style="font-size:1.2rem;padding:4px 28px;">暂不卖Put</span>
      <span class="tag">到期日${expiryDate || "未提供"} Delta ${contractDecision?.delta?.toFixed(3) ?? "未提供"}</span>
      <span class="tag">行权价${targetStrike || "未提供"} Bid/Ask ${contractDecision?.bid?.toFixed(2) ?? "-"}/${contractDecision?.ask?.toFixed(2) ?? "-"}</span>
    </div>
  </div>
  （徽章类名：可卖Put→badge-green，谨慎卖Put→badge-yellow，暂不卖Put→badge-red）
- 然后用 <ul class="bullet-list"> 列出以下四项，每项结构参照示例：
  <li><strong>关键风险点：</strong> 此处列出3-4条风险，每条前用编号①②③④，每条用 <span class="highlight-red">...</span> 包裹。必须包含以下维度：趋势风险（跌幅/ATR）、事件风险（财报/FOMC/非农等，如有）、Gamma风险（到期日临近时的风险）、地缘/宏观风险。每条要具体指出风险是什么、触发条件、后果</li>
  <li><strong>如果必须操作：</strong> <span class="highlight-yellow">...</span> 给出仓位控制、策略调整、止损条件等具体建议，不是空话</li>
  <li><strong>建议行权价参考区间：</strong> 基于ATR安全行权价和支撑位给出具体价格区间，用 <span class="highlight-green">安全</span> / <span class="highlight-red">危险</span> / <span class="highlight-yellow">边缘</span> 标注当前选择的相对位置</li>
- 最后输出统一的提醒条（不要放在 ul 里面）：
  <div class="section-note">
    <span class="highlight-yellow">⚠️ 特别提醒：</span> 用1-2句话总结当前风险环境中最重要的注意事项
  </div>

### 第6节 · 未来3-5个交易日关注清单 (<section class="section">)
- 先输出 <h2>未来3-5个交易日关注清单</h2>
- 先输出 class="section-summary" 的一句话监控结论
- 只检查本次新闻数据中明确出现的近期重大事件；有已验证日期时，用一行 <span class="highlight-red">📅 近期重要事件：[事件名+日期]</span> 显眼标出；没有已验证日期时不得自行补充
- 使用一个 <ul class="bullet-list"> 列出需要监控的信号，不再使用与其他章节不同的双栏卡片
- 底部用标签行展示：改变判断的信号（绿色好转信号、红色恶化信号、黄色中性信号）

### 视觉风格参考（可直接使用以下CSS class，或使用内联style）
- 涨/偏多：<span class="highlight-green"> 或 <span class="dn">
- 跌/偏空：<span class="highlight-red"> 或 <span class="up">
- 中性/警告：<span class="highlight-yellow"> 或 <span class="warn">
- 关键指标标签：用 <span class="tag"> （圆角深色小标签）
- 要点列表：用 <ul class="bullet-list">（每行带 🔹 符）
- 数据药丸：<span class="data-item"> （圆角药丸形数据展示）
- 表格：标准 <table> + <th>/<td>
- h2 标题: color:#ffd54a，border-bottom:1px solid #314566
- 建议条：background:#1a2338;border-radius:16px;padding:16px

记住：直接输出 HTML 片段，不要任何包装标记！`;

function buildAnalysisPrompt(data) {
  return buildPrompt(data).replace(/直接输出 HTML 片段[\s\S]*$/m, `输出 JSON 格式的分析数据，不要输出 HTML。
{
  "conclusion": "可卖Put|谨慎卖Put|暂不卖Put",
  "riskScore": 1-10,
  "putStance": "有利|谨慎|不利",
  "temperature": "高温|中温|低温",
  "blackSwan": "绿灯|黄灯|红灯",
  "marketSummary": "2-3句话市场环境总结",
  "optionAnalysis": "期权温度解读",
  "klineSignals": "K线技术信号",
  "sellPutAdvice": {
    "action": "具体行动建议",
    "keyRisks": ["风险1","风险2","风险3"],
    "ifMustOperate": "如果必须操作的仓位建议",
    "strikeRange": "建议行权价区间描述",
    "specialWarning": "特别提醒"
  },
  "watchlist": ["未来关注信号1","信号2","信号3"]
}`);
}

async function callAIRender(jsonAnalysis, symbol, market) {
  const renderPrompt = `根据以下JSON分析数据，生成一篇卖Put决策HTML报告。

JSON分析数据：
${JSON.stringify(jsonAnalysis, null, 2)}

${buildPrompt({
  symbol, market,
  optionMetricsText: '', optionTemperature: {},
  stockpriceSnapshot: [], newsText: '',
  klineStatsFormatted: '', klineStructureFormatted: '',
  notes: '', targetStrike: null, expiryDate: '',
  klineStats: {}, risk: {}, rawRisk: {},
  eventRisksText: '', contractDecision: null,
}).split('## 报告生成要求')[1] || ''}`;

  if (!process.env.DEEPSEEK_API_KEY) {
    return { provider: "规则版", html: "", warning: "未配置DEEPSEEK_API_KEY" };
  }
  try {
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
    const maxTokens = model.includes('v4') ? 16000 : 8192;
    const res = await timedFetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: renderPrompt }],
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
    }, 50000);
    if (!res.ok) return { provider: "规则版", html: "", warning: `DeepSeek HTTP ${res.status}` };
    const json = await res.json();
    const html = json?.choices?.[0]?.message?.content?.trim() || "";
    return html
      ? { provider: "DeepSeek", html, warning: "" }
      : { provider: "规则版", html: "", warning: "DeepSeek未返回报告内容" };
  } catch (error) {
    return { provider: "规则版", html: "", warning: error.message };
  }
}
}

async function callAI(prompt) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { provider: "规则版", html: "", warning: "未配置DEEPSEEK_API_KEY" };
  }
  try {
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
    const maxTokens = model.includes('v4') ? 16000 : 8192;
    const res = await timedFetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
    }, 50000);
    if (!res.ok) {
      return { provider: "规则版", html: "", warning: `DeepSeek HTTP ${res.status}` };
    }
    const json = await res.json();
    const html = json?.choices?.[0]?.message?.content?.trim() || "";
    return html
      ? { provider: "DeepSeek", html, warning: "" }
      : { provider: "规则版", html: "", warning: "DeepSeek未返回报告内容" };
  } catch (error) {
    const message = error?.name === "AbortError" ? "DeepSeek 50秒未返回" : (error?.message || "DeepSeek调用失败");
    return { provider: "规则版", html: "", warning: message };
  }
}

function buildRuleHtml(symbol, market, risk, klineStats, klineStructure, optionMetricsText, snapshot, targetStrike, expiryDate, decisionNewsItems, eventRisks, generatedAt, contractDecision) {
  const stanceClass = risk.putStance === "有利" ? "good" : risk.putStance === "谨慎" ? "warn" : "bad";
  const decisionStatus = ruleDecisionFromRiskOptionAndContract(risk, contractDecision);
  const decisionClass = decisionStatus === "可卖Put" ? "good" : decisionStatus === "谨慎卖Put" ? "warn" : "bad";
  const riskTone = riskToneClass(risk);
  const decisionTone = decisionToneClass(decisionStatus);
  const target = row(snapshot, symbol);
  const atrAnalysis = analyzeAtrVsPut(target, klineStats, targetStrike, expiryDate);
  const klineStructureText = formatKlineStructure(klineStructure);
  const newsRows = (decisionNewsItems || []).slice(0, 8).map((item) => {
    const time = formatDateTime(item.time);
    return `<li><strong>${safeHtml(time)}</strong> ${safeHtml(String(item.content || "").slice(0, 220))}</li>`;
  }).join("");
  const eventRows = (eventRisks || []).map((item) => `<li><strong>${safeHtml(item.category)}：</strong>${safeHtml(item.content)}</li>`).join("");
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
  .signal-label,.section li>strong,.section p>strong:first-child{color:#86b7ff;font-weight:800}
  .meta{color:var(--muted);font-size:14px}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
  .chip{border:1px solid #334155;background:#1d2943;color:#dce7fb;border-radius:999px;padding:8px 14px;font-weight:700;font-size:14px}
  .chip-good{border-color:rgba(69,212,131,.48);background:rgba(69,212,131,.14);color:#45d483}
  .chip-warn{border-color:rgba(255,213,74,.5);background:rgba(255,213,74,.14);color:#ffd54a}
  .chip-bad{border-color:rgba(255,107,125,.52);background:rgba(255,107,125,.14);color:#ff6b7d}
  table{width:100%;border-collapse:collapse;margin:12px 0;border-radius:12px;overflow:hidden;font-size:14px}
  th,td{border:1px solid var(--line);padding:10px 12px;text-align:left}
  th{background:#22304d}
  ul{margin:8px 0;padding-left:20px} li{margin-bottom:6px}
  .atr-tips{font-size:0.9em;color:var(--muted)} .atr-tips li{margin-bottom:6px}
${reportSectionCss()}
</style></head>
<body><div class="page">
<section class="hero">
  <h1>${safeHtml(symbol)} 综合卖Put决策</h1>
  <p class="meta">报告生成时间：${safeHtml(formatDateTime(generatedAt))}</p>
  <p class="meta">${safeHtml(market.toUpperCase())} · 规则版报告（AI暂不可用）</p>
  <div class="chips">
    <span class="chip ${riskTone}">卖Put环境：${safeHtml(risk.putStance)}</span>
    <span class="chip ${decisionTone}">综合结论：${safeHtml(decisionStatus)}</span>
    <span class="chip ${contractDecision?.approved ? "chip-good" : "chip-bad"}">合约执行门槛：${contractDecision?.approved ? "通过" : "阻断"}</span>
    <span class="chip ${riskTone}">尾部风险灯号（启发式）：${safeHtml(risk.blackSwan)}</span>
    <span class="chip ${riskTone}">风险评分：${safeHtml(risk.riskScore)}/10</span>${risk.adjusted ? ` <span class="chip chip-warn">⚠️ 单票调整: ${safeHtml(risk.adjustmentNotes.join("、"))}</span>` : ""}${risk.optionAdjusted ? ` <span class="chip chip-warn">期权温度: ${safeHtml([...(risk.opportunityNotes || []), ...(risk.optionNotes || [])].join("、"))}</span>` : ""}
  </div>
</section>

<section class="section">
  <h2>综合结论</h2>
  <p><span class="highlight">当前卖Put：</span><span class="${decisionClass}">${safeHtml(decisionStatus)}</span></p>
  <p><span class="highlight">市场环境：</span>${risk.summary}</p>
  <p><span class="highlight">规则版说明：</span>AI暂不可用，以下基于规则引擎判断。规则版已纳入IV/HV、IV Rank/Percentile、Expected Move、Put/Call结构和具体合约门槛。</p>
</section>

${contractGateHtml(contractDecision)}

<section class="section">
  <h2>市场环境过滤</h2>
  <p>${risk.summary}</p>
  <p><span class="highlight">风险评分：</span>${safeHtml(risk.riskScore)}/10 | <span class="highlight">卖Put判定：</span><span class="${stanceClass}">${safeHtml(risk.putStance)}</span></p>
  ${(risk.notes || []).length ? `<p class="meta">风险模型备注：${safeHtml(risk.notes.join("；"))}</p>` : ""}
</section>

${klineStats ? `
<section class="section">
  <h2>K线技术信号（规则版）</h2>
  <p class="section-summary"><strong class="signal-label">本节结论：</strong>最新价 ${safeHtml(klineStats.lastClose)}，ATR占比 ${safeHtml(klineStats.atrPct)}%，结合趋势、支撑阻力和历史相似结构判断行权价安全垫。</p>
  <pre style="background:#0a0f1a;padding:14px;border-radius:10px;overflow-x:auto;white-space:pre-wrap;font-size:13px;color:#b0c4e8">${safeHtml(klineStructureText)}</pre>
  <p><span class="highlight">最新收盘：</span>${safeHtml(klineStats.lastClose)} | <span class="highlight">ATR(14)：</span>${safeHtml(klineStats.atr)} | <span class="highlight">ATR占比：</span>${safeHtml(klineStats.atrPct)}%</p>
  <p><span class="highlight">涨幅：</span>1日 ${safeHtml(klineStats.returns.d1?.toFixed(2) ?? "N/A")}% | 5日 ${safeHtml(klineStats.returns.d5?.toFixed(2) ?? "N/A")}% | 20日 ${safeHtml(klineStats.returns.d20?.toFixed(2) ?? "N/A")}%</p>
  <p><span class="highlight">支撑区间：</span>${safeHtml(klineStats.supportMin)} ~ ${safeHtml(klineStats.supportMax)}</p>
  <p><span class="highlight">阻力区间：</span>${safeHtml(klineStats.resistanceMin)} ~ ${safeHtml(klineStats.resistanceMax)}</p>
  ${klineStats.patterns.length ? `<p><span class="highlight">检测K线形态：</span>${safeHtml(klineStats.patterns.join("、"))}</p>` : ""}
  <p><span class="highlight">规则说明：</span>形态匹配、历史相似样本和 ABC/2B 结构直接来自 K 线相似度工具的共享引擎；历史方向概率是条件样本统计，不等于黑天鹅概率。</p>
</section>` : ""}

<section class="section">
  <h2>最近24小时相关新闻（规则版）</h2>
  <p class="section-summary"><strong class="signal-label">本节结论：</strong>${eventRows ? "新闻中识别到需纳入到期日前判断的事件风险。" : "本次新闻未识别到带可靠日期的未来重大事件。"}</p>
  <ul>${newsRows || "<li>未取得相关新闻；按完整性门槛不应进入完整报告。</li>"}</ul>
  ${eventRows ? `<h3>新闻内事件风险</h3><ul>${eventRows}</ul>` : `<p class="meta">本次新闻未识别到带可靠日期的未来事件；不根据训练记忆补充事件日历。</p>`}
</section>

${optionMetricsText ? `
<section class="section">
  <h2>期权温度数据</h2>
  <p class="section-summary"><strong class="signal-label">本节结论：</strong>${safeHtml(risk.optionTemperature?.level || "数据不足")}；${safeHtml([...(risk.opportunityNotes || []), ...(risk.optionNotes || [])].join("；") || "期权温度数据已纳入规则版风险评分与结论。")}</p>
  <pre style="background:#0a0f1a;padding:14px;border-radius:10px;overflow-x:auto;font-size:13px;color:#b0c4e8">${safeHtml(optionMetricsText)}</pre>
</section>` : ""}

${atrAnalysis.hasData ? `
<section class="section">
  <h2>ATR波动分析与行权价安全</h2>
  <p><span class="highlight">ATR(14)：</span>${safeHtml(numberOrNull(klineStats?.atr)?.toFixed(4))} | <span class="highlight">ATR占价格比例：</span>${safeHtml(atrAnalysis.atrPct)}% | <span class="${parseFloat(atrAnalysis.atrPct) >= 2 && parseFloat(atrAnalysis.atrPct) <= 4 ? 'good' : 'warn'}">${safeHtml(atrAnalysis.atrSuitability)}</span></p>
  <p><span class="highlight">DTE调整ATR安全行权价（当前价 - ATR × sqrt(DTE)，最低1.5×ATR）：</span>$${safeHtml(atrAnalysis.safeStrike)}${atrAnalysis.daysToExpiry ? ` ｜ DTE ${safeHtml(atrAnalysis.daysToExpiry)}天 ｜ ATR倍数 ${safeHtml(atrAnalysis.atrDteMultiplier)}` : ""}</p>
  ${atrAnalysis.strike ? `
  <p><span class="highlight">你选择的行权价：</span>$${safeHtml(atrAnalysis.strike)} ｜ Delta ${safeHtml(contractDecision?.delta?.toFixed(3) ?? "-")} ｜ Bid/Ask/Mid ${safeHtml(`${contractDecision?.bid?.toFixed(2) ?? "-"} / ${contractDecision?.ask?.toFixed(2) ?? "-"} / ${contractDecision?.mid?.toFixed(2) ?? "-"}`)} ${atrAnalysis.expiryDate ? `｜ 到期日：${safeHtml(atrAnalysis.expiryDate)}` : ""}</p>
  <p><span class="highlight">安全垫对比：</span>${safeHtml(atrAnalysis.marginNote)}</p>` : ""}
  <ul class="atr-tips">
    <li>选标的 — ATR% 在 2-4% 波动适中，适合卖 Put；太高风险大，太低权利金少</li>
    <li>定行权价 — 安全行权价按DTE调整：当前价 - ATR×sqrt(DTE)，再与Expected Range Low取更保守值</li>
    <li>管仓位 — ATR 高时减少合约数，ATR 低时可以适当加仓</li>
  </ul>
</section>` : ""}

<section class="section">
  <h2>规则版卖Put建议</h2>
  <p class="section-summary"><strong class="signal-label">本节结论：</strong><span class="${decisionClass}">${safeHtml(decisionStatus)}</span>，最终动作同时受市场风险和具体合约执行门槛约束。</p>
  <ul>
    <li><span class="highlight">${safeHtml(symbol)} 当前市场环境${safeHtml(risk.putStance)}：</span>${risk.putStance === "有利" ? "风险评分偏低，市场环境相对稳定，可考虑卖Put，但需结合期权IV/HV判断。" : risk.putStance === "谨慎" ? "风险评分中等，市场存在不确定性，建议减少仓位或选择更虚值行权价。" : "风险评分偏高，VIX/半导体/国债收益率等信号偏空，建议等待市场稳定。"}</li>
    <li>期权温度数据已参与规则版判断：IV/HV、IV Rank/Percentile、Expected Move和Put/Call结构会改变风险评分与最低结论。</li>
    <li>K线支撑位可作为行权价参考，ATR安全行权价按DTE调整，不再固定使用1.5×日ATR。</li>
    <li>未来事件只采用本次新闻中明确出现且日期可验证的内容；未取得时不猜测事件日历。</li>
  </ul>
</section>

<table><thead><tr><th>标的</th><th>价格</th><th>变化</th><th>来源</th><th>行情时间</th></tr></thead><tbody>${focusTable(snapshot, symbol)}</tbody></table>
</div></body></html>`;
}

function buildAiReportWrapper(symbol, market, risk, decisionStatus, aiHtml, snapshot, generatedAt, contractDecision) {
  const riskTone = riskToneClass(risk);
  const decisionTone = decisionToneClass(decisionStatus);
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeHtml(symbol)} 综合卖Put决策</title>
<style>
  :root { --bg:#0f172a; --panel:#17233a; --line:#314566; --text:#e8eefc; --muted:#94a3b8; --gold:#ffd54a; --blue:#60a5fa; --green:#45d483; --red:#ff6b7d; --dn:#45d483; --up:#ff6b7d; }
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.65}
  .page{max-width:1160px;margin:0 auto;padding:28px}
  h1{font-size:38px;line-height:1.1;margin:0 0 12px;color:var(--gold)}
  h2{font-size:24px;margin:24px 0 14px;color:var(--gold);padding-bottom:6px;border-bottom:1px solid var(--line)}
  h3{font-size:18px;margin:18px 0 8px;padding-left:10px;border-left:3px solid var(--blue);color:#86b7ff;font-weight:800}
  p{margin:0 0 10px;line-height:1.7}
  .meta{color:var(--muted);font-size:14px}
  .hero{background:linear-gradient(180deg,#17233a 0%,#131d31 100%);border:1px solid var(--line);border-radius:24px;padding:28px;margin-bottom:20px}
  .section{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:18px}
  .hero-judgement{border-left:6px solid ${risk.putStance === "有利" ? "var(--dn)" : risk.putStance === "谨慎" ? "var(--gold)" : "var(--up)"};background:#1b2741}
  .up{color:var(--up);font-weight:700} .dn{color:var(--dn);font-weight:700} .warn{color:var(--gold);font-weight:700}
  .good{color:var(--dn);font-weight:800} .bad{color:var(--up);font-weight:800}
  .highlight{color:var(--blue);font-weight:800}
  .signal-label,.section li>strong,.section p>strong:first-child{color:#86b7ff;font-weight:800}
  .highlight-green{color:var(--dn);font-weight:600} .highlight-red{color:var(--up);font-weight:600} .highlight-yellow{color:var(--gold);font-weight:600}
  .badge-green{background:#1b3a2a;color:var(--dn);padding:2px 12px;border-radius:30px;display:inline-block}
  .badge-red{background:#3d1e2a;color:var(--up);padding:2px 12px;border-radius:30px;display:inline-block}
  .badge-yellow{background:#3d3520;color:var(--gold);padding:2px 12px;border-radius:30px;display:inline-block}
  .tag{background:#1f2b44;border-radius:30px;padding:2px 14px;font-size:0.8rem;color:#b0c4e8;display:inline-block}
  .data-grid{display:flex;flex-wrap:wrap;gap:12px 20px;margin:12px 0}
  .data-item{background:#1a2338;padding:6px 16px 6px 12px;border-radius:40px;border-left:3px solid #314566;font-size:0.95rem}
  .bullet-list{list-style:none;padding-left:0} .bullet-list li{padding:6px 0 6px 8px;position:relative;border-bottom:1px solid #1f2b44}
  .judge-badge{display:inline-block;font-weight:700;padding:6px 24px;border-radius:60px;font-size:1.5rem;margin-right:18px;letter-spacing:1px}
  .judge-reason{font-size:1.1rem;opacity:0.9;margin-top:6px}
  .flex-between{display:flex;justify-content:space-between;align-items:center}
  .mt-2{margin-top:12px} .mb-1{margin-bottom:6px}
  hr{border:0.5px solid var(--line);margin:16px 0;opacity:0.5}
  .inline-icon{margin-right:6px}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
  .chip{border:1px solid #334155;background:#1d2943;color:#dce7fb;border-radius:999px;padding:8px 14px;font-weight:700;font-size:14px}
  .chip-good{border-color:rgba(69,212,131,.48);background:rgba(69,212,131,.14);color:#45d483}
  .chip-warn{border-color:rgba(255,213,74,.5);background:rgba(255,213,74,.14);color:#ffd54a}
  .chip-bad{border-color:rgba(255,107,125,.52);background:rgba(255,107,125,.14);color:#ff6b7d}
  table{width:100%;border-collapse:collapse;margin:12px 0;border-radius:12px;overflow:hidden;font-size:14px}
  th,td{border:1px solid var(--line);padding:10px 12px;text-align:left}
  th{background:#22304d}
  ul{margin:8px 0;padding-left:20px} li{margin-bottom:6px}
  details{margin:16px 0} details>summary{cursor:pointer;font-size:15px;font-weight:700;color:var(--muted);padding:10px 14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;list-style:none}
  details>summary::-webkit-details-marker{display:none} details>summary::before{content:"▸ "} details[open]>summary::before{content:"▾ "}
${reportSectionCss()}
</style></head>
<body><div class="page">
<section class="hero">
  <h1>${safeHtml(symbol)} 综合卖Put决策</h1>
  <p class="meta">报告生成时间：${safeHtml(formatDateTime(generatedAt))}</p>
  <p class="meta">${safeHtml(market.toUpperCase())} · 综合新闻/行情/K线/期权数据</p>
  <div class="chips">
    <span class="chip ${riskTone}">卖Put环境：${safeHtml(risk.putStance)}</span>
    <span class="chip ${decisionTone}">综合结论：${safeHtml(decisionStatus)}</span>
    <span class="chip ${contractDecision?.approved ? "chip-good" : "chip-bad"}">合约执行门槛：${contractDecision?.approved ? "通过" : "阻断"}</span>
    <span class="chip ${riskTone}">尾部风险灯号（启发式）：${safeHtml(risk.blackSwan)}</span>
    <span class="chip ${riskTone}">风险评分：${safeHtml(risk.riskScore)}/10</span>${risk.adjusted ? ` <span class="chip chip-warn">⚠️ 单票调整: ${safeHtml(risk.adjustmentNotes.join("、"))}</span>` : ""}
  </div>
</section>
${contractGateHtml(contractDecision)}
${aiHtml}
<details><summary>实时行情快照</summary><div class="section"><table><thead><tr><th>标的</th><th>最新价</th><th>日变化</th><th>来源</th><th>行情时间</th></tr></thead><tbody>${focusTable(snapshot, symbol)}</tbody></table></div></details>
</div></body></html>`;
}

export default async function handler(req, res) {
  if (!securityCheck(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  const startTime = Date.now();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const market = detectMarket(symbol, body.market);
    const notes = String(body.notes || "").trim();
    const noteContract = extractContractFromNotes(notes);
    let targetStrike = String(body.targetStrike || body.optionMetrics?.targetStrike || noteContract.targetStrike || "").trim();
    let delta = String(body.delta || body.optionMetrics?.delta || noteContract.delta || "").trim();
    let bid = String(body.bid || body.optionMetrics?.bid || noteContract.bid || "").trim();
    let ask = String(body.ask || body.optionMetrics?.ask || noteContract.ask || "").trim();
    let expiryDate = String(body.expiryDate || body.optionMetrics?.expiryDate || noteContract.expiryDate || "").trim();
    const rawMetrics = (body.optionMetrics && typeof body.optionMetrics === "object") ? body.optionMetrics : {};

    if (!symbol) return sendJson(res, 400, { ok: false, message: "缺少标的代码。" });

    if (!targetStrike || !delta || !bid || !ask || !expiryDate) {
      try {
        const contracts = await fetchOptionsChain(symbol, { targetDte: 10 });
        const best = selectBestContract(contracts, 10, 0.15);
        if (best) {
          targetStrike = String(best.strikePrice || "");
          delta = String(best.delta || "");
          bid = String(best.bidPrice || "");
          ask = String(best.askPrice || "");
          expiryDate = String(best.expireDate || "");
        }
      } catch { /* 自动获取失败，沿用已有预检查逻辑 */ }
    }

    const optionMetrics = sanitizeOptionMetrics(rawMetrics);

    const optionMetricsMeta = (body.optionMetricsMeta && typeof body.optionMetricsMeta === "object")
      ? body.optionMetricsMeta
      : {};
    const optionSource = String(optionMetricsMeta.source || "").trim();
    const optionRetrievedAt = String(optionMetricsMeta.retrievedAt || "").trim();
    const optionDelayNote = String(optionMetricsMeta.delayNote || "").trim();
    const optionMetricsBaseText = formatOptionMetrics(optionMetrics);
    const optionMetricsText = [
      optionMetricsBaseText,
      optionSource ? `Data Source: ${optionSource}` : "",
      optionRetrievedAt ? `Data Retrieved At: ${formatDateTime(optionRetrievedAt)}` : "",
      optionDelayNote ? `Data Delay: ${optionDelayNote}` : "",
    ].filter(Boolean).join("\n");

    const dataStartedAt = Date.now();
    const [stockpriceBaseSnapshot, newsData, klineStructure] = await Promise.all([
      loadStockpriceSnapshot().catch(() => ({ data: [], checkedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })),
      loadRecentMarketNews().catch(() => ({ items: [], count: 0 })),
      withTimeLimit(
        analyzeKlineStructure({ symbol, market, interval: "1d", range: "3mo", maxMatchBars: 10, trendSampleScope: "0" }),
        30000,
        "K线分析超过30秒",
      )
        .catch((error) => ({ error: error.message || "K线结构分析失败" })),
    ]);
    const dataElapsedMs = Date.now() - dataStartedAt;
    const stockpriceSnapshot = preferDirectTargetQuote(stockpriceBaseSnapshot, symbol, klineStructure);

    const klineStats = Array.isArray(klineStructure?.bars) ? computeKlineStats(klineStructure.bars) : null;
    const klineStatsFormatted = formatKlineStats(klineStats);
    const klineStructureFormatted = formatKlineStructure(klineStructure);

    const putRating = analyzePutRatingSnapshot(stockpriceSnapshot, symbol, optionMetrics);
    const rawRisk = marketRisk(stockpriceSnapshot, symbol, optionMetrics);
    const risk = adjustedRisk(rawRisk, klineStats, klineStructure);
    const contractDecision = evaluateOptionContract({
      spot: row(stockpriceSnapshot, symbol).last,
      atr: klineStats?.atr,
      expectedRangeLow: optionMetrics.expectedRangeLow,
      targetStrike,
      delta,
      bid,
      ask,
      expiryDate,
      putStance: risk.putStance,
    });

    const newsAnalysis = analyzeDecisionNews(newsData.items, symbol);
    const decisionNewsItems = newsAnalysis.selected;
    const newsText = newsAnalysis.summary;
    const eventRisks = newsAnalysis.eventRisks;
    const eventRisksText = formatEventRisks(eventRisks);
    const readiness = assessDecisionReadiness({
      rows: {
        target: row(stockpriceSnapshot, symbol),
        qqq: row(stockpriceSnapshot, "QQQ"),
        spy: row(stockpriceSnapshot, "SPY"),
        vix: row(stockpriceSnapshot, "^VIX"),
        tnx: row(stockpriceSnapshot, "^TNX"),
        dxy: row(stockpriceSnapshot, "DX-Y.NYB"),
      },
      klineStats,
      klineStructure,
      newsItems: decisionNewsItems,
      optionMetrics,
      targetStrike,
      delta,
      bid,
      ask,
      expiryDate,
    });

    if (!readiness.canIssueDecision) {
      const generatedAt = new Date().toISOString();
      return sendJson(res, 200, {
        ok: true,
        symbol,
        market,
        provider: "完整性门槛",
        used_ai: false,
        report_mode: "precheck",
        status: "预检查",
        risk_score: null,
        missing: readiness.missing,
        warnings: [],
        message: "关键数据尚未齐全，已生成卖Put预检查，不输出完整决策。",
        filename: `${symbol}-sell-put-precheck.html`,
        html: buildPrecheckHtml(symbol, market, readiness, risk, klineStats, optionMetricsText, stockpriceSnapshot, generatedAt),
        generatedAt,
        timings: { dataMs: dataElapsedMs, aiMs: 0, totalMs: Date.now() - startTime },
        elapsedMs: Date.now() - startTime,
      });
    }

    const prompt = buildAnalysisPrompt({
      symbol, market, optionMetricsText,
      optionTemperature: putRating.temperature,
      stockpriceSnapshot, newsText,
      klineStatsFormatted, klineStructureFormatted, notes,
      targetStrike, expiryDate,
      klineStats, risk, rawRisk, eventRisksText, contractDecision,
    });

    const aiStartedAt = Date.now();
    const aiAnalysis = await callAI(prompt);
    let ai = { provider: "规则版", html: "", warning: aiAnalysis.warning };

    if (aiAnalysis.html) {
      try {
        const jsonAnalysis = JSON.parse(aiAnalysis.html.replace(/```json\n?|```/g, '').trim());
        ai = await callAIRender(jsonAnalysis, symbol, market);
      } catch {
        ai = { provider: "规则版", html: "", warning: "AI分析JSON解析失败" };
      }
    }
    const aiElapsedMs = Date.now() - aiStartedAt;
    const cleanHtml = ensureKlineMatchLine(
      sanitizeAiHtml(stripCodeFenceAndExtract(ai.html)),
      klineStructure,
    );
    const ruleDecision = ruleDecisionFromRiskOptionAndContract(risk, contractDecision);
    const aiDecision = extractAiDecisionStatus(cleanHtml);
    const aiAccepted = !!cleanHtml
      && decisionSeverity(aiDecision) >= decisionSeverity(ruleDecision);
    const finalDecision = aiAccepted ? aiDecision : ruleDecision;
    const generatedAt = new Date().toISOString();

    const finalHtml = normalizeReportSections(aiAccepted
      ? buildAiReportWrapper(symbol, market, risk, finalDecision, cleanHtml, stockpriceSnapshot, generatedAt, contractDecision)
      : buildRuleHtml(symbol, market, risk, klineStats, klineStructure, optionMetricsText, stockpriceSnapshot, targetStrike, expiryDate, decisionNewsItems, eventRisks, generatedAt, contractDecision));

    return sendJson(res, 200, {
      ok: true,
      symbol, market,
      provider: aiAccepted ? ai.provider : "规则版",
      used_ai: aiAccepted,
      report_mode: "full",
      status: finalDecision,
      risk_score: risk.riskScore,
      execution_gate: {
        approved: contractDecision.approved,
        status: contractDecision.status,
        blockers: contractDecision.blockers,
        warnings: contractDecision.warnings,
      },
      message: aiAccepted
        ? `综合报告已生成（${ai.provider}）`
        : cleanHtml
          ? "AI结论未通过一致性检查，已生成规则版报告。"
          : "AI暂不可用，已生成规则版报告（含K线技术指标）。",
      filename: `${symbol}-sell-put-decision.html`,
      html: finalHtml,
      generatedAt,
      warnings: ai.warning ? [ai.warning] : [],
      timings: { dataMs: dataElapsedMs, aiMs: aiElapsedMs, totalMs: Date.now() - startTime },
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: error?.name === "AbortError" ? "服务端处理超时，请重试。" : (error?.message || "生成失败"),
    });
  }
}
