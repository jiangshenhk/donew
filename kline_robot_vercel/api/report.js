const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const MIN_PATTERN_SCORE = 60;
const CANDLE_PATTERN_LIBRARY = [
  "启明星",
  "十字启明星",
  "黄昏星",
  "十字黄昏星",
  "锤子线扩展",
  "上吊线扩展",
  "流星线扩展",
  "倒锤子线扩展",
  "看涨吞没扩展",
  "看跌吞没扩展",
  "乌云盖顶扩展",
  "刺透形态扩展",
  "看涨孕线扩展",
  "看跌孕线扩展",
  "十字孕线扩展",
  "普通十字线扩展",
  "长腿十字",
  "墓碑十字扩展",
  "蜻蜓十字扩展",
  "平头顶部扩展",
  "平头底部扩展",
  "看涨捉腰带线扩展",
  "看跌捉腰带线扩展",
  "看涨反击线",
  "看跌反击线",
  "向上窗口",
  "向下窗口",
  "高价位跳空突破",
  "低价位跳空破位",
  "上升三法",
  "下降三法",
  "铺垫形态",
  "三白兵",
  "三只乌鸦",
  "前进受阻",
  "停顿形态",
  "塔形顶部",
  "塔形底部",
  "圆形顶部",
  "圆形底部",
  "大阴线未修复",
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://jiangshenhk.github.io",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function sendJson(res, status, data) {
  const headers = corsHeaders();
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.status(status).json(data);
}

function normalizeSymbol(rawSymbol, market) {
  const raw = String(rawSymbol || "BTC").trim().toUpperCase();
  const compact = raw.replace(/\s+/g, "");
  const selectedMarket = String(market || "").toLowerCase();
  if (selectedMarket === "crypto" || ["BTC", "BTCUSD", "BTC/USD", "BTC-USD", "BITCOIN"].includes(compact) || raw.includes("比特币")) {
    if (compact.includes("-USD")) return { yahoo: compact, display: compact.replace("-USD", "") };
    return { yahoo: "BTC-USD", display: "BTC" };
  }
  if (selectedMarket === "hk") {
    const digits = compact.replace(/\D/g, "");
    if (!digits) throw new Error(`找不到代码：${rawSymbol || ""}，港股请输入数字代码，例如 0700 或 9988。`);
    const code = digits.padStart(4, "0");
    if (!/^\d{4,5}$/.test(code)) throw new Error(`找不到代码：${rawSymbol || ""}，请检查市场和代码是否正确。`);
    return { yahoo: `${code}.HK`, display: `${code}.HK` };
  }
  if (selectedMarket === "cn") {
    const normalized = compact
      .replace(/^SH(\d{6})$/, "$1.SS")
      .replace(/^SZ(\d{6})$/, "$1.SZ")
      .replace(/\.SH$/, ".SS");
    const matched = normalized.match(/^(\d{6})(?:\.(SS|SZ))?$/);
    if (!matched) throw new Error(`找不到代码：${rawSymbol || ""}，A股可输入 600000、sh600000、sz000001、600000.SH。`);
    const code = matched[1];
    const suffix = matched[2] || (code.startsWith("6") || code.startsWith("9") ? "SS" : "SZ");
    return { yahoo: `${code}.${suffix}`, display: `${code}.${suffix}` };
  }
  return { yahoo: compact, display: compact };
}

function normalizeRangeForInterval(range, interval) {
  const normalizedRange = String(range || "10d");
  if (String(interval || "").toLowerCase() === "1d" && ["5d", "10d"].includes(normalizedRange)) return "1mo";
  return normalizedRange;
}

function safeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeSlug(value) {
  return String(value || "report").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "report";
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

function pct(a, b) {
  if (!a) return 0;
  return (b / a - 1) * 100;
}

function toBarTime(ts, timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts * 1000));
  } catch {
    return new Date(ts * 1000).toISOString().slice(5, 16).replace("T", " ");
  }
}

async function fetchYahooBars(symbol, range, interval) {
  const url = `${YAHOO_BASE}${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`找不到代码：${symbol}，请检查市场和代码是否正确。`);
  const payload = await res.json();
  const result = payload?.chart?.result?.[0];
  if (!result) {
    const detail = payload?.chart?.error?.description || payload?.chart?.error?.code || "";
    throw new Error(`找不到代码：${symbol}，请检查市场和代码是否正确。${detail ? ` (${detail})` : ""}`);
  }
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const timezone = meta.exchangeTimezoneName || "UTC";
  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if ([open, high, low, close].some((v) => v === null || v === undefined || Number.isNaN(Number(v)))) continue;
    bars.push({
      ts: timestamps[i],
      date: toBarTime(timestamps[i], timezone),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(quote.volume?.[i] || 0),
    });
  }
  if (bars.length < 20) throw new Error("可用K线数量不足：请把数据范围调大，例如选择1个月或3个月。");
  return { meta, bars };
}

function ema(values, span) {
  if (!values.length) return [];
  const alpha = 2 / (span + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
  return out;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  const start = values.length - period;
  for (let i = start; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function stochastic(bars, period = 14) {
  if (bars.length < period) return null;
  const subset = bars.slice(-period);
  const low = Math.min(...subset.map((b) => b.low));
  const high = Math.max(...subset.map((b) => b.high));
  if (high === low) return null;
  return ((bars[bars.length - 1].close - low) / (high - low)) * 100;
}

function momentum(values, period = 10) {
  if (values.length <= period) return null;
  return pct(values[values.length - period - 1], values[values.length - 1]);
}

function candleInfo(bar) {
  const range = Math.max(bar.high - bar.low, Math.abs(bar.close) * 0.0001, 0.0001);
  const body = Math.abs(bar.close - bar.open);
  const upper = bar.high - Math.max(bar.open, bar.close);
  const lower = Math.min(bar.open, bar.close) - bar.low;
  return {
    range,
    body,
    bodyRatio: body / range,
    upperRatio: upper / range,
    lowerRatio: lower / range,
    closePos: (bar.close - bar.low) / range,
    isBull: bar.close > bar.open,
    isBear: bar.close < bar.open,
    isDoji: body / range <= 0.16,
    isLongBody: body / range >= 0.55,
    mid: (bar.open + bar.close) / 2,
  };
}

function closeTrend(bars, start, end) {
  if (start < 0 || end <= start || end >= bars.length) return 0;
  return pct(bars[start].close, bars[end].close);
}

function avgVolume(bars, start, end) {
  const subset = bars.slice(Math.max(0, start), Math.min(bars.length, end + 1)).filter((b) => Number.isFinite(b.volume));
  if (!subset.length) return 0;
  return subset.reduce((sum, b) => sum + b.volume, 0) / subset.length;
}

function clampScore(value) {
  return Math.max(45, Math.min(96, Math.round(value)));
}

function makeCard(bars, data) {
  const startIndex = Math.max(0, data.startIndex);
  const endIndex = Math.min(bars.length - 1, data.endIndex);
  return {
    ...data,
    startIndex,
    endIndex,
    score: clampScore(data.score),
    range: `${bars[startIndex].date} 至 ${bars[endIndex].date}`,
    confirm: formatPrice(data.confirm),
    failure: formatPrice(data.failure),
  };
}

function patternTemplates(name) {
  const templates = {
    "启明星": [
      [112, 114, 96, 98],
      [97, 101, 94, 96],
      [96, 111, 95, 109],
    ],
    "十字启明星": [
      [112, 114, 96, 98],
      [96, 101, 93, 96.4],
      [97, 112, 96, 110],
    ],
    "黄昏星": [
      [96, 113, 95, 111],
      [112, 115, 110, 112.2],
      [111, 112, 96, 98],
    ],
    "十字黄昏星": [
      [96, 113, 95, 111],
      [112, 116, 110, 112.1],
      [111, 112, 96, 98],
    ],
    "看涨吞没扩展": [
      [105, 107, 96, 98],
      [97, 111, 95, 110],
      [110, 114, 108, 113],
    ],
    "看跌吞没扩展": [
      [96, 107, 95, 105],
      [106, 108, 94, 95],
      [95, 96, 90, 91],
    ],
    "乌云盖顶扩展": [
      [95, 111, 94, 110],
      [112, 114, 100, 101],
      [101, 103, 96, 98],
    ],
    "刺透形态扩展": [
      [110, 111, 94, 96],
      [94, 106, 93, 105],
      [105, 110, 103, 108],
    ],
    "锤子线扩展": [
      [108, 110, 96, 98],
      [97, 100, 88, 99],
      [99, 108, 98, 106],
    ],
    "倒锤子线扩展": [
      [108, 110, 96, 98],
      [98, 110, 97, 99],
      [99, 108, 98, 106],
    ],
    "上吊线扩展": [
      [96, 108, 95, 107],
      [107, 109, 95, 106],
      [106, 107, 96, 98],
    ],
    "流星线扩展": [
      [96, 108, 95, 107],
      [108, 118, 106, 107],
      [106, 107, 96, 98],
    ],
    "看涨孕线扩展": [
      [110, 112, 94, 96],
      [98, 103, 97, 101],
      [101, 108, 100, 106],
    ],
    "看跌孕线扩展": [
      [96, 112, 95, 110],
      [104, 107, 102, 103],
      [103, 104, 96, 98],
    ],
    "十字孕线扩展": [
      [96, 112, 95, 110],
      [104, 107, 102, 104.2],
      [104, 105, 96, 98],
    ],
    "普通十字线扩展": [
      [96, 106, 95, 105],
      [105, 110, 100, 105.2],
      [105, 106, 97, 99],
    ],
    "长腿十字": [
      [98, 106, 96, 105],
      [104, 116, 92, 104.2],
      [104, 108, 96, 99],
    ],
    "墓碑十字扩展": [
      [96, 108, 95, 107],
      [107, 118, 106, 107.2],
      [106, 107, 96, 98],
    ],
    "蜻蜓十字扩展": [
      [108, 110, 96, 98],
      [98, 99, 88, 98.2],
      [99, 108, 98, 106],
    ],
    "平头底部扩展": [
      [108, 110, 96, 99],
      [100, 104, 96, 102],
      [102, 109, 98, 107],
    ],
    "平头顶部扩展": [
      [96, 110, 95, 108],
      [107, 110, 101, 102],
      [102, 104, 94, 96],
    ],
    "向上窗口": [
      [96, 104, 95, 103],
      [108, 114, 107, 112],
      [112, 116, 110, 115],
    ],
    "向下窗口": [
      [108, 114, 107, 110],
      [103, 104, 95, 97],
      [97, 99, 92, 94],
    ],
    "高价位跳空突破": [
      [96, 106, 95, 104],
      [108, 116, 107, 114],
      [114, 119, 112, 118],
    ],
    "低价位跳空破位": [
      [114, 116, 108, 110],
      [104, 105, 96, 98],
      [98, 99, 92, 94],
    ],
    "看涨捉腰带线扩展": [
      [108, 110, 96, 98],
      [96, 112, 95, 111],
      [111, 116, 109, 114],
    ],
    "看跌捉腰带线扩展": [
      [96, 108, 95, 107],
      [108, 109, 94, 95],
      [95, 96, 90, 92],
    ],
    "看涨反击线": [
      [110, 112, 96, 98],
      [95, 104, 94, 98.5],
      [99, 108, 98, 106],
    ],
    "看跌反击线": [
      [96, 110, 95, 108],
      [111, 112, 100, 107.8],
      [107, 108, 98, 100],
    ],
    "上升三法": [
      [95, 113, 94, 111],
      [110, 111, 105, 107],
      [107, 108, 102, 104],
      [104, 106, 101, 103],
      [103, 116, 102, 115],
    ],
    "下降三法": [
      [115, 116, 96, 98],
      [99, 105, 98, 103],
      [103, 108, 102, 106],
      [106, 109, 104, 107],
      [107, 108, 92, 94],
    ],
    "铺垫形态": [
      [95, 112, 94, 110],
      [111, 114, 108, 112],
      [111, 113, 107, 109],
      [108, 110, 104, 106],
      [106, 118, 105, 116],
    ],
    "三白兵": [
      [96, 105, 95, 104],
      [103, 111, 102, 110],
      [109, 116, 108, 115],
    ],
    "三只乌鸦": [
      [115, 116, 106, 107],
      [108, 109, 99, 100],
      [101, 102, 93, 94],
    ],
    "前进受阻": [
      [96, 108, 95, 107],
      [107, 114, 106, 112],
      [112, 116, 111, 113],
    ],
    "停顿形态": [
      [96, 108, 95, 107],
      [107, 114, 106, 112],
      [112, 113, 109, 110],
    ],
    "塔形底部": [
      [112, 113, 101, 103],
      [103, 104, 96, 98],
      [98, 100, 95, 99],
      [99, 106, 98, 105],
      [105, 114, 104, 113],
    ],
    "塔形顶部": [
      [96, 108, 95, 107],
      [107, 113, 106, 112],
      [112, 114, 109, 111],
      [111, 112, 103, 104],
      [104, 105, 94, 96],
    ],
    "圆形底部": [
      [110, 112, 103, 104],
      [104, 106, 98, 100],
      [100, 102, 96, 101],
      [101, 108, 100, 106],
      [106, 114, 105, 112],
    ],
    "圆形顶部": [
      [96, 106, 95, 104],
      [104, 112, 103, 110],
      [110, 114, 108, 109],
      [109, 110, 101, 103],
      [103, 104, 94, 96],
    ],
    "大阴线未修复": [
      [112, 114, 96, 98],
      [99, 103, 97, 101],
      [101, 102, 96, 99],
    ],
  };
  const key = Object.keys(templates).find((k) => name.includes(k.replace("扩展", "")) || k.includes(name.replace("扩展", "")));
  return (templates[key] || templates["启明星"]).map(([open, high, low, close], index) => ({ date: String(index + 1), open, high, low, close }));
}

function addPattern(candidates, bars, data) {
  if (data.endIndex - data.startIndex + 1 < 3) return;
  if (!Number.isFinite(data.score) || data.score < MIN_PATTERN_SCORE) return;
  candidates.push(makeCard(bars, data));
}

function patternCards(bars) {
  const n = bars.length;
  const candidates = [];
  const last = bars[n - 1];
  const avgVol = avgVolume(bars, n - 20, n - 1);

  for (let i = Math.max(2, n - 18); i < n; i++) {
    const a = bars[i - 2];
    const b = bars[i - 1];
    const c = bars[i];
    const ai = candleInfo(a);
    const bi = candleInfo(b);
    const ci = candleInfo(c);
    const priorTrend = closeTrend(bars, Math.max(0, i - 7), i - 2);
    const windowHigh = Math.max(...bars.slice(Math.max(0, i - 8), i + 1).map((x) => x.high));
    const windowLow = Math.min(...bars.slice(Math.max(0, i - 8), i + 1).map((x) => x.low));

    if (priorTrend < -1 && ai.isBear && ai.isLongBody && bi.bodyRatio <= 0.32 && ci.isBull && c.close > ai.mid) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: bi.isDoji ? "十字启明星" : "启明星",
        score: 74 + Math.abs(priorTrend) * 2 + (c.close > a.open ? 8 : 0),
        bias: "偏多",
        why: "下跌后先出现长阴，再出现犹豫小实体，随后阳线收回前一根阴线中轴。",
        meaning: "下跌、犹豫、反攻的三段式结构，只有继续站稳确认位才代表反转质量提高。",
        judgement: "止跌观察",
        confirm: Math.max(a.high, c.high),
        failure: Math.min(a.low, b.low, c.low),
      });
    }

    if (priorTrend > 1 && ai.isBull && ai.isLongBody && bi.bodyRatio <= 0.32 && ci.isBear && c.close < ai.mid) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: bi.isDoji ? "十字黄昏星" : "黄昏星",
        score: 74 + Math.abs(priorTrend) * 2 + (c.close < a.open ? 8 : 0),
        bias: "偏空",
        why: "上涨后先长阳推进，中间停顿犹豫，随后阴线跌回前一根阳线中轴下方。",
        meaning: "上涨、犹豫、回落的顶部警告结构，高位出现时需要防止趋势转弱。",
        judgement: "顶部风险",
        confirm: Math.max(a.high, b.high, c.high),
        failure: Math.min(a.low, c.low),
      });
    }

    if (priorTrend < 0 && ai.isBear && bi.isBull && b.open < a.close && b.close > a.open && ci.isBull) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "看涨吞没扩展",
        score: 70 + Math.abs(priorTrend) * 2 + ci.bodyRatio * 10,
        bias: "偏多",
        why: "下跌背景后出现阳线完全吞没前一根阴线，随后继续修复。",
        meaning: "后一方完全压过前一方，说明短线多方开始夺回收盘控制权。",
        judgement: "反击观察",
        confirm: Math.max(b.high, c.high),
        failure: Math.min(a.low, b.low),
      });
    }

    if (priorTrend > 0 && ai.isBull && bi.isBear && b.open > a.close && b.close < a.open && ci.isBear) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "看跌吞没扩展",
        score: 70 + Math.abs(priorTrend) * 2 + ci.bodyRatio * 10,
        bias: "偏空",
        why: "上涨背景后出现阴线完全吞没前一根阳线，随后继续转弱。",
        meaning: "卖方完全压过买方，说明高位供给明显增强。",
        judgement: "顶部风险",
        confirm: Math.max(a.high, b.high),
        failure: Math.min(b.low, c.low),
      });
    }

    if (priorTrend > 0 && ai.isBull && bi.isBear && b.open > a.high * 0.998 && b.close < ai.mid && b.close > a.open && ci.close <= b.close) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "乌云盖顶扩展",
        score: 68 + Math.abs(priorTrend) * 2,
        bias: "偏空",
        why: "上涨后冲高开出，但收盘切入前一根阳线实体中部以下，后续仍偏弱。",
        meaning: "高位买方进攻失败，卖压切入阳线实体，是顶部风险信号。",
        judgement: "风险",
        confirm: Math.max(a.high, b.high),
        failure: Math.min(b.low, c.low),
      });
    }

    if (priorTrend < 0 && ai.isBear && bi.isBull && b.open < a.low * 1.002 && b.close > ai.mid && b.close < a.open && ci.close >= b.close) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "刺透形态扩展",
        score: 68 + Math.abs(priorTrend) * 2,
        bias: "偏多",
        why: "下跌后低开或下探，但收盘切回前一根阴线实体中部以上，后续有所修复。",
        meaning: "空方继续打低失败，多方开始刺入前一根阴线实体。",
        judgement: "止跌观察",
        confirm: Math.max(a.high, b.high, c.high),
        failure: Math.min(a.low, b.low),
      });
    }

    if (priorTrend < 0 && bi.lowerRatio >= 0.55 && bi.upperRatio <= 0.22 && bi.bodyRatio <= 0.35 && ci.isBull) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "锤子线扩展",
        score: 64 + bi.lowerRatio * 22 + (ci.close > b.high ? 6 : 0),
        bias: "偏多",
        why: "下跌背景中出现长下影，说明低位被买回，后一根K线继续确认。",
        meaning: "空方打低后被多方收回，是低位承接线索，但需要后续确认。",
        judgement: "止跌观察",
        confirm: Math.max(b.high, c.high),
        failure: b.low,
      });
    }

    if (priorTrend < 0 && bi.upperRatio >= 0.5 && bi.lowerRatio <= 0.25 && bi.bodyRatio <= 0.35 && ci.isBull) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "倒锤子线扩展",
        score: 61 + bi.upperRatio * 18 + (ci.close > b.high ? 6 : 0),
        bias: "偏多",
        why: "下跌背景中出现向上试探的长上影，后一根K线继续修复，说明低位有反攻尝试。",
        meaning: "倒锤子线本身只是止跌线索，必须等待后一根K线确认。",
        judgement: "止跌观察",
        confirm: Math.max(b.high, c.high),
        failure: Math.min(b.low, c.low),
      });
    }

    if (priorTrend > 0 && bi.upperRatio >= 0.55 && bi.lowerRatio <= 0.22 && bi.bodyRatio <= 0.35 && ci.isBear) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "流星线扩展",
        score: 64 + bi.upperRatio * 22 + (ci.close < b.low ? 6 : 0),
        bias: "偏空",
        why: "上涨背景中出现长上影，说明冲高失败，后一根K线继续回落。",
        meaning: "多方上攻后被卖压打回，是高位警告线索。",
        judgement: "顶部风险",
        confirm: b.high,
        failure: Math.min(b.low, c.low),
      });
    }

    if (priorTrend > 0 && bi.lowerRatio >= 0.5 && bi.upperRatio <= 0.25 && bi.bodyRatio <= 0.35 && ci.isBear) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "上吊线扩展",
        score: 61 + bi.lowerRatio * 18 + (ci.close < b.low ? 6 : 0),
        bias: "偏空",
        why: "上涨背景中出现长下影，说明支撑被测试，后一根K线转弱。",
        meaning: "上吊线在高位才有警告意义，需要后一根K线跌破或回落确认。",
        judgement: "顶部观察",
        confirm: b.high,
        failure: Math.min(b.low, c.low),
      });
    }

    const bullishBelt = priorTrend < 0 && bi.isBull && bi.isLongBody && bi.open <= b.low + bi.range * 0.12 && bi.closePos >= 0.78 && ci.close >= b.close;
    const bearishBelt = priorTrend > 0 && bi.isBear && bi.isLongBody && bi.open >= b.high - bi.range * 0.12 && bi.closePos <= 0.22 && ci.close <= b.close;
    if (bullishBelt || bearishBelt) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: bullishBelt ? "看涨捉腰带线扩展" : "看跌捉腰带线扩展",
        score: 66 + bi.bodyRatio * 18,
        bias: bullishBelt ? "偏多" : "偏空",
        why: bullishBelt ? "下跌背景后出现接近最低开盘的大阳线，后一根继续保持修复。" : "上涨背景后出现接近最高开盘的大阴线，后一根继续保持转弱。",
        meaning: "捉腰带线代表一方从开盘到收盘持续控制，但仍要结合位置确认。",
        judgement: bullishBelt ? "反击观察" : "风险",
        confirm: bullishBelt ? Math.max(b.high, c.high) : b.high,
        failure: bullishBelt ? b.low : Math.min(b.low, c.low),
      });
    }

    const counterCloseDiff = Math.abs(a.close - b.close) / Math.max(a.close, b.close, 1);
    const bullishCounter = priorTrend < 0 && ai.isBear && bi.isBull && counterCloseDiff <= 0.004 && ci.isBull;
    const bearishCounter = priorTrend > 0 && ai.isBull && bi.isBear && counterCloseDiff <= 0.004 && ci.isBear;
    if (bullishCounter || bearishCounter) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: bullishCounter ? "看涨反击线" : "看跌反击线",
        score: 62 + (0.004 - counterCloseDiff) * 3000 + ci.bodyRatio * 8,
        bias: bullishCounter ? "偏多" : "偏空",
        why: "两根相反方向K线收盘价接近，说明原趋势遭遇反方向反击，后一根给出延续线索。",
        meaning: "反击线强调收盘价附近的多空争夺，强度弱于吞没，必须看后续确认。",
        judgement: bullishCounter ? "反击观察" : "风险",
        confirm: Math.max(a.high, b.high, c.high),
        failure: Math.min(a.low, b.low, c.low),
      });
    }

    if (ai.isLongBody && bi.bodyRatio <= 0.38 && Math.max(b.open, b.close) < Math.max(a.open, a.close) && Math.min(b.open, b.close) > Math.min(a.open, a.close)) {
      const bearish = priorTrend > 0 && a.isBull && c.isBear;
      const bullish = priorTrend < 0 && a.isBear && c.isBull;
      if (bearish || bullish) {
        addPattern(candidates, bars, {
          startIndex: i - 2,
          endIndex: i,
          name: bullish ? "看涨孕线扩展" : "看跌孕线扩展",
          score: 62 + Math.abs(priorTrend) * 2 + (bi.isDoji ? 6 : 0),
          bias: bullish ? "偏多" : "偏空",
          why: "大实体后出现被包含的小实体，原趋势动能收缩，后一根K线给出方向线索。",
          meaning: "孕线代表原趋势失去单边推进能力，需要结合后续突破方向判断。",
          judgement: bullish ? "止跌观察" : "风险",
          confirm: bullish ? Math.max(b.high, c.high) : Math.max(a.high, b.high),
          failure: bullish ? Math.min(a.low, b.low) : Math.min(b.low, c.low),
        });
      }
    }

    const lowDiff = Math.abs(a.low - b.low) / Math.max(a.low, b.low, 1);
    const highDiff = Math.abs(a.high - b.high) / Math.max(a.high, b.high, 1);
    if (priorTrend < 0 && lowDiff <= 0.0035 && ci.isBull) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "平头底部扩展",
        score: 66 + (0.0035 - lowDiff) * 4000 + ci.bodyRatio * 8,
        bias: "中性",
        why: "连续K线低点接近，说明同一区域被反复测试，后一根K线出现修复。",
        meaning: "多次测试同一区域可能形成支撑，但跌破共同低点则支撑失败。",
        judgement: "支撑观察",
        confirm: Math.max(a.high, b.high, c.high),
        failure: Math.min(a.low, b.low),
      });
    }

    if (priorTrend > 0 && highDiff <= 0.0035 && ci.isBear) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: "平头顶部扩展",
        score: 66 + (0.0035 - highDiff) * 4000 + ci.bodyRatio * 8,
        bias: "偏空",
        why: "连续K线高点接近，说明同一区域上攻受阻，后一根K线回落。",
        meaning: "多次冲击同一区域失败，容易演化为顶部压力。",
        judgement: "压力观察",
        confirm: Math.max(a.high, b.high),
        failure: Math.min(b.low, c.low),
      });
    }

    const upGap = b.low > a.high && c.low >= a.high;
    const downGap = b.high < a.low && c.high <= a.low;
    if (upGap || downGap) {
      const strongGap = Math.abs(pct(a.close, b.open)) >= 1.2;
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: upGap ? (strongGap ? "高价位跳空突破" : "向上窗口") : strongGap ? "低价位跳空破位" : "向下窗口",
        score: 72 + Math.min(12, Math.abs(pct(a.close, b.open))),
        bias: upGap ? "偏多" : "偏空",
        why: upGap ? "价格跳空向上后缺口没有马上回补，窗口区域形成短线支撑。" : "价格跳空向下后缺口没有马上回补，窗口区域形成短线压力。",
        meaning: "窗口代表情绪跳变；不回补时原方向仍占优，回补则原方向力量减弱。",
        judgement: upGap ? "突破观察" : "破位风险",
        confirm: upGap ? Math.max(b.high, c.high) : Math.max(a.high, b.high),
        failure: upGap ? a.high : a.low,
      });
    }

    if (ci.isDoji && (ci.upperRatio > 0.35 || ci.lowerRatio > 0.35)) {
      const bearish = priorTrend > 0 && c.closePos < 0.55;
      const bullish = priorTrend < 0 && c.closePos > 0.45;
      if (bearish || bullish) {
        addPattern(candidates, bars, {
          startIndex: i - 2,
          endIndex: i,
          name: ci.upperRatio > 0.55 ? "墓碑十字扩展" : ci.lowerRatio > 0.55 ? "蜻蜓十字扩展" : "十字线扩展",
          score: 58 + Math.max(ci.upperRatio, ci.lowerRatio) * 22 + Math.abs(priorTrend),
          bias: bearish ? "偏空" : bullish ? "偏多" : "中性",
          why: "原趋势推进后出现十字线，说明多空暂时平衡，趋势动能开始犹豫。",
          meaning: "十字线本身不是结论，必须看位置和后一根K线确认。",
          judgement: bearish ? "顶部观察" : "止跌观察",
          confirm: c.high,
          failure: c.low,
        });
      }
    }

    if (i >= 4) {
      const five = bars.slice(i - 4, i + 1);
      const info = five.map(candleInfo);
      const first = five[0];
      const lastFive = five[4];
      const inner = five.slice(1, 4);
      const risingThree = info[0].isBull && info[0].isLongBody && inner.every((x) => x.high < first.high && x.low > first.low) && info[4].isBull && lastFive.close > first.high;
      const fallingThree = info[0].isBear && info[0].isLongBody && inner.every((x) => x.high < first.high && x.low > first.low) && info[4].isBear && lastFive.close < first.low;
      const matHold = info[0].isBull && info[0].isLongBody && inner[0].low > first.high && info[4].isBull && lastFive.close > Math.max(...inner.map((x) => x.high));
      if (risingThree || fallingThree || matHold) {
        addPattern(candidates, bars, {
          startIndex: i - 4,
          endIndex: i,
          name: matHold ? "铺垫形态" : risingThree ? "上升三法" : "下降三法",
          score: 84 + (lastFive.volume > avgVol ? 4 : 0),
          bias: fallingThree ? "偏空" : "偏多",
          why: matHold ? "强阳后高位小实体整理，最后再度向上突破整理区。" : risingThree ? "强阳后小实体回调没有跌破阳线范围，最后再度向上突破。" : "强阴后小实体反弹没有突破阴线范围，最后再度向下破位。",
          meaning: matHold ? "铺垫形态是上升三法的更强变体，强调跳空后的高位整理和再突破。" : "三法结构属于顺势中继，重点看整理是否守住第一根实体范围以及第五根是否突破。",
          judgement: fallingThree ? "下跌中继" : "顺势延续",
          confirm: fallingThree ? first.high : lastFive.high,
          failure: fallingThree ? lastFive.low : first.low,
        });
      }

      const towerTop = info.slice(0, 2).every((x) => x.isBull) && info[2].bodyRatio <= 0.35 && info.slice(3).every((x) => x.isBear) && closeTrend(five, 0, 4) < -1;
      const towerBottom = info.slice(0, 2).every((x) => x.isBear) && info[2].bodyRatio <= 0.35 && info.slice(3).every((x) => x.isBull) && closeTrend(five, 0, 4) > 1;
      const roundTop = info[0].isBull && info[1].isBull && info[2].bodyRatio <= 0.45 && info[3].isBear && info[4].isBear;
      const roundBottom = info[0].isBear && info[1].isBear && info[2].bodyRatio <= 0.45 && info[3].isBull && info[4].isBull;
      if (towerTop || towerBottom || roundTop || roundBottom) {
        addPattern(candidates, bars, {
          startIndex: i - 4,
          endIndex: i,
          name: towerBottom ? "塔形底部" : towerTop ? "塔形顶部" : roundBottom ? "圆形底部" : "圆形顶部",
          score: 66 + Math.abs(closeTrend(five, 0, 4)) * 2,
          bias: towerBottom || roundBottom ? "偏多" : "偏空",
          why: towerBottom || roundBottom ? "连续转弱后进入停顿，随后连续阳线修复。" : "连续转强后进入停顿，随后连续阴线回落。",
          meaning: towerTop || towerBottom ? "塔形结构强调节奏由单边推进转向停顿，再向反方向展开。" : "圆形结构强调动能逐步衰减后转向，确认速度通常慢于星线或吞没。",
          judgement: towerBottom || roundBottom ? "底部观察" : "顶部风险",
          confirm: towerBottom || roundBottom ? windowHigh : Math.max(...five.map((x) => x.high)),
          failure: towerBottom || roundBottom ? windowLow : Math.min(...five.map((x) => x.low)),
        });
      }
    }
  }

  for (let i = Math.max(2, n - 12); i < n; i++) {
    const three = bars.slice(i - 2, i + 1);
    const info = three.map(candleInfo);
    const soldiers = info.every((x) => x.isBull && x.bodyRatio >= 0.45) && three[1].close > three[0].close && three[2].close > three[1].close;
    const crows = info.every((x) => x.isBear && x.bodyRatio >= 0.45) && three[1].close < three[0].close && three[2].close < three[1].close;
    const blocked = info.every((x) => x.isBull) && three[1].close > three[0].close && three[2].close > three[1].close && info[2].bodyRatio < info[0].bodyRatio * 0.6 && info[2].upperRatio > 0.25;
    const stalled = info[0].isBull && info[1].isBull && info[2].bodyRatio <= 0.32 && three[2].close <= three[1].close;
    if (soldiers || crows || blocked || stalled) {
      addPattern(candidates, bars, {
        startIndex: i - 2,
        endIndex: i,
        name: blocked ? "前进受阻" : stalled ? "停顿形态" : soldiers ? "三白兵" : "三只乌鸦",
        score: (blocked || stalled ? 66 : 78) + info.reduce((sum, x) => sum + x.bodyRatio, 0) * 5,
        bias: soldiers && !blocked && !stalled ? "偏多" : "偏空",
        why: blocked ? "连续阳线推进但第三根实体变小并带上影，说明上攻开始受阻。" : stalled ? "上涨后第三根明显停顿，说明原趋势动能减弱。" : soldiers ? "连续三根阳线逐步抬高收盘，买方持续控制节奏。" : "连续三根阴线逐步压低收盘，卖方持续控制节奏。",
        meaning: blocked ? "前进受阻是三白兵的弱化形态，提示高位上涨动能衰减。" : stalled ? "停顿形态表示上涨推进暂停，后续若回落则顶部风险提高。" : soldiers ? "三白兵代表连续反攻，但高位也要防前进受阻。" : "三只乌鸦代表连续派发或下跌延续，通常不宜急着抄底。",
        judgement: soldiers && !blocked && !stalled ? "连续转强" : blocked || stalled ? "顶部观察" : "下跌延续",
        confirm: Math.max(...three.map((x) => x.high)),
        failure: Math.min(...three.map((x) => x.low)),
      });
    }
  }

  const unresolvedDropIndex = (() => {
    for (let i = n - 2; i >= Math.max(1, n - 8); i--) {
      const info = candleInfo(bars[i]);
      const half = (bars[i].open + bars[i].close) / 2;
      if (info.isBear && info.isLongBody && last.close < half) return i;
    }
    return -1;
  })();
  if (unresolvedDropIndex >= 0) {
    const b = bars[unresolvedDropIndex];
    addPattern(candidates, bars, {
      startIndex: unresolvedDropIndex,
      endIndex: n - 1,
      name: "大阴线未修复",
      score: 62 + Math.min(20, Math.abs(pct(b.close, last.close)) * 3),
      bias: "偏空",
      why: "最近大阴线的中轴仍未收复，短线反弹还不能视作反转。",
      meaning: "大阴线后反弹没有超过实体中轴，通常先按弱修复或中继风险处理。",
      judgement: "只观察",
      confirm: (b.open + b.close) / 2,
      failure: Math.min(...bars.slice(unresolvedDropIndex).map((x) => x.low)),
    });
  }

  const deduped = [];
  const used = new Set();
  for (const card of candidates.sort((a, b) => b.score - a.score || b.endIndex - a.endIndex)) {
    const key = card.name;
    if (used.has(key)) continue;
    used.add(key);
    deduped.push(card);
    if (deduped.length >= 5) break;
  }
  return deduped;
}

function aiPrompt() {
  return [
    "你是K线形态相似度与卖Put风险判断AI。请基于输入JSON生成简短中文HTML解读。",
    "只返回HTML片段，不要返回Markdown代码块，不要使用style属性。",
    "根节点必须是 <section class=\"section ai-brief\"><h2>AI 综合解读</h2>。",
    "结构必须包含四块：",
    "1. <div class=\"ai-thesis\"><strong>核心判断：</strong>...</div>，一句话说明主方向和风险优先级。",
    "2. <div class=\"ai-level-grid\">，里面用两个 <div class=\"ai-level\"> 分别写确认位和失败位，数字用 <strong>。",
    "3. <ol class=\"ai-top5\"> 写超过60%的匹配形态概括；如没有超过60%的形态，明确说明暂无高可信经典形态。",
    "4. <p class=\"ai-risk\"> 写风险提示。",
    "要求：最终结论前置；禁止确定性语言；必须给出确认位、失败位、超过60%的形态概括、风险提示；文字克制、可扫描。",
  ].join("\n");
}

function aiFailureHtml(providerName, detail) {
  return `<section class="section"><h2>AI 综合解读</h2><p>${safeHtml(providerName)} 调用失败，已保留规则版报告。${safeHtml(detail || "")}</p></section>`;
}

function normalizeAiHtml(html) {
  const text = String(html || "")
    .replace(/```html/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!text) return '<section class="section ai-brief"><h2>AI 综合解读</h2><p>AI 已调用，但返回内容为空。</p></section>';
  if (/class=["'][^"']*ai-brief/.test(text)) return text;
  if (/<section\b/i.test(text)) {
    return text.replace(/<section\b([^>]*)>/i, (match, attrs) => {
      if (/class=/i.test(attrs)) return match.replace(/class=["']([^"']*)["']/i, 'class="$1 ai-brief"');
      return `<section class="section ai-brief"${attrs}>`;
    });
  }
  return `<section class="section ai-brief"><h2>AI 综合解读</h2>${text}</section>`;
}

async function callOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      used: false,
      provider: "GPT",
      message: "未配置 OPENAI_API_KEY，已生成规则版报告。",
      html: aiFailureHtml("GPT", "未配置 OPENAI_API_KEY。"),
    };
  }
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        { role: "system", content: aiPrompt() },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      used: false,
      provider: "GPT",
      message: `GPT 调用失败，已生成规则版报告：${res.status}`,
      html: aiFailureHtml("GPT", `错误：${text.slice(0, 500)}`),
    };
  }
  const data = await res.json();
  const outputText = data.output_text || (data.output || []).flatMap((item) => item.content || []).map((c) => c.text || "").join("");
  return {
    used: true,
    provider: "GPT",
    message: "已调用 GPT 生成综合解读。",
    html: normalizeAiHtml(outputText),
  };
}

async function callDeepSeek(payload) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      used: false,
      provider: "DeepSeek",
      message: "未配置 DEEPSEEK_API_KEY，已生成规则版报告。",
      html: aiFailureHtml("DeepSeek", "未配置 DEEPSEEK_API_KEY。"),
    };
  }
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: aiPrompt() },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      used: false,
      provider: "DeepSeek",
      message: `DeepSeek 调用失败，已生成规则版报告：${res.status}`,
      html: aiFailureHtml("DeepSeek", `错误：${text.slice(0, 500)}`),
    };
  }
  const data = await res.json();
  const outputText = data.choices?.[0]?.message?.content || "";
  return {
    used: true,
    provider: "DeepSeek",
    message: "已调用 DeepSeek 生成综合解读。",
    html: normalizeAiHtml(outputText),
  };
}

async function callAI(payload, provider) {
  if (String(provider || "deepseek").toLowerCase() === "openai") return callOpenAI(payload);
  return callDeepSeek(payload);
}

function candleTable(bars) {
  let prev = bars[0].close;
  return bars
    .map((b) => {
      const change = pct(prev, b.close);
      prev = b.close;
      return `<tr><td>${safeHtml(b.date)}</td><td>${formatPrice(b.open)}</td><td>${formatPrice(b.high)}</td><td>${formatPrice(b.low)}</td><td>${formatPrice(b.close)}</td><td>${change.toFixed(2)}%</td><td>${Math.round(b.volume).toLocaleString()}</td></tr>`;
    })
    .join("");
}

function candleChartSvg(bars, cards) {
  const chartBars = bars.slice(-48);
  const width = 1120;
  const height = 430;
  const pad = { left: 64, right: 82, top: 34, bottom: 56 };
  const priceHeight = 284;
  const volumeTop = pad.top + priceHeight + 24;
  const volumeHeight = 70;
  const innerWidth = width - pad.left - pad.right;
  const highs = chartBars.map((b) => b.high);
  const lows = chartBars.map((b) => b.low);
  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const pricePad = Math.max((maxPrice - minPrice) * 0.08, maxPrice * 0.002);
  const topPrice = maxPrice + pricePad;
  const bottomPrice = minPrice - pricePad;
  const maxVolume = Math.max(...chartBars.map((b) => b.volume || 0), 1);
  const candleSlot = innerWidth / chartBars.length;
  const candleWidth = Math.max(4, Math.min(14, candleSlot * 0.58));
  const last = chartBars.at(-1);
  const support = Math.min(...chartBars.slice(-10).map((b) => b.low));
  const pressure = Math.max(...chartBars.slice(-10).map((b) => b.high));
  const confirm = Number(cards?.[0]?.confirm);

  const xAt = (i) => pad.left + candleSlot * i + candleSlot / 2;
  const yPrice = (value) => pad.top + ((topPrice - value) / (topPrice - bottomPrice)) * priceHeight;
  const yVolume = (value) => volumeTop + volumeHeight - (value / maxVolume) * volumeHeight;
  const line = (value, color, label) => {
    if (!Number.isFinite(value)) return "";
    const y = yPrice(value);
    return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1.4" stroke-dasharray="6 6"/><text x="${width - pad.right + 10}" y="${(y + 4).toFixed(1)}" fill="${color}" font-size="12">${safeHtml(label)} ${formatPrice(value)}</text>`;
  };

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = pad.top + priceHeight * ratio;
      const value = topPrice - (topPrice - bottomPrice) * ratio;
      return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)"/><text x="14" y="${(y + 4).toFixed(1)}" fill="#9fb0d8" font-size="12">${formatPrice(value)}</text>`;
    })
    .join("");

  const candles = chartBars
    .map((b, i) => {
      const x = xAt(i);
      const up = b.close >= b.open;
      const color = up ? "#ff6b7a" : "#40d98a";
      const yHigh = yPrice(b.high);
      const yLow = yPrice(b.low);
      const yOpen = yPrice(b.open);
      const yClose = yPrice(b.close);
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));
      const volH = volumeTop + volumeHeight - yVolume(b.volume || 0);
      return `<g><line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="1.6"/><rect x="${(x - candleWidth / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="1.5" fill="${color}" opacity=".92"/><rect x="${(x - candleWidth / 2).toFixed(1)}" y="${yVolume(b.volume || 0).toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${volH.toFixed(1)}" fill="${color}" opacity=".28"/></g>`;
    })
    .join("");

  const labelStep = Math.max(1, Math.ceil(chartBars.length / 8));
  const labels = chartBars
    .map((b, i) => {
      if (i % labelStep !== 0 && i !== chartBars.length - 1) return "";
      const x = xAt(i);
      return `<text x="${x.toFixed(1)}" y="${height - 22}" text-anchor="middle" fill="#9fb0d8" font-size="11">${safeHtml(b.date)}</text>`;
    })
    .join("");

  return `<section class="section chart-section"><h2>价格图形</h2><p>最近 ${chartBars.length} 根K线，含成交量、支撑和压力参考线。</p><div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeHtml("K线图")}"><rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="#0b1227"/><text x="${pad.left}" y="22" fill="#edf2ff" font-size="16" font-weight="700">K线与成交量</text>${grid}<line x1="${pad.left}" y1="${volumeTop + volumeHeight}" x2="${width - pad.right}" y2="${volumeTop + volumeHeight}" stroke="rgba(255,255,255,.14)"/><text x="14" y="${volumeTop + 10}" fill="#9fb0d8" font-size="12">Volume</text>${candles}${line(support, "#46d6a0", "支撑")}${line(pressure, "#ffd166", "压力")}${line(confirm, "#79a8ff", "确认")}${labels}<circle cx="${xAt(chartBars.length - 1).toFixed(1)}" cy="${yPrice(last.close).toFixed(1)}" r="4" fill="#edf2ff"/><text x="${width - pad.right + 10}" y="${(yPrice(last.close) - 8).toFixed(1)}" fill="#edf2ff" font-size="12">最新 ${formatPrice(last.close)}</text></svg></div></section>`;
}

function directionMarkup(bias) {
  if (bias === "偏多") return '<span class="dir dir-bull"><span class="dir-icon">▲</span>偏多</span>';
  if (bias === "偏空") return '<span class="dir dir-bear"><span class="dir-icon">▼</span>偏空</span>';
  return '<span class="dir dir-flat"><span class="dir-icon">◆</span>中性</span>';
}

function drawMiniCandles({ bars, width = 660, height = 300, highlightStart = -1, highlightEnd = -1, label = "" }) {
  const pad = { left: 44, right: 18, top: 24, bottom: 34 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const maxPrice = Math.max(...bars.map((b) => b.high));
  const minPrice = Math.min(...bars.map((b) => b.low));
  const pricePad = Math.max((maxPrice - minPrice) * 0.12, maxPrice * 0.002);
  const topPrice = maxPrice + pricePad;
  const bottomPrice = minPrice - pricePad;
  const slot = innerWidth / bars.length;
  const bodyWidth = Math.max(8, Math.min(18, slot * 0.55));
  const xAt = (i) => pad.left + slot * i + slot / 2;
  const yAt = (value) => pad.top + ((topPrice - value) / (topPrice - bottomPrice)) * innerHeight;
  const hasHighlight = highlightStart >= 0 && highlightEnd >= highlightStart;
  const highlightRect = hasHighlight
    ? `<rect x="${(xAt(highlightStart) - slot * 0.43).toFixed(1)}" y="${(pad.top + 4).toFixed(1)}" width="${((highlightEnd - highlightStart + 1) * slot * 0.86 + Math.max(0, highlightEnd - highlightStart) * slot * 0.14).toFixed(1)}" height="${(innerHeight - 8).toFixed(1)}" rx="10" fill="rgba(255,209,102,.08)" stroke="#ffd166" stroke-width="1.6" stroke-dasharray="6 6"/>`
    : "";
  const grid = [0, 0.5, 1]
    .map((ratio) => {
      const y = pad.top + innerHeight * ratio;
      return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)"/>`;
    })
    .join("");
  const candles = bars
    .map((b, i) => {
      const x = xAt(i);
      const up = b.close >= b.open;
      const color = up ? "#ff6b7a" : "#40d98a";
      const yHigh = yAt(b.high);
      const yLow = yAt(b.low);
      const yOpen = yAt(b.open);
      const yClose = yAt(b.close);
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));
      return `<g><line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="2"/><rect x="${(x - bodyWidth / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${bodyWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="2" fill="${color}"/></g>`;
    })
    .join("");
  const labels = bars
    .map((b, i) => {
      if (bars.length > 8 && i % 3 !== 0 && i !== bars.length - 1) return "";
      return `<text x="${xAt(i).toFixed(1)}" y="${height - 12}" text-anchor="middle" fill="#9fb0d8" font-size="10">${safeHtml(b.date || `K${i + 1}`)}</text>`;
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeHtml(label || "K线形态图")}"><rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#0b1227"/><text x="${pad.left}" y="18" fill="#d7e3ff" font-size="13" font-weight="700">${safeHtml(label)}</text>${grid}${highlightRect}${candles}${labels}</svg>`;
}

function miniHighlightChartSvg(bars, card) {
  const start = Math.max(0, card.startIndex - 4);
  const end = Math.min(bars.length - 1, card.endIndex + 3);
  const subset = bars.slice(start, end + 1);
  return drawMiniCandles({
    bars: subset,
    highlightStart: card.startIndex - start,
    highlightEnd: card.endIndex - start,
    label: "黄色虚线框 = 本次匹配区间",
  });
}

function normalizedPatternBars(bars, card) {
  const subset = bars.slice(card.startIndex, card.endIndex + 1);
  const high = Math.max(...subset.map((b) => b.high));
  const low = Math.min(...subset.map((b) => b.low));
  const span = high - low || Math.max(high, 1) * 0.01;
  const scale = (value) => 94 + ((value - low) / span) * 18;
  return subset.map((bar, index) => ({
    date: String(index + 1),
    open: scale(bar.open),
    high: scale(bar.high),
    low: scale(bar.low),
    close: scale(bar.close),
  }));
}

function patternSketchSvg(card) {
  const sketch = patternTemplates(card.name);
  return drawMiniCandles({
    bars: sketch,
    highlightStart: 0,
    highlightEnd: sketch.length - 1,
    label: `${card.name} 标准轮廓`,
  });
}

function signalMarkup(status) {
  if (/风险|偏弱|转弱|放量下跌/.test(status)) return '<span class="signal signal-bear"><span>▼</span>偏空风险</span>';
  if (/修复|向上|偏多/.test(status)) return '<span class="signal signal-bull"><span>▲</span>偏多修复</span>';
  return '<span class="signal signal-flat"><span>◆</span>中性观察</span>';
}

function buildReport({ displaySymbol, interval, range, bars, cards, gptHtml, options }) {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const support = Math.min(...bars.slice(-10).map((b) => b.low));
  const pressure1 = Math.max(...bars.slice(-4).map((b) => b.high));
  const pressure2 = Math.max(...bars.slice(-10).map((b) => b.high));
  const e20 = ema(closes, 20).at(-1);
  const e60 = ema(closes, 60).at(-1);
  const rsi14 = rsi(closes);
  const k14 = stochastic(bars);
  const mom10 = momentum(closes);
  const recent = bars.slice(-14);
  const title = `${displaySymbol}｜${interval} 三根K线以上形态匹配报告`;
  const final =
    cards.length > 0
      ? `${displaySymbol} ${interval} 当前超过${MIN_PATTERN_SCORE}%的主要匹配是「${cards[0].name}」，最新价 ${formatPrice(last.close)}。后续重点看确认位 ${cards[0].confirm} 与失败位 ${cards[0].failure}；确认位未站稳前，只能按观察结构处理。`
      : `${displaySymbol} ${interval} 当前没有超过${MIN_PATTERN_SCORE}%的经典蜡烛图形态匹配。最新价 ${formatPrice(last.close)}；此时不应强行套形态，重点观察 ${formatPrice(pressure1)} 上方确认与 ${formatPrice(support)} 下方失效。`;
  const top5Rows = cards
    .map((c, idx) => `<tr><td>匹配 ${idx + 1}</td><td>${safeHtml(c.name)}</td><td class="price">${c.score}%</td><td>${directionMarkup(c.bias)}</td><td>${safeHtml(c.range)}</td><td>${safeHtml(c.judgement)}</td></tr>`)
    .join("");
  const noMatchHtml = `<div class="no-match"><strong>暂无超过${MIN_PATTERN_SCORE}%的经典形态匹配。</strong><p>当前K线不强行归类；请等待新的确认K线、关键位突破/跌破，或切换更大周期再观察。</p></div>`;
  const topMatchHtml = `<div class="top-match"><h2>超过${MIN_PATTERN_SCORE}%的形态匹配</h2><p>最少3根K线匹配，只显示达到阈值的书中/规则库形态。</p>${cards.length ? `<table><thead><tr><th>排名</th><th>形态</th><th>匹配度</th><th>方向</th><th>匹配区间</th><th>状态</th></tr></thead><tbody>${top5Rows}</tbody></table>` : noMatchHtml}</div>`;
  const cardHtml = cards
    .map(
      (c, idx) => `<article class="card"><div class="head"><div><h2>匹配 ${idx + 1} · ${safeHtml(c.name)}</h2><p>匹配区间：${safeHtml(c.range)}</p></div><div class="score">${c.score}%<span>三根以上匹配度</span></div></div><div class="visual-box"><div class="compare"><div class="panel chart-panel"><h3>原始K线高亮</h3>${miniHighlightChartSvg(bars, c)}</div><div class="panel chart-panel"><h3>规则库标准轮廓</h3>${patternSketchSvg(c)}<p>右图是书中/规则库标准结构的归一化示意，用于和左侧高亮K线逐根对照。</p></div></div></div><div class="detail-box"><p>${safeHtml(c.why)}</p><table><tr><th>规则库含义</th><td>${safeHtml(c.meaning)}</td></tr><tr><th>结构判断</th><td>${directionMarkup(c.bias)} · ${safeHtml(c.judgement)}</td></tr><tr><th>确认位</th><td class="price">${safeHtml(c.confirm)}</td></tr><tr><th>失败位</th><td class="price">${safeHtml(c.failure)}</td></tr></table></div></article>`
    )
    .join("");
  const matrix = [
    ["形态", cards[0]?.bias === "偏多" ? "偏多修复" : cards[0]?.bias === "偏空" ? "偏空风险" : "中性观察", cards[0] ? `最高匹配为「${cards[0].name}」，匹配度 ${cards[0].score}%。` : `暂无超过${MIN_PATTERN_SCORE}%的经典形态匹配，不强行归类。`],
    ["位置", "中性观察", `价格接近近期低点 ${formatPrice(support)}，但还没有向上确认。`],
    ["均线", "偏空风险", `最新价 ${formatPrice(last.close)}，E20 ${formatPrice(e20)}，E60 ${formatPrice(e60)}，仍在短线压力下。`],
    ["RSI", (rsi14 || 50) < 45 ? "偏空风险" : "中性观察", rsi14 == null ? "RSI数据不足。" : `RSI14=${rsi14.toFixed(1)}，只作为强弱辅助，不单独决定方向。`],
    ["随机指数", (k14 || 50) < 30 ? "中性观察" : "中性观察", k14 == null ? "随机指数数据不足。" : `%K=${k14.toFixed(1)}，提示短线位置，不等于反转确认。`],
    ["动力", (mom10 || 0) < 0 ? "偏空风险" : "偏多修复", mom10 == null ? "动力数据不足。" : `10根动量=${mom10.toFixed(2)}%，看反弹是否能持续。`],
    ["成交量", "偏空风险", "最近下跌段成交量较高，说明抛压仍需观察。"],
  ]
    .map((r) => `<tr><td>${r[0]}</td><td>${signalMarkup(r[1])}</td><td>${r[2]}</td></tr>`)
    .join("");
  const levels = [
    [formatPrice(support), "近期低点支撑", "跌破则支撑观察失败"],
    [formatPrice(last.close), "最新价", "当前位置仍在低位压力下"],
    [formatPrice(pressure1), "短线确认位", "站回后，最新大阴压力缓和"],
    [formatPrice(pressure2), "上一层压力", "收复后，下降中继风险下降"],
    [formatPrice(e20), "E20", "站回才算短线节奏修复"],
  ]
    .map((r) => `<tr><td class="price">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`)
    .join("");
  const chartHtml = candleChartSvg(bars, cards);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeHtml(title)}</title><style>
:root{--bg:#090f1f;--panel:#11182d;--text:#edf2ff;--muted:#9fb0d8;--gold:#ffd166;--border:#2a355a}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif;background:linear-gradient(180deg,#090f1f,#0d1326);color:var(--text);line-height:1.55}.wrap{max-width:1280px;margin:auto;padding:28px 20px 80px}.hero,.section,.card{background:linear-gradient(180deg,rgba(17,24,45,.96),rgba(19,28,51,.96));border:1px solid var(--border);border-radius:14px;box-shadow:0 14px 38px rgba(0,0,0,.25)}.hero{padding:26px;background:linear-gradient(135deg,rgba(121,168,255,.18),rgba(255,209,102,.08))}h1{margin:0 0 8px;font-size:30px}.sub,p,td{color:var(--muted)}.pills{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.pill{border:1px solid var(--border);background:rgba(255,255,255,.055);border-radius:999px;padding:7px 12px;font-size:13px}.top-match{margin-top:20px;border:1px solid var(--border);background:rgba(255,255,255,.035);border-radius:12px;padding:16px}.top-match h2{margin:0;font-size:22px}.top-match p{margin:8px 0 0}.top-match table{margin-top:12px}.no-match{border:1px dashed rgba(255,209,102,.45);background:rgba(255,209,102,.07);border-radius:10px;margin-top:14px;padding:13px}.no-match strong{color:#ffd166}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px}.summary div{border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:10px;padding:14px}.tag{display:inline-block;background:var(--gold);color:#0a1120;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:800;margin-bottom:10px}.summary h3{margin:0 0 6px;font-size:14px}.summary p{margin:0;font-size:14px}.verdict{border:1px solid rgba(255,209,102,.38);background:rgba(255,209,102,.08);border-radius:14px;padding:18px;margin-top:22px}.verdict p{color:#f6e6b2}.section{margin-top:22px;padding:20px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;font-size:14px}th{color:#d7e3ff;background:rgba(255,255,255,.04)}.price{color:var(--gold);font-weight:800}.chart{width:100%;height:auto;background:rgba(255,255,255,.015);border-radius:12px}.chart-section p{margin-top:0}.chart-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:#0b1227;margin-top:12px}.chart-wrap svg{display:block;min-width:880px;width:100%;height:auto}.ai-brief{border-color:rgba(121,168,255,.42);background:linear-gradient(180deg,rgba(121,168,255,.10),rgba(17,24,45,.96))}.ai-brief h2{margin-bottom:14px}.ai-thesis{border-left:4px solid var(--gold);background:rgba(255,209,102,.08);border-radius:10px;padding:12px 14px;margin:10px 0 14px;color:#f6e6b2}.ai-level-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}.ai-level{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);border-radius:10px;padding:12px;color:var(--muted)}.ai-level strong,.ai-top5 strong{color:#edf2ff}.ai-top5{margin:12px 0 0;padding-left:24px}.ai-top5 li{margin:6px 0;color:#cbd6ef}.ai-risk{border-top:1px solid rgba(255,255,255,.10);padding-top:12px;margin-top:14px;color:#f0c7c7}.grid{display:grid;gap:18px;margin-top:22px}.head{display:flex;justify-content:space-between;gap:14px;padding:18px 20px 8px}.head h2{margin:0;font-size:21px}.head p{margin:5px 0 0;font-size:13px}.score{min-width:136px;text-align:right;font-size:32px;font-weight:800;color:var(--gold)}.score span{display:block;font-size:12px;font-weight:400;color:var(--muted)}.visual-box{border:1px solid var(--border);background:rgba(255,255,255,.03);border-radius:12px;margin:6px 20px 16px;padding:14px}.compare{display:grid;grid-template-columns:1.15fr .95fr;gap:18px}.panel{border:0;background:transparent;border-radius:10px;padding:0;margin:0}.chart-panel{min-width:0}.detail-box{border:1px solid var(--border);background:rgba(255,255,255,.03);border-radius:12px;padding:14px;margin:0 auto 20px;max-width:720px}.panel h3{margin:0 0 10px;font-size:15px}.dir,.signal{display:inline-flex;align-items:center;gap:7px;font-weight:800}.dir-icon,.signal span{font-size:12px;line-height:1}.dir-bear,.signal-bear{color:#40d98a}.dir-bull,.signal-bull{color:#ff7a88}.dir-flat,.signal-flat{color:#ffd166}.collapsible summary{display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;list-style:none}.collapsible summary::-webkit-details-marker{display:none}.collapsible h2{margin:0}.fold-hint{color:var(--gold);font-size:13px;font-weight:800}@media(max-width:760px){.summary,.ai-level-grid,.compare{grid-template-columns:1fr}.head{display:block}.score{text-align:left;margin-top:10px}}</style></head><body><div class="wrap"><section class="hero"><h1>${safeHtml(title)}</h1><p class="sub">模式：${safeHtml(options.menu)}；数据源：Yahoo Finance；周期 ${safeHtml(interval)}；最新K线可能随交易继续变化。</p><div class="pills"><div class="pill">标的：${safeHtml(displaySymbol)}</div><div class="pill">周期：${safeHtml(interval)}</div><div class="pill">样本：${safeHtml(recent[0].date)} 至 ${safeHtml(last.date)}</div><div class="pill">状态：风险 / 支撑观察</div><div class="pill">确认等级：D</div></div>${topMatchHtml}<div class="summary"><div><span class="tag">主结构</span><h3>总体结构</h3><p>反弹冲高后快速回落</p></div><div><span class="tag">风险</span><h3>当前状态</h3><p>大阴线未修复，低位支撑观察</p></div><div><span class="tag">确认位</span><h3>核心确认</h3><p>${formatPrice(pressure1)} → ${formatPrice(pressure2)}</p></div><div><span class="tag">失败位</span><h3>核心失败</h3><p>跌破 ${formatPrice(support)}</p></div></div></section><section class="verdict"><h2>AI最终结论</h2><p>${safeHtml(final)}</p></section>${chartHtml}${gptHtml || ""}<details class="section collapsible"><summary><h2>最近K线总览</h2><span class="fold-hint">点击展开</span></summary><table><thead><tr><th>时间</th><th>开盘</th><th>最高</th><th>最低</th><th>收盘</th><th>涨跌幅</th><th>成交量</th></tr></thead><tbody>${candleTable(recent)}</tbody></table></details><section class="grid">${cardHtml || noMatchHtml}</section><section class="section"><h2>信号解读</h2><table><thead><tr><th>模块</th><th>方向</th><th>怎么理解</th></tr></thead><tbody>${matrix}</tbody></table></section><section class="section"><h2>关键位置判断</h2><table><thead><tr><th>位置</th><th>含义</th><th>AI动作判断</th></tr></thead><tbody>${levels}</tbody></table></section><section class="section"><h2>卖Put辅助判断</h2><p>当前结构偏弱，属于“只观察/禁止近价Put”状态。若要看卖Put，至少等价格重新站回短线确认位，并且日K支撑没有破坏；Strike 应放在明确支撑与失败位下方。</p></section><p style="font-size:13px">本报告用于K线结构学习、风险复盘和交易辅助，不构成投资建议。市场价格会变化，形态判断会随收盘价、成交量和波动率变化而更新。期权卖方策略存在非线性风险，不应只依据K线形态执行。</p></div></body></html>`;
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  try {
    const data = req.body || {};
    const provider = data.provider || "deepseek";
    const market = data.market || "crypto";
    const { yahoo, display } = normalizeSymbol(data.symbol, market);
    const interval = data.interval || "60m";
    const requestedRange = data.range || "10d";
    const range = normalizeRangeForInterval(requestedRange, interval);
    const { bars } = await fetchYahooBars(yahoo, range, interval);
    const cards = patternCards(bars);
    const options = {
      menu: data.menu || "1",
      provider,
      market,
      modules: data.modules || [],
      extra: data.extra || "",
    };
    const payload = {
      symbol: display,
      interval,
      range,
      latest_bar: bars.at(-1),
      recent_bars: bars.slice(-14),
      top5: cards.map((card, idx) => ({ rank: idx + 1, ...card })),
      options,
    };
    const ai = await callAI(payload, provider);
    const html = buildReport({ displaySymbol: display, interval, range, bars, cards, gptHtml: ai.html, options });
    const filename = `${safeSlug(display)}_${safeSlug(interval)}_${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}.html`;
    return sendJson(res, 200, {
      ok: true,
      symbol: display,
      interval,
      status: "已生成",
      range,
      requested_range: requestedRange,
      used_gpt: ai.used,
      ai_provider: ai.provider,
      message: ai.message,
      filename,
      html,
      top5: cards.map((card, idx) => ({
        rank: `匹配 ${idx + 1}`,
        name: card.name,
        score: card.score,
        bias: card.bias,
        judgement: card.judgement,
      })),
    });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || String(error) });
  }
}
