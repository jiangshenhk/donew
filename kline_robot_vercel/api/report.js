const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const MIN_PATTERN_SCORE = 60;
const PATTERN_CATALOG = [
  { name: "锤子线", english: "Hammer", family: "反转形态", bars: "1", bias: "偏多", status: "implemented", aliases: ["锤子线扩展"] },
  { name: "倒锤子线", english: "Inverted Hammer", family: "反转形态", bars: "1", bias: "偏多", status: "implemented", aliases: ["倒锤子线扩展"] },
  { name: "上吊线", english: "Hanging Man", family: "反转形态", bars: "1", bias: "偏空", status: "implemented", aliases: ["上吊线扩展"] },
  { name: "流星线", english: "Shooting Star", family: "反转形态", bars: "1", bias: "偏空", status: "implemented", aliases: ["流星线扩展"] },
  { name: "普通十字线", english: "Doji", family: "十字线家族", bars: "1", bias: "中性", status: "implemented", aliases: ["十字线", "十字线扩展", "普通十字线扩展"] },
  { name: "长腿十字", english: "Long-legged Doji", family: "十字线家族", bars: "1", bias: "中性", status: "implemented", aliases: ["长腿十字线", "长腿十字扩展", "长腿十字线扩展"] },
  { name: "墓碑十字", english: "Gravestone Doji", family: "十字线家族", bars: "1", bias: "偏空", status: "implemented", aliases: ["墓碑十字扩展"] },
  { name: "蜻蜓十字", english: "Dragonfly Doji", family: "十字线家族", bars: "1", bias: "偏多", status: "implemented", aliases: ["蜻蜓十字扩展"] },
  { name: "看涨捉腰带线", english: "Bullish Belt Hold", family: "反转形态", bars: "1", bias: "偏多", status: "implemented", aliases: ["捉腰带线", "看涨捉腰带线扩展"] },
  { name: "看跌捉腰带线", english: "Bearish Belt Hold", family: "反转形态", bars: "1", bias: "偏空", status: "implemented", aliases: ["看跌捉腰带线扩展"] },
  { name: "看涨吞没", english: "Bullish Engulfing", family: "反转形态", bars: "2", bias: "偏多", status: "implemented", aliases: ["吞没形态", "吞没形态扩展", "看涨吞没扩展"] },
  { name: "看跌吞没", english: "Bearish Engulfing", family: "反转形态", bars: "2", bias: "偏空", status: "implemented", aliases: ["看跌吞没扩展"] },
  { name: "乌云盖顶", english: "Dark Cloud Cover", family: "反转形态", bars: "2", bias: "偏空", status: "implemented", aliases: ["乌云盖顶扩展"] },
  { name: "刺透形态", english: "Piercing Pattern", family: "反转形态", bars: "2", bias: "偏多", status: "implemented", aliases: ["刺透形态扩展"] },
  { name: "看涨孕线", english: "Bullish Harami", family: "反转形态", bars: "2", bias: "偏多", status: "implemented", aliases: ["孕线", "孕线扩展", "看涨孕线扩展"] },
  { name: "看跌孕线", english: "Bearish Harami", family: "反转形态", bars: "2", bias: "偏空", status: "implemented", aliases: ["看跌孕线扩展"] },
  { name: "十字孕线", english: "Harami Cross", family: "反转形态", bars: "2", bias: "中性", status: "implemented", aliases: ["十字孕线扩展"] },
  { name: "平头底部", english: "Tweezer Bottom", family: "反转形态", bars: "2", bias: "中性", status: "implemented", aliases: ["平头底部扩展"] },
  { name: "平头顶部", english: "Tweezer Top", family: "反转形态", bars: "2", bias: "偏空", status: "implemented", aliases: ["平头顶部扩展"] },
  { name: "看涨反击线", english: "Bullish Counterattack", family: "反转形态", bars: "2", bias: "偏多", status: "implemented", aliases: ["反击线"] },
  { name: "看跌反击线", english: "Bearish Counterattack", family: "反转形态", bars: "2", bias: "偏空", status: "implemented", aliases: [] },
  { name: "启明星", english: "Morning Star", family: "反转形态", bars: "3", bias: "偏多", status: "implemented", aliases: [] },
  { name: "十字启明星", english: "Morning Doji Star", family: "反转形态", bars: "3", bias: "偏多", status: "implemented", aliases: [] },
  { name: "黄昏星", english: "Evening Star", family: "反转形态", bars: "3", bias: "偏空", status: "implemented", aliases: [] },
  { name: "十字黄昏星", english: "Evening Doji Star", family: "反转形态", bars: "3", bias: "偏空", status: "implemented", aliases: [] },
  { name: "向上窗口", english: "Rising Window", family: "持续形态", bars: "2-3", bias: "偏多", status: "implemented", aliases: ["窗口", "缺口"] },
  { name: "向下窗口", english: "Falling Window", family: "持续形态", bars: "2-3", bias: "偏空", status: "implemented", aliases: [] },
  { name: "高价位跳空突破", english: "High-price Gapping Play", family: "持续形态", bars: "3", bias: "偏多", status: "implemented", aliases: [] },
  { name: "低价位跳空破位", english: "Low-price Gapping Play", family: "持续形态", bars: "3", bias: "偏空", status: "implemented", aliases: [] },
  { name: "上升三法", english: "Rising Three Methods", family: "持续形态", bars: "5", bias: "偏多", status: "implemented", aliases: [] },
  { name: "下降三法", english: "Falling Three Methods", family: "持续形态", bars: "5", bias: "偏空", status: "implemented", aliases: [] },
  { name: "铺垫形态", english: "Mat Hold", family: "持续形态", bars: "5", bias: "偏多", status: "implemented", aliases: [] },
  { name: "三白兵", english: "Three White Soldiers", family: "趋势衰竭与受阻", bars: "3", bias: "偏多", status: "implemented", aliases: ["前进白色三兵"] },
  { name: "三只乌鸦", english: "Three Black Crows", family: "趋势衰竭与受阻", bars: "3", bias: "偏空", status: "implemented", aliases: [] },
  { name: "前进受阻", english: "Advance Block", family: "趋势衰竭与受阻", bars: "3", bias: "偏空", status: "implemented", aliases: [] },
  { name: "停顿形态", english: "Stalled Pattern", family: "趋势衰竭与受阻", bars: "3", bias: "偏空", status: "implemented", aliases: [] },
  { name: "塔形顶部", english: "Tower Top", family: "反转形态", bars: "5", bias: "偏空", status: "implemented", aliases: [] },
  { name: "塔形底部", english: "Tower Bottom", family: "反转形态", bars: "5", bias: "偏多", status: "implemented", aliases: [] },
  { name: "圆形顶部", english: "Dumpling Top", family: "反转形态", bars: "5", bias: "偏空", status: "implemented", aliases: [] },
  { name: "圆形底部", english: "Frypan Bottom", family: "反转形态", bars: "5", bias: "偏多", status: "implemented", aliases: [] },
  { name: "大阴线未修复", english: "Unrepaired Long Bear Candle", family: "自定义风控", bars: "1-8", bias: "偏空", status: "implemented", aliases: [] },
  { name: "三山形态", english: "Three Mountains", family: "反转形态", bars: "5-8", bias: "偏空", status: "planned", aliases: ["三尊顶部"] },
  { name: "三川形态", english: "Three Rivers", family: "反转形态", bars: "5-8", bias: "偏多", status: "planned", aliases: ["倒三尊底部", "独特三川底部"] },
  { name: "向上跳空并列白色蜡烛线", english: "Upside Gap Side-by-side White Lines", family: "持续形态", bars: "3", bias: "偏多", status: "planned", aliases: ["跳空并列白色蜡烛线"] },
  { name: "向下跳空并列阴阳蜡烛线", english: "Downside Gap Side-by-side Lines", family: "持续形态", bars: "3", bias: "偏空", status: "planned", aliases: [] },
  { name: "向上跳空两只乌鸦", english: "Upside Gap Two Crows", family: "反转形态", bars: "3", bias: "偏空", status: "planned", aliases: ["两只乌鸦"] },
  { name: "分手蜡烛线", english: "Separating Lines", family: "持续形态", bars: "2", bias: "中性", status: "planned", aliases: [] },
  { name: "高位长上影", english: "High-position Long Upper Shadow", family: "趋势衰竭与受阻", bars: "1-3", bias: "偏空", status: "approximated", aliases: ["高位放量长上影"] },
  { name: "低位长下影", english: "Low-position Long Lower Shadow", family: "趋势衰竭与受阻", bars: "1-3", bias: "偏多", status: "approximated", aliases: ["低位放量长下影"] },
  { name: "大阳线后十字", english: "Doji After Long White Candle", family: "十字线家族", bars: "2", bias: "偏空", status: "approximated", aliases: ["高位十字风险结构"] },
  { name: "大阴线后十字", english: "Doji After Long Black Candle", family: "十字线家族", bars: "2", bias: "偏多", status: "approximated", aliases: ["低位十字观察结构", "支撑水平十字结构", "阻挡水平十字结构"] },
];
const CANDLE_PATTERN_LIBRARY = PATTERN_CATALOG.map((pattern) => pattern.name);

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

const SYMBOL_NAME_MAP = {
  "^IXIC": "纳斯达克综合指数",
  "^GSPC": "标普500指数",
  "^DJI": "道琼斯工业平均指数",
  "^NDX": "纳斯达克100指数",
  "^HSI": "恒生指数",
  "^HSTECH": "恒生科技指数",
  "^RUT": "罗素2000指数",
  "^SOX": "费城半导体指数",
  "^VIX": "VIX恐慌指数",
  "DX-Y.NYB": "美元指数",
  "GC=F": "黄金期货",
  "CL=F": "原油期货",
  "BTC-USD": "比特币",
};

function normalizeSymbol(rawSymbol, market) {
  const raw = String(rawSymbol || "^IXIC").trim().toUpperCase();
  const compact = raw.replace(/\s+/g, "");
  const selectedMarket = String(market || "").toLowerCase();
  if (["BTC", "BTCUSD", "BTC/USD", "BTC-USD", "BITCOIN"].includes(compact) || raw.includes("比特币")) {
    if (compact.includes("-USD")) return { yahoo: compact, display: compact.replace("-USD", "") };
    return { yahoo: "BTC-USD", display: "BTC" };
  }
  if (selectedMarket === "crypto") {
    if (!compact) throw new Error("找不到代码：虚拟货币请输入 BTC、BTC-USD 等 Yahoo Finance 代码。");
    if (/^[A-Z0-9]+-USD$/.test(compact)) return { yahoo: compact, display: compact.replace("-USD", "") };
    return { yahoo: `${compact}-USD`, display: compact };
  }
  if (selectedMarket === "hk") {
    if (compact === "^HSI" || compact === "^HSTECH") return { yahoo: compact, display: compact };
    const digits = compact.replace(/\D/g, "");
    if (!digits) throw new Error(`找不到代码：${rawSymbol || ""}，港股请输入数字代码，例如 0700 或 9988。`);
    const code = digits.length === 5 && digits.startsWith("0") ? digits.slice(1) : digits.padStart(4, "0");
    if (!/^\d{4}$/.test(code)) throw new Error(`找不到代码：${rawSymbol || ""}，港股可输入 0700、00700、9988。`);
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
  if (selectedMarket === "global") {
    if (!compact) throw new Error("找不到代码：全球指数/宏观请输入 Yahoo Finance 代码，例如 DX-Y.NYB、GC=F、CL=F。");
    return { yahoo: compact, display: compact };
  }
  return { yahoo: compact, display: compact };
}

function marketOrderFor(rawSymbol, selectedMarket) {
  const requested = String(selectedMarket || "").trim().toLowerCase();
  if (requested) return [requested];
  const compact = String(rawSymbol || "").trim().toUpperCase().replace(/\s+/g, "");
  if (compact === "^HSI" || compact === "^HSTECH") return ["hk", "us", "cn", "crypto"];
  if (
    /\.NYB$/.test(compact)
    || /=F$/.test(compact)
    || /=X$/.test(compact)
    || /\.(CBT|CMX|NYM|CME|ICE)$/.test(compact)
  ) return ["global", "us", "hk", "cn", "crypto"];
  if (compact.startsWith("^")) return ["us", "hk", "cn", "crypto"];
  if (/^(SH|SZ)?\d{6}(\.(SS|SZ|SH))?$/.test(compact)) return ["cn", "us", "hk", "crypto"];
  if (/^0?\d{4}$/.test(compact) || /^0\d{4}$/.test(compact)) return ["hk", "us", "cn", "crypto"];
  return ["us", "hk", "cn", "crypto"];
}

function normalizeRangeForInterval(range, interval) {
  const normalizedInterval = String(interval || "1d").toLowerCase();
  const normalizedRange = String(range || (normalizedInterval === "1d" ? "1mo" : "5d"));
  if (normalizedInterval === "1d" && ["5d", "10d"].includes(normalizedRange)) return "1mo";
  return normalizedRange;
}

function marketTimeLabel(market, timezone) {
  if (/New_York/i.test(String(timezone || "")) || market === "us") return "美国市场时间";
  if (/Hong_Kong/i.test(String(timezone || "")) || market === "hk") return "香港市场时间";
  if (/Shanghai/i.test(String(timezone || "")) || market === "cn") return "中国市场时间";
  if (market === "crypto") return "UTC时间";
  if (market === "global") return "全球市场时间";
  return timezone ? `${timezone} 时间` : "市场时间";
}

function displayNameFor(symbol, display, meta) {
  const key = String(symbol || "").toUpperCase();
  return SYMBOL_NAME_MAP[key] || meta?.shortName || meta?.longName || display;
}

function dailyLookbackDays(range) {
  const value = String(range || "1mo").toLowerCase();
  if (value.endsWith("y")) return Math.max(370, Number.parseInt(value, 10) * 370 || 370);
  if (value.endsWith("mo")) return Math.max(45, Number.parseInt(value, 10) * 35 || 45);
  if (value.endsWith("d")) return Math.max(35, Number.parseInt(value, 10) * 3 || 35);
  return 60;
}

function ymdCompact(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function eastmoneyStaticSecid(symbol, market) {
  const upper = String(symbol || "").toUpperCase();
  const selectedMarket = String(market || "").toLowerCase();
  const indexMap = {
    "^IXIC": "100.NDX",
    "^GSPC": "100.SPX",
    "^DJI": "100.DJI",
    "^NDX": "100.NDX",
    "DX-Y.NYB": "100.UDI",
    "EURUSD=X": "119.EURUSD",
  };
  if (indexMap[upper]) return indexMap[upper];
  const cn = upper.match(/^(\d{6})\.(SS|SZ)$/) || upper.match(/^(\d{6})$/);
  if (selectedMarket === "cn" && cn) {
    const code = cn[1];
    return `${code.startsWith("6") || code.startsWith("9") ? "1" : "0"}.${code}`;
  }
  const hk = upper.match(/^(\d{4,5})\.HK$/) || upper.match(/^0?(\d{4})$/);
  if (selectedMarket === "hk" && hk) return `116.${hk[1].padStart(5, "0")}`;
  return "";
}

async function eastmoneyLookupSecid(symbol, market) {
  const staticSecid = eastmoneyStaticSecid(symbol, market);
  if (staticSecid) return staticSecid;
  if (String(market || "").toLowerCase() !== "us") return "";
  const code = String(symbol || "").toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]*$/.test(code)) return "";
  const candidates = ["105", "106", "107", "102"];
  for (const marketId of candidates) {
    try {
      const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${marketId}.${encodeURIComponent(code)}&fields=f57,f58,f107,f152`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" } });
      if (!res.ok) continue;
      const payload = await res.json();
      const data = payload?.data;
      if (data?.f57 && Number.isFinite(Number(data.f107))) return `${data.f107}.${data.f57}`;
    } catch {
      // Try the next Eastmoney market id.
    }
  }
  return "";
}

function eastmoneyTimezone(market) {
  const value = String(market || "").toLowerCase();
  if (value === "cn") return "Asia/Shanghai";
  if (value === "hk") return "Asia/Hong_Kong";
  if (value === "global") return "America/New_York";
  return "America/New_York";
}

async function fetchEastmoneyDailyBars(symbol, range, interval, market) {
  if (String(interval || "").toLowerCase() !== "1d") throw new Error("东财备用行情源只支持日线。");
  const secid = await eastmoneyLookupSecid(symbol, market);
  if (!secid) throw new Error(`东财备用行情源暂不支持：${symbol}`);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - dailyLookbackDays(range));
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&beg=${ymdCompact(start)}&end=${ymdCompact(end)}&_=${Date.now()}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" } });
  if (!res.ok) throw new Error(`东财备用行情源无法取得：${symbol}`);
  const payload = await res.json();
  const data = payload?.data;
  const timezone = eastmoneyTimezone(market);
  const bars = (data?.klines || [])
    .map((line) => String(line).split(","))
    .filter((parts) => parts.length >= 6)
    .map(([date, open, close, high, low, volume]) => {
      const closeTime = timezone === "America/New_York" ? `${date}T16:00:00-04:00` : `${date}T15:00:00+08:00`;
      const ts = Math.floor(new Date(closeTime).getTime() / 1000);
      return {
        ts,
        date: toBarTime(ts, timezone),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume || 0),
      };
    })
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((v) => Number.isFinite(v)))
    .sort((a, b) => a.ts - b.ts);
  if (bars.length < 20) throw new Error("东财备用行情源可用K线数量不足。");
  return {
    meta: {
      symbol,
      shortName: data?.name || displayNameFor(symbol, symbol, {}),
      longName: data?.name || displayNameFor(symbol, symbol, {}),
      exchangeTimezoneName: timezone,
    },
    bars,
  };
}

async function fetchTencentDisplayName(symbol, market) {
  const selectedMarket = String(market || "").toLowerCase();
  let query = "";
  const upper = String(symbol || "").toUpperCase();
  if (selectedMarket === "cn") {
    const matched = upper.match(/^(\d{6})\.(SS|SZ)$/);
    if (!matched) return "";
    query = `${matched[2] === "SS" ? "sh" : "sz"}${matched[1]}`;
  } else if (selectedMarket === "hk") {
    const matched = upper.match(/^(\d{4})\.HK$/);
    if (!matched) return "";
    query = `hk0${matched[1]}`;
  } else {
    return "";
  }
  try {
    const res = await fetch(`https://qt.gtimg.cn/q=${query}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return "";
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder("gb18030").decode(buffer);
    const body = text.split('"')[1] || "";
    const fields = body.split("~");
    const name = fields[1] || "";
    return /[\u4e00-\u9fff]/.test(name) ? name : "";
  } catch {
    return "";
  }
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

async function fetchYahooBars(symbol, range, interval, market = "") {
  const url = `${YAHOO_BASE}${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includePrePost=false`;
  try {
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
  } catch (error) {
    if (String(interval || "").toLowerCase() === "1d") return fetchEastmoneyDailyBars(symbol, range, interval, market);
    throw error;
  }
}

async function resolveMarketBars(rawSymbol, selectedMarket, range, interval) {
  const marketOrder = marketOrderFor(rawSymbol, selectedMarket);
  const errors = [];
  const attempts = [];
  for (const market of marketOrder) {
    try {
      const symbol = normalizeSymbol(rawSymbol, market);
      attempts.push(symbol.yahoo);
      const data = await fetchYahooBars(symbol.yahoo, range, interval, market);
      const timezone = data.meta?.exchangeTimezoneName || "UTC";
      const chineseName = await fetchTencentDisplayName(symbol.yahoo, market);
      return {
        ...symbol,
        displayName: chineseName || displayNameFor(symbol.yahoo, symbol.display, data.meta),
        market,
        timezone,
        timeLabel: marketTimeLabel(market, timezone),
        bars: data.bars,
        meta: data.meta,
      };
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }
  const attemptedText = attempts.length ? `已尝试：${[...new Set(attempts)].join("、")}。` : "";
  throw new Error(`找不到代码：${rawSymbol || ""}。${attemptedText}请检查市场和代码，或手动指定市场。${errors.length ? ` (${errors.at(-1)})` : ""}`);
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

function volumeStateFromRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return "量能不足";
  if (ratio >= 1.2) return "明显放量";
  if (ratio >= 1.05) return "温和放量";
  if (ratio <= 0.8) return "明显缩量";
  if (ratio <= 0.95) return "温和缩量";
  return "量能平稳";
}

function statusFromPriceVsAverage(price, avg, tolerance = 0.0035) {
  if (!Number.isFinite(price) || !Number.isFinite(avg)) return "中性观察";
  if (price >= avg * (1 + tolerance)) return "偏多修复";
  if (price <= avg * (1 - tolerance)) return "偏空风险";
  return "中性观察";
}

function clampScore(value) {
  return Math.max(45, Math.min(96, Math.round(value)));
}

function makeCard(bars, data) {
  const startIndex = Math.max(0, data.startIndex);
  const endIndex = Math.min(bars.length - 1, data.endIndex);
  const matchBars = endIndex - startIndex + 1;
  const ruleScore = clampScore(data.score);
  const catalog = patternCatalogEntry(data.name);
  const shapeScore = shapeSimilarityScore(bars.slice(startIndex, endIndex + 1), patternTemplates(data.name));
  return {
    ...data,
    canonicalName: catalog?.name || data.name,
    english: catalog?.english || "",
    family: catalog?.family || "未分类",
    implementationStatus: catalog?.status || "unlisted",
    startIndex,
    endIndex,
    matchBars,
    ruleScore,
    shapeScore,
    score: Math.min(ruleScore, shapeScore),
    range: `${bars[startIndex].date} 至 ${bars[endIndex].date}`,
    confirm: formatPrice(data.confirm),
    failure: formatPrice(data.failure),
  };
}

const PATTERN_TEMPLATE_LIBRARY = {
    "锤子线": [
      [99, 101, 88, 100],
    ],
    "倒锤子线": [
      [98, 111, 97, 99],
    ],
    "上吊线": [
      [107, 109, 95, 106],
    ],
    "流星线": [
      [108, 118, 106, 107],
    ],
    "普通十字线": [
      [105, 110, 100, 105.2],
    ],
    "长腿十字": [
      [104, 116, 92, 104.2],
    ],
    "墓碑十字": [
      [107, 118, 106, 107.2],
    ],
    "蜻蜓十字": [
      [98, 99, 88, 98.2],
    ],
    "看涨捉腰带线": [
      [96, 112, 95, 111],
    ],
    "看跌捉腰带线": [
      [108, 109, 94, 95],
    ],
    "看涨吞没": [
      [105, 107, 96, 98],
      [97, 111, 95, 110],
    ],
    "看跌吞没": [
      [96, 107, 95, 105],
      [106, 108, 94, 95],
    ],
    "乌云盖顶": [
      [95, 111, 94, 110],
      [112, 114, 100, 101],
    ],
    "刺透形态": [
      [110, 111, 94, 96],
      [94, 106, 93, 105],
    ],
    "看涨孕线": [
      [110, 112, 94, 96],
      [98, 103, 97, 101],
    ],
    "看跌孕线": [
      [96, 112, 95, 110],
      [104, 107, 102, 103],
    ],
    "十字孕线": [
      [96, 112, 95, 110],
      [104, 107, 102, 104.2],
    ],
    "平头底部": [
      [108, 110, 96, 99],
      [100, 104, 96, 102],
    ],
    "平头顶部": [
      [96, 110, 95, 108],
      [107, 110, 101, 102],
    ],
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
    "长腿十字扩展": [
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

function canonicalPatternName(name) {
  const raw = String(name || "").trim();
  const direct = PATTERN_CATALOG.find((pattern) => pattern.name === raw || (pattern.aliases || []).includes(raw));
  if (direct) return direct.name;
  const normalized = raw.replace(/扩展$/u, "").replace(/线$/u, "");
  const partial = PATTERN_CATALOG.find((pattern) => {
    const names = [pattern.name, ...(pattern.aliases || [])];
    return names.some((item) => {
      const itemNormalized = item.replace(/扩展$/u, "").replace(/线$/u, "");
      return normalized.includes(itemNormalized) || itemNormalized.includes(normalized);
    });
  });
  return partial ? partial.name : raw;
}

function patternCatalogEntry(name) {
  const canonical = canonicalPatternName(name);
  return PATTERN_CATALOG.find((pattern) => pattern.name === canonical) || null;
}

function patternLengthRange(name) {
  const catalog = patternCatalogEntry(name);
  const value = String(catalog?.bars || "").trim();
  const range = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const exact = value.match(/^\d+$/);
  if (exact) return { min: Number(value), max: Number(value) };
  const template = PATTERN_TEMPLATE_LIBRARY[patternTemplateKey(name)] || [];
  return { min: template.length || 1, max: template.length || 1 };
}

function isAllowedPatternLength(name, length) {
  const range = patternLengthRange(name);
  return length >= range.min && length <= range.max;
}

function patternTemplateKey(name) {
  const raw = String(name || "").trim();
  if (PATTERN_TEMPLATE_LIBRARY[raw]) return raw;
  const canonical = canonicalPatternName(raw);
  if (PATTERN_TEMPLATE_LIBRARY[canonical]) return canonical;
  const alias = PATTERN_CATALOG.find((pattern) => pattern.name === canonical)?.aliases?.find((item) => PATTERN_TEMPLATE_LIBRARY[item]);
  if (alias) return alias;
  const normalized = raw.replace(/扩展$/u, "").replace(/线$/u, "");
  return Object.keys(PATTERN_TEMPLATE_LIBRARY).find((key) => {
    const keyNormalized = key.replace(/扩展$/u, "").replace(/线$/u, "");
    return normalized.includes(keyNormalized) || keyNormalized.includes(normalized);
  }) || "启明星";
}

function patternTemplates(name) {
  const key = patternTemplateKey(name);
  return (PATTERN_TEMPLATE_LIBRARY[key] || PATTERN_TEMPLATE_LIBRARY["启明星"]).map(([open, high, low, close], index) => ({ date: String(index + 1), open, high, low, close }));
}

function patternCoverageSummary() {
  const buckets = PATTERN_CATALOG.reduce((acc, pattern) => {
    acc[pattern.status] = acc[pattern.status] || [];
    acc[pattern.status].push(pattern.name);
    return acc;
  }, {});
  return {
    total: PATTERN_CATALOG.length,
    implemented: buckets.implemented || [],
    approximated: buckets.approximated || [],
    planned: buckets.planned || [],
  };
}

function normalizeShapeBars(bars) {
  const values = bars.flatMap((b) => [b.open, b.high, b.low, b.close]).filter((v) => Number.isFinite(Number(v)));
  const high = Math.max(...values);
  const low = Math.min(...values);
  const span = high - low || Math.max(Math.abs(high), 1) * 0.01;
  return bars.map((b) => {
    const open = (b.open - low) / span;
    const highNorm = (b.high - low) / span;
    const lowNorm = (b.low - low) / span;
    const close = (b.close - low) / span;
    const candleRange = Math.max(highNorm - lowNorm, 0.001);
    const upper = highNorm - Math.max(open, close);
    const lower = Math.min(open, close) - lowNorm;
    return {
      open,
      high: highNorm,
      low: lowNorm,
      close,
      direction: Math.sign(b.close - b.open),
      bodyRatio: Math.abs(close - open) / candleRange,
      upperRatio: upper / candleRange,
      lowerRatio: lower / candleRange,
      closePos: (close - lowNorm) / candleRange,
    };
  });
}

function candleShapeDistance(a, b) {
  let distance = 0;
  distance += Math.abs(a.open - b.open) * 0.16;
  distance += Math.abs(a.high - b.high) * 0.13;
  distance += Math.abs(a.low - b.low) * 0.13;
  distance += Math.abs(a.close - b.close) * 0.20;
  distance += Math.abs(a.bodyRatio - b.bodyRatio) * 0.14;
  distance += Math.abs(a.upperRatio - b.upperRatio) * 0.08;
  distance += Math.abs(a.lowerRatio - b.lowerRatio) * 0.08;
  distance += Math.abs(a.closePos - b.closePos) * 0.08;
  if (a.bodyRatio > 0.08 && b.bodyRatio > 0.08 && a.direction !== b.direction) distance += 0.22;
  return distance;
}

function dtwShapeDistance(actual, template) {
  const n = actual.length;
  const m = template.length;
  const window = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * 0.35));
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  const steps = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    const jStart = Math.max(1, i - window);
    const jEnd = Math.min(m, i + window + Math.abs(n - m));
    for (let j = jStart; j <= jEnd; j++) {
      const cost = candleShapeDistance(actual[i - 1], template[j - 1]);
      const choices = [
        [dp[i - 1][j], steps[i - 1][j]],
        [dp[i][j - 1], steps[i][j - 1]],
        [dp[i - 1][j - 1], steps[i - 1][j - 1]],
      ].sort((x, y) => x[0] - y[0]);
      dp[i][j] = cost + choices[0][0];
      steps[i][j] = choices[0][1] + 1;
    }
  }
  const pathSteps = steps[n][m] || Math.max(n, m);
  return dp[n][m] / pathSteps;
}

function shapeSimilarityScore(actualBars, templateBars) {
  if (!actualBars.length || !templateBars.length) return 0;
  const actual = normalizeShapeBars(actualBars);
  const template = normalizeShapeBars(templateBars);
  const dtwDistance = dtwShapeDistance(actual, template);
  const lengthPenalty = Math.abs(actual.length - template.length) * 2.5;
  const actualTrend = actual.at(-1).close - actual[0].open;
  const templateTrend = template.at(-1).close - template[0].open;
  const trendPenalty = Math.sign(actualTrend) !== Math.sign(templateTrend) ? 8 : 0;
  return Math.max(0, Math.min(96, Math.round(100 - dtwDistance * 120 - lengthPenalty - trendPenalty)));
}

function addPattern(candidates, bars, data) {
  const length = data.endIndex - data.startIndex + 1;
  if (length < 1) return;
  if (!isAllowedPatternLength(data.name, length)) return;
  if (!Number.isFinite(data.score) || data.score < MIN_PATTERN_SCORE) return;
  const card = makeCard(bars, data);
  if (card.score >= MIN_PATTERN_SCORE) candidates.push(card);
}

function addTemplateSweepCandidates(candidates, bars, maxBars) {
  const n = bars.length;
  const maxLen = Math.max(1, Math.min(maxBars, n));
  for (let len = 1; len <= maxLen; len++) {
    const startIndex = n - len;
    const actual = bars.slice(startIndex, n);
    for (const [name, templateRaw] of Object.entries(PATTERN_TEMPLATE_LIBRARY)) {
      const template = templateRaw.map(([open, high, low, close], index) => ({ date: String(index + 1), open, high, low, close }));
      if (!isAllowedPatternLength(name, len)) continue;
      if (template.length !== len) continue;
      const shapeScore = shapeSimilarityScore(actual, template);
      if (shapeScore < MIN_PATTERN_SCORE) continue;
      const catalog = patternCatalogEntry(name);
      const highs = actual.map((b) => b.high);
      const lows = actual.map((b) => b.low);
      addPattern(candidates, bars, {
        startIndex,
        endIndex: n - 1,
        name,
        score: shapeScore,
        bias: catalog?.bias || "中性",
        why: `最后${len}根K线的归一化轮廓与「${name}」接近，属于图形相似度兜底匹配。`,
        meaning: "该匹配来自标准轮廓相似度，不等于规则完全确认；需要结合关键位和下一根K线确认。",
        judgement: "图形相似观察",
        confirm: Math.max(...highs),
        failure: Math.min(...lows),
      });
    }
  }
}

function patternCards(bars, maxMatchBars = 10) {
  const n = bars.length;
  const maxBars = Math.max(1, Math.min(10, Number(maxMatchBars) || 10));
  const candidates = [];
  const last = bars[n - 1];
  const avgVol = avgVolume(bars, n - 20, n - 1);

  if (n >= 2) {
    const li = candleInfo(last);
    const priorTrend = closeTrend(bars, Math.max(0, n - 7), n - 2);
    const singleBase = {
      startIndex: n - 1,
      endIndex: n - 1,
      confirm: last.high,
      failure: last.low,
    };
    const addSingle = (name, score, bias, why, meaning, judgement, confirm = last.high, failure = last.low) => {
      addPattern(candidates, bars, { ...singleBase, name, score, bias, why, meaning, judgement, confirm, failure });
    };

    if (priorTrend < 0 && li.lowerRatio >= 0.55 && li.upperRatio <= 0.25 && li.bodyRatio <= 0.35) {
      addSingle("锤子线", 72 + li.lowerRatio * 16, "偏多", "下跌背景中最新K线出现长下影，低位被买回。", "锤子线是单根止跌线索，必须等待后续阳线或站回确认位。", "单K止跌观察");
    }
    if (priorTrend < 0 && li.upperRatio >= 0.52 && li.lowerRatio <= 0.25 && li.bodyRatio <= 0.35) {
      addSingle("倒锤子线", 70 + li.upperRatio * 16, "偏多", "下跌背景中最新K线向上试探，但收盘仍未完全确认。", "倒锤子线只代表低位反攻尝试，下一根确认很关键。", "单K反攻观察");
    }
    if (priorTrend > 0 && li.upperRatio >= 0.55 && li.lowerRatio <= 0.25 && li.bodyRatio <= 0.35) {
      addSingle("流星线", 72 + li.upperRatio * 16, "偏空", "上涨背景中最新K线冲高回落，长上影显示上方供给增强。", "流星线是顶部警告线索，需要后续跌破或阴线确认。", "单K风险观察", last.high, last.low);
    }
    if (priorTrend > 0 && li.lowerRatio >= 0.52 && li.upperRatio <= 0.25 && li.bodyRatio <= 0.35) {
      addSingle("上吊线", 70 + li.lowerRatio * 16, "偏空", "上涨背景中最新K线出现长下影，说明支撑被明显测试。", "上吊线在高位有警告意义，但仍需后一根转弱确认。", "单K顶部观察", last.high, last.low);
    }
    if (li.isDoji && Math.max(li.upperRatio, li.lowerRatio) >= 0.42) {
      const name = li.upperRatio > 0.58 ? "墓碑十字" : li.lowerRatio > 0.58 ? "蜻蜓十字" : li.upperRatio + li.lowerRatio > 0.72 ? "长腿十字" : "普通十字线";
      const bias = priorTrend > 0 && li.closePos < 0.55 ? "偏空" : priorTrend < 0 && li.closePos > 0.45 ? "偏多" : "中性";
      addSingle(name, 70 + Math.max(li.upperRatio, li.lowerRatio) * 18, bias, "最新K线实体很小，说明多空进入犹豫和平衡。", "十字线本身不是方向结论，关键在它出现的位置和下一根K线方向。", "单K犹豫观察");
    }
    if (priorTrend < 0 && li.isBull && li.isLongBody && li.open <= last.low + li.range * 0.12 && li.closePos >= 0.78) {
      addSingle("看涨捉腰带线", 72 + li.bodyRatio * 16, "偏多", "下跌后出现接近最低开盘的大阳线，多方从开盘控制到收盘。", "捉腰带线代表一方强势夺回控制权，但仍要看位置和后续确认。", "单K反击观察");
    }
    if (priorTrend > 0 && li.isBear && li.isLongBody && li.open >= last.high - li.range * 0.12 && li.closePos <= 0.22) {
      addSingle("看跌捉腰带线", 72 + li.bodyRatio * 16, "偏空", "上涨后出现接近最高开盘的大阴线，卖方从开盘压到收盘。", "看跌捉腰带线说明高位供给强，但仍要看后一根是否延续。", "单K风险观察", last.high, last.low);
    }
  }

  if (n >= 3) {
    const a = bars[n - 2];
    const b = last;
    const ai = candleInfo(a);
    const bi = candleInfo(b);
    const priorTrend = closeTrend(bars, Math.max(0, n - 8), n - 3);
    const twoBase = {
      startIndex: n - 2,
      endIndex: n - 1,
    };
    const addTwo = (name, score, bias, why, meaning, judgement, confirm, failure) => {
      addPattern(candidates, bars, { ...twoBase, name, score, bias, why, meaning, judgement, confirm, failure });
    };
    const closeDiff = Math.abs(a.close - b.close) / Math.max(Math.abs(a.close), Math.abs(b.close), 1);
    const lowDiff = Math.abs(a.low - b.low) / Math.max(Math.abs(a.low), Math.abs(b.low), 1);
    const highDiff = Math.abs(a.high - b.high) / Math.max(Math.abs(a.high), Math.abs(b.high), 1);

    if (priorTrend < 0 && ai.isBear && bi.isBull && b.open < a.close && b.close > a.open) {
      addTwo("看涨吞没", 76 + bi.bodyRatio * 14, "偏多", "后一根阳线完全吞没前一根阴线实体，短线多方夺回收盘控制权。", "吞没形态强调后一方压过前一方，但最好等待后续确认。", "双K反击观察", b.high, Math.min(a.low, b.low));
    }
    if (priorTrend > 0 && ai.isBull && bi.isBear && b.open > a.close && b.close < a.open) {
      addTwo("看跌吞没", 76 + bi.bodyRatio * 14, "偏空", "后一根阴线完全吞没前一根阳线实体，说明高位卖压增强。", "看跌吞没是顶部风险线索，后续跌破低点才更有效。", "双K顶部风险", Math.max(a.high, b.high), b.low);
    }
    if (priorTrend > 0 && ai.isBull && bi.isBear && b.open > a.high * 0.998 && b.close < ai.mid && b.close > a.open) {
      addTwo("乌云盖顶", 74 + Math.abs(priorTrend) * 2, "偏空", "上涨后冲高开出，但收盘切入前一根阳线实体中部以下。", "乌云盖顶代表高位进攻失败，后一根继续转弱则风险增加。", "双K风险", Math.max(a.high, b.high), b.low);
    }
    if (priorTrend < 0 && ai.isBear && bi.isBull && b.open < a.low * 1.002 && b.close > ai.mid && b.close < a.open) {
      addTwo("刺透形态", 74 + Math.abs(priorTrend) * 2, "偏多", "下跌后低开或下探，随后收回前一根阴线实体中部以上。", "刺透形态是下跌后的反攻线索，需要后续站稳确认位。", "双K止跌观察", Math.max(a.high, b.high), Math.min(a.low, b.low));
    }
    if (ai.isLongBody && bi.bodyRatio <= 0.38 && Math.max(b.open, b.close) < Math.max(a.open, a.close) && Math.min(b.open, b.close) > Math.min(a.open, a.close)) {
      const bullish = priorTrend < 0 && ai.isBear;
      const bearish = priorTrend > 0 && ai.isBull;
      if (bullish || bearish) {
        addTwo(bi.isDoji ? "十字孕线" : bullish ? "看涨孕线" : "看跌孕线", 72 + Math.abs(priorTrend) * 2 + (bi.isDoji ? 6 : 0), bullish ? "偏多" : "偏空", "大实体后出现被包含的小实体，原趋势动能收缩。", "孕线代表原趋势失去单边推进能力，需要等待突破方向确认。", bullish ? "双K止跌观察" : "双K风险观察", Math.max(a.high, b.high), Math.min(a.low, b.low));
      }
    }
    if (priorTrend < 0 && ai.isBear && bi.isBull && closeDiff <= 0.004) {
      addTwo("看涨反击线", 72 + (0.004 - closeDiff) * 3000, "偏多", "两根相反方向K线收盘价接近，说明空方遭遇反击。", "反击线强度弱于吞没，必须看后续确认。", "双K反击观察", Math.max(a.high, b.high), Math.min(a.low, b.low));
    }
    if (priorTrend > 0 && ai.isBull && bi.isBear && closeDiff <= 0.004) {
      addTwo("看跌反击线", 72 + (0.004 - closeDiff) * 3000, "偏空", "两根相反方向K线收盘价接近，说明多方遭遇反击。", "反击线强度弱于吞没，必须看后续确认。", "双K风险观察", Math.max(a.high, b.high), Math.min(a.low, b.low));
    }
    if (priorTrend < 0 && lowDiff <= 0.0035) {
      addTwo("平头底部", 72 + (0.0035 - lowDiff) * 4000, "中性", "连续两根低点接近，同一区域出现支撑测试。", "平头底部只是支撑线索，跌破共同低点则失败。", "双K支撑观察", Math.max(a.high, b.high), Math.min(a.low, b.low));
    }
    if (priorTrend > 0 && highDiff <= 0.0035) {
      addTwo("平头顶部", 72 + (0.0035 - highDiff) * 4000, "偏空", "连续两根高点接近，同一区域上攻受阻。", "平头顶部是压力线索，突破共同高点则风险下降。", "双K压力观察", Math.max(a.high, b.high), Math.min(a.low, b.low));
    }
  }

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

  addTemplateSweepCandidates(candidates, bars, maxBars);

  const latestCandidates = candidates.filter((card) => card.endIndex === n - 1 && card.matchBars >= 1 && card.matchBars <= maxBars);
  const deduped = [];
  const used = new Set();
  for (const card of latestCandidates.sort((a, b) => b.score - a.score || b.matchBars - a.matchBars)) {
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
    "根节点必须是 <section class=\"section ai-brief\"><h2>K线形态匹配 <span class=\"trend-title-accent\">AI</span> 解读</h2>。",
    "请同时从三个角度组织结论：1) K线相似度，2) 历史趋势拟合（如提供的 historical_trend_stats），3) ABC/2B结构（analysis_angles/abc_momentum）。",
    "结构必须包含两块：",
    "1. <div class=\"ai-thesis\"><strong>核心判断：</strong>...</div>，一句话说明主方向和风险优先级。",
    `2. <ol class="ai-top5"> 写超过${MIN_PATTERN_SCORE}%的匹配形态概括；如没有超过${MIN_PATTERN_SCORE}%的形态，明确说明暂无高可信经典形态，并解释是规则分或图形分未同时达标，不要强行套形态。`,
    `要求：最终结论前置；禁止确定性语言；必须提到超过${MIN_PATTERN_SCORE}%的形态概括或无高可信匹配原因；文字克制、可扫描。确认位和失败位已经在K线图标注，不要再单独输出确认/失败位卡片，也不要输出风险提示段。`,
  ].join("\n");
}

function aiFailureHtml(providerName, detail) {
  return `<section class="section"><h2>K线形态匹配 <span class="trend-title-accent">AI</span> 解读</h2><p>${safeHtml(providerName)} 调用失败，已保留规则版报告。${safeHtml(detail || "")}</p></section>`;
}

function colorAiBiasText(html) {
  return String(html || "")
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part
        .replaceAll("偏多", '<span class="ai-bias ai-bull">偏多</span>')
        .replaceAll("偏空", '<span class="ai-bias ai-bear">偏空</span>')
        .replaceAll("中性", '<span class="ai-bias ai-flat">中性</span>');
    })
    .join("");
}

function normalizeAiHtml(html) {
  let text = String(html || "")
    .replace(/```html/gi, "")
    .replace(/```/g, "")
    .trim();
  text = text.replace(/AI\s*综合解读/g, "K线形态匹配 AI 解读");
  text = text.replace(/K线形态匹配\s*AI\s*解读/g, 'K线形态匹配 <span class="trend-title-accent">AI</span> 解读');
  if (!text) return '<section class="section ai-brief"><h2>K线形态匹配 <span class="trend-title-accent">AI</span> 解读</h2><p>AI 已调用，但返回内容为空。</p></section>';
  text = text.replace(/<p\b[^>]*class=["'][^"']*ai-risk[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, "");
  text = text.replace(/<p\b[^>]*>[\s\S]*?所有匹配均基于图形轮廓相似度[\s\S]*?<\/p>/gi, "");
  text = text.replace(/所有匹配均基于图形轮廓相似度[\s\S]*?(?:<\/section>|$)/gi, "</section>");
  text = colorAiBiasText(text);
  if (/class=["'][^"']*ai-brief/.test(text)) return text;
  if (/<section\b/i.test(text)) {
    return text.replace(/<section\b([^>]*)>/i, (match, attrs) => {
      if (/class=/i.test(attrs)) return match.replace(/class=["']([^"']*)["']/i, 'class="$1 ai-brief"');
      return `<section class="section ai-brief"${attrs}>`;
    });
  }
  return `<section class="section ai-brief"><h2>K线形态匹配 <span class="trend-title-accent">AI</span> 解读</h2>${text}</section>`;
}

function flattenAiSection(html) {
  const text = String(html || "").trim();
  if (!text) return { thesis: "", body: "" };
  const thesisMatch = text.match(/<div\b[^>]*class=["'][^"']*ai-thesis[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const thesis = thesisMatch ? thesisMatch[1].replace(/<strong>\s*核心判断：\s*<\/strong>/i, "").trim() : "";
  let body = text
    .replace(/<section\b[^>]*>/gi, "")
    .replace(/<\/section>/gi, "")
    .replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "")
    .replace(/<div\b[^>]*class=["'][^"']*ai-thesis[^"']*["'][^>]*>[\s\S]*?<\/div>/i, "")
    .trim();
  return { thesis, body };
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

function candleChartSvg(bars, cards, keyLevels = {}) {
  const chartBars = bars.slice(-48);
  const width = 1120;
  const height = 430;
  const pad = { left: 64, right: 82, top: 34, bottom: 56 };
  const priceHeight = 284;
  const volumeTop = pad.top + priceHeight + 24;
  const volumeHeight = 70;
  const innerWidth = width - pad.left - pad.right;
  const trendPaths = Array.isArray(keyLevels.trendPaths) ? keyLevels.trendPaths : [];
  const historicalTrendStats = keyLevels.historicalTrendStats;
  const hasHistoricalTrendStats = historicalTrendStats && !historicalTrendStats.insufficient && historicalTrendStats.valid >= 8;
  const futureSlots = trendPaths.length ? 12 : 0;
  const keyLineItems = [
    { value: keyLevels.failure ?? keyLevels.support, color: "#40d98a", label: "失败" },
    { value: keyLevels.latest, color: "#edf2ff", label: "最新" },
    { value: keyLevels.confirm, color: "#79a8ff", label: "确认" },
    { value: keyLevels.pressure, color: "#ffd166", label: "压力" },
    { value: keyLevels.e20, color: "#c084fc", label: "E20" },
  ].filter((item) => Number.isFinite(Number(item.value)));
  const trendValues = trendPaths.flatMap((path) => [path.target, path.mid]).filter((value) => Number.isFinite(Number(value))).map(Number);
  const highs = chartBars.map((b) => b.high).concat(keyLineItems.map((item) => Number(item.value)), trendValues);
  const lows = chartBars.map((b) => b.low).concat(keyLineItems.map((item) => Number(item.value)), trendValues);
  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const pricePad = Math.max((maxPrice - minPrice) * 0.08, maxPrice * 0.002);
  const topPrice = maxPrice + pricePad;
  const bottomPrice = minPrice - pricePad;
  const maxVolume = Math.max(...chartBars.map((b) => b.volume || 0), 1);
  const candleSlot = innerWidth / (chartBars.length + futureSlots);
  const candleWidth = Math.max(4, Math.min(14, candleSlot * 0.58));
  const last = chartBars.at(-1);

  const xAt = (i) => pad.left + candleSlot * i + candleSlot / 2;
  const yPrice = (value) => pad.top + ((topPrice - value) / (topPrice - bottomPrice)) * priceHeight;
  const yVolume = (value) => volumeTop + volumeHeight - (value / maxVolume) * volumeHeight;
  const line = (value, color, label, index) => {
    if (!Number.isFinite(Number(value))) return "";
    const y = yPrice(value);
    const labelY = Math.max(pad.top + 12, Math.min(pad.top + priceHeight - 4, y + 4 + index * 3));
    return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1.4" stroke-dasharray="6 6"/><rect x="${width - pad.right + 6}" y="${(labelY - 12).toFixed(1)}" width="76" height="18" rx="4" fill="#0b1227" opacity=".9"/><text x="${width - pad.right + 10}" y="${labelY.toFixed(1)}" fill="${color}" font-size="12" font-weight="700">${safeHtml(label)} ${formatPrice(value)}</text>`;
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

  const keyLines = keyLineItems.map((item, index) => line(Number(item.value), item.color, item.label, index)).join("");
  const trendDefs = trendPaths.length
    ? `<defs>${trendPaths.map((path, index) => `<marker id="trendArrow${index}" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${path.color}"/></marker>`).join("")}</defs>`
    : "";
  const startX = xAt(chartBars.length - 1);
  const startY = yPrice(last.close);
  const trendOverlay = trendPaths
    .map((path, index) => {
      const endX = Math.min(width - pad.right - 18, startX + candleSlot * (4.8 + index * 0.8));
      const targetY = yPrice(path.target);
      const midY = yPrice(path.mid ?? ((last.close + path.target) / 2));
      const controlX = startX + (endX - startX) * 0.48;
      const labelWidth = path.name === "震荡" ? 198 : 174;
      const labelHeight = 48;
      const safeRightGap = 18;
      const labelRight = width - pad.right - safeRightGap;
      const labelX = Math.max(pad.left, labelRight - labelWidth);
      const rawLabelY = path.name === "偏多"
        ? pad.top + 22
        : path.name === "偏空"
          ? pad.top + priceHeight - labelHeight - 10
          : pad.top + priceHeight * 0.58;
      const labelY = Math.max(pad.top + 12, Math.min(pad.top + priceHeight - labelHeight - 8, rawLabelY));
      return `<path d="M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${controlX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${targetY.toFixed(1)}" fill="none" stroke="${path.color}" stroke-width="1.8" stroke-dasharray="7 5" marker-end="url(#trendArrow${index})" opacity=".92"/><rect x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" width="${labelWidth}" height="${labelHeight}" rx="9" fill="#0b1227" stroke="${path.color}" stroke-width="1.4" opacity=".96"/><line x1="${(labelX + 12).toFixed(1)}" y1="${(labelY + 18).toFixed(1)}" x2="${(labelX + 30).toFixed(1)}" y2="${(labelY + 18).toFixed(1)}" stroke="${path.color}" stroke-width="2.2" stroke-dasharray="5 4"/><text x="${(labelX + 40).toFixed(1)}" y="${(labelY + 23).toFixed(1)}" fill="${path.color}" font-size="15" font-weight="800">${safeHtml(path.name)} ${safeHtml(path.probability)}%</text><text x="${(labelX + 12).toFixed(1)}" y="${(labelY + 40).toFixed(1)}" fill="#cbd6ef" font-size="12">${safeHtml(path.trigger)}</text>`;
    })
    .join("");
  const trendNote = trendPaths.length
    ? hasHistoricalTrendStats
      ? `<span class="trend-note">右侧虚线箭头为历史样本统计路径：<span class="trend-stat">样本 ${safeHtml(historicalTrendStats.valid)}</span><span class="trend-stat">后 ${safeHtml(historicalTrendStats.horizon)} 根K线</span></span>`
      : '<span class="trend-note">右侧虚线箭头为测试模式模拟路径，标注概率与触发条件</span>'
    : "";
  return `<section class="section chart-section"><h2>历史K线趋势匹配，<span class="trend-title-accent">AI</span>预判趋势方向</h2><p>最近 ${chartBars.length} 根K线，已在图上标注关键位置。${trendNote}</p><div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeHtml("K线图")}">${trendDefs}<rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="#0b1227"/><text x="${pad.left}" y="22" fill="#edf2ff" font-size="16" font-weight="700">K线与成交量 · 关键位置</text>${grid}<line x1="${pad.left}" y1="${volumeTop + volumeHeight}" x2="${width - pad.right}" y2="${volumeTop + volumeHeight}" stroke="rgba(255,255,255,.14)"/><text x="14" y="${volumeTop + 10}" fill="#9fb0d8" font-size="12">Volume</text>${candles}${keyLines}${labels}<circle cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="4" fill="#edf2ff"/>${trendOverlay}</svg></div></section>`;
}

function directionMarkup(bias) {
  if (bias === "偏多") return '<span class="dir dir-bull"><span class="dir-icon">▲</span>偏多</span>';
  if (bias === "偏空") return '<span class="dir dir-bear"><span class="dir-icon">▼</span>偏空</span>';
  return '<span class="dir dir-flat"><span class="dir-icon">◆</span>中性</span>';
}

function drawMiniCandles({ bars, width = 660, height = 240, highlightStart = -1, highlightEnd = -1, label = "" }) {
  const pad = { left: 44, right: 18, top: 22, bottom: 28 };
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

function intervalLabel(interval) {
  const value = String(interval || "");
  if (value === "1d") return "日线";
  if (value === "60m") return "60分钟";
  if (value === "30m") return "30分钟";
  if (value === "15m") return "15分钟";
  return value;
}

function historicalScanRange(interval) {
  const value = String(interval || "1d").toLowerCase();
  if (value === "1d") return "5y";
  if (value === "60m") return "60d";
  if (value === "30m") return "30d";
  if (value === "15m") return "30d";
  return "1y";
}

function marketSampleSymbols(market, currentYahoo) {
  const current = String(currentYahoo || "").toUpperCase();
  const samples = {
    us: ["^IXIC", "QQQ", "SPY", "AAPL", "NVDA", "TSLA", "MSTR"],
    hk: ["^HSI", "0700.HK", "9988.HK", "3690.HK", "0388.HK", "1299.HK"],
    cn: ["000001.SS", "399001.SZ", "600570.SS", "600519.SS", "000858.SZ", "300750.SZ"],
    global: ["DX-Y.NYB", "GC=F", "CL=F", "^VIX", "^SOX"],
    crypto: ["BTC-USD", "ETH-USD", "SOL-USD"],
  }[String(market || "us").toLowerCase()] || ["^IXIC", "QQQ", "SPY"];
  return [current, ...samples.map((item) => String(item).toUpperCase())]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);
}

async function fetchHistoricalSampleSets({ yahoo, market, interval, scope }) {
  const symbols = String(scope || "0") === "1" ? marketSampleSymbols(market, yahoo) : [String(yahoo || "").toUpperCase()];
  const range = historicalScanRange(interval);
  const sets = [];
  for (const symbol of symbols) {
    try {
      const data = await fetchYahooBars(symbol, range, interval, market);
      if (data.bars.length >= 40) sets.push({ symbol, bars: data.bars });
    } catch {
      // Some cross-market samples may not exist for every interval; skip quietly.
    }
  }
  return sets;
}

function outcomeThresholdPercent(bars, endIndex) {
  const start = Math.max(1, endIndex - 20);
  const slice = bars.slice(start, endIndex + 1);
  if (!slice.length) return 0.6;
  const avgRangePct = slice.reduce((sum, bar) => sum + ((bar.high - bar.low) / Math.max(Math.abs(bar.close), 1)) * 100, 0) / slice.length;
  return Math.max(0.35, Math.min(2.5, avgRangePct * 0.35));
}

function matchingHistoricalCard(historyCards, currentCards) {
  for (const current of currentCards) {
    const matched = historyCards.find((card) => card.canonicalName === current.canonicalName && card.matchBars === current.matchBars);
    if (matched) return matched;
  }
  for (const current of currentCards) {
    const matched = historyCards.find((card) => card.canonicalName === current.canonicalName);
    if (matched) return matched;
  }
  return null;
}

function scanHistoricalTrendStats(sampleSets, currentCards, maxMatchBars, horizon = 5) {
  if (!currentCards.length || !sampleSets.length) return null;
  const patternNames = currentCards.map((card) => card.canonicalName || card.name).filter(Boolean);
  const counts = { bull: 0, bear: 0, flat: 0 };
  let total = 0;
  let valid = 0;
  for (const set of sampleSets) {
    const bars = set.bars || [];
    const firstEnd = Math.max(30, Number(maxMatchBars) + 20);
    const lastEnd = bars.length - horizon - 2;
    const scanStart = Math.max(firstEnd, lastEnd - 900);
    for (let endIndex = scanStart; endIndex <= lastEnd; endIndex++) {
      const historyCards = patternCards(bars.slice(0, endIndex + 1), maxMatchBars);
      const matched = matchingHistoricalCard(historyCards, currentCards);
      if (!matched) continue;
      total += 1;
      const future = bars[endIndex + horizon];
      if (!future) continue;
      const change = pct(bars[endIndex].close, future.close);
      const threshold = outcomeThresholdPercent(bars, endIndex);
      valid += 1;
      if (change >= threshold) counts.bull += 1;
      else if (change <= -threshold) counts.bear += 1;
      else counts.flat += 1;
    }
  }
  if (!valid) return { total, valid, horizon, patternNames, insufficient: true };
  const ratio = (value) => Math.round((value / valid) * 100);
  return {
    total,
    valid,
    horizon,
    patternNames,
    insufficient: valid < 8,
    bull: counts.bull,
    bear: counts.bear,
    flat: counts.flat,
    bullProbability: ratio(counts.bull),
    bearProbability: ratio(counts.bear),
    flatProbability: ratio(counts.flat),
  };
}

function futureTrendPaths({ cards, last, support, pressure1, pressure2, e20, e60, mom10, rsi14, historicalTrendStats }) {
  const bullCount = cards.filter((card) => card.bias === "偏多").length;
  const bearCount = cards.filter((card) => card.bias === "偏空").length;
  const flatCount = cards.filter((card) => card.bias === "中性").length;
  const aboveE20 = Number.isFinite(e20) && last.close >= e20;
  const aboveE60 = Number.isFinite(e60) && last.close >= e60;
  const momentumBull = mom10 == null ? 0 : mom10 > 0 ? 8 : 0;
  const momentumBear = mom10 == null ? 0 : mom10 < 0 ? 8 : 0;
  const momentumFlat = mom10 == null ? 4 : Math.abs(mom10) <= 1 ? 8 : 0;
  const rsiBull = rsi14 == null ? 0 : rsi14 >= 55 ? 6 : 0;
  const rsiBear = rsi14 == null ? 0 : rsi14 <= 45 ? 6 : 0;
  const rsiFlat = rsi14 == null ? 4 : rsi14 > 45 && rsi14 < 55 ? 6 : 0;
  const scores = {
    bull: 28 + bullCount * 10 + momentumBull + (aboveE20 ? 5 : 0) + rsiBull,
    bear: 28 + bearCount * 10 + momentumBear + (!aboveE20 ? 5 : 0) + (!aboveE60 ? 4 : 0) + rsiBear,
    flat: 24 + flatCount * 10 + momentumFlat + rsiFlat,
  };
  const total = Math.max(1, scores.bull + scores.bear + scores.flat);
  const probability = (value) => Math.max(12, Math.round((value / total) * 100));
  const bullTarget = Math.max(pressure2, pressure1, last.close * 1.01);
  const bearTarget = Math.min(support, last.close * 0.99);
  const flatTarget = (Math.max(pressure1, last.close) + Math.min(support, last.close)) / 2;
  const hasHistory = historicalTrendStats && !historicalTrendStats.insufficient && historicalTrendStats.valid >= 8;
  const bullProbability = hasHistory ? historicalTrendStats.bullProbability : probability(scores.bull);
  const bearProbability = hasHistory ? historicalTrendStats.bearProbability : probability(scores.bear);
  const flatProbability = hasHistory ? historicalTrendStats.flatProbability : probability(scores.flat);
  const historySuffix = hasHistory ? `｜样本${historicalTrendStats.valid}` : "";
  return [
    {
      name: "偏多",
      color: "#ff7a88",
      probability: bullProbability,
      target: bullTarget,
      mid: Math.max(pressure1, (last.close + bullTarget) / 2),
      trigger: `站回${formatPrice(pressure1)}${historySuffix}`,
    },
    {
      name: "偏空",
      color: "#40d98a",
      probability: bearProbability,
      target: bearTarget,
      mid: Math.min(support, (last.close + bearTarget) / 2),
      trigger: `跌破${formatPrice(support)}${historySuffix}`,
    },
    {
      name: "震荡",
      color: "#ffd166",
      probability: flatProbability,
      target: flatTarget,
      mid: last.close,
      trigger: `区间${formatPrice(support)}-${formatPrice(pressure1)}${historySuffix}`,
    },
  ].sort((a, b) => b.probability - a.probability);
}

function summarizeAbcMomentum({ bars, last, support, pressure1, pressure2, e20, e60, mom10, rsi14 }) {
  function findLocalPivots(inputBars) {
    const pivots = [];
    for (let index = 1; index < inputBars.length - 1; index += 1) {
      const prev = inputBars[index - 1];
      const bar = inputBars[index];
      const next = inputBars[index + 1];
      const isHigh = (bar.high >= prev.high && bar.high >= next.high) && (bar.high > prev.high || bar.high > next.high);
      const isLow = (bar.low <= prev.low && bar.low <= next.low) && (bar.low < prev.low || bar.low < next.low);
      if (isHigh) pivots.push({ type: "high", index, bar, price: bar.high });
      if (isLow) pivots.push({ type: "low", index, bar, price: bar.low });
    }
    return pivots.sort((a, b) => a.index - b.index);
  }

  function buildBullAbcCandidate(inputBars) {
    const seq = inputBars.slice(-12);
    if (seq.length < 6) return null;
    const aIndex = seq.reduce((best, bar, index) => (best == null || bar.low < seq[best].low ? index : best), null);
    if (aIndex == null || aIndex >= seq.length - 3) return null;
    const bIndex = seq.reduce((best, bar, index) => (
      index > aIndex && index < seq.length - 1 && (best == null || bar.high > seq[best].high) ? index : best
    ), null);
    if (bIndex == null || bIndex <= aIndex || bIndex >= seq.length - 2) return null;
    const cIndex = seq.reduce((best, bar, index) => (
      index > bIndex && index < seq.length - 1 && (best == null || bar.low < seq[best].low) ? index : best
    ), null);
    if (cIndex == null || cIndex <= bIndex) return null;
    const a = seq[aIndex];
    const b = seq[bIndex];
    const c = seq[cIndex];
    if (!a || !b || !c) return null;
    const recovery = Math.max(0.01, (b.high - a.low) / Math.max(Math.abs(a.low), 1));
    const cAboveA = c.low > a.low * 1.002;
    const cBelowB = c.high < b.high * 0.998;
    const valid = recovery >= 0.02 && cAboveA && cBelowB;
    return {
      valid,
      a,
      b,
      c,
      aIndex,
      bIndex,
      cIndex,
      recovery,
      lastBars: seq,
    };
  }

  function buildBearAbcCandidate(inputBars) {
    const seq = inputBars.slice(-12);
    if (seq.length < 6) return null;
    const aIndex = seq.reduce((best, bar, index) => (best == null || bar.high > seq[best].high ? index : best), null);
    if (aIndex == null || aIndex >= seq.length - 3) return null;
    const bIndex = seq.reduce((best, bar, index) => (
      index > aIndex && index < seq.length - 1 && (best == null || bar.low < seq[best].low) ? index : best
    ), null);
    if (bIndex == null || bIndex <= aIndex || bIndex >= seq.length - 2) return null;
    const cIndex = seq.reduce((best, bar, index) => (
      index > bIndex && index < seq.length - 1 && (best == null || bar.high > seq[best].high) ? index : best
    ), null);
    if (cIndex == null || cIndex <= bIndex) return null;
    const a = seq[aIndex];
    const b = seq[bIndex];
    const c = seq[cIndex];
    if (!a || !b || !c) return null;
    const decline = Math.max(0.01, (a.high - b.low) / Math.max(Math.abs(a.high), 1));
    const cBelowA = c.high < a.high * 0.998;
    const cAboveB = c.low > b.low * 1.002;
    const valid = decline >= 0.02 && cBelowA && cAboveB;
    return {
      valid,
      a,
      b,
      c,
      aIndex,
      bIndex,
      cIndex,
      decline,
      lastBars: seq,
    };
  }

  const aboveE20 = Number.isFinite(e20) && last.close >= e20;
  const aboveE60 = Number.isFinite(e60) && last.close >= e60;
  const belowE20 = Number.isFinite(e20) && last.close < e20;
  const belowE60 = Number.isFinite(e60) && last.close < e60;
  const recentTrend = closeTrend(bars, Math.max(0, bars.length - 8), bars.length - 1);
  const recentBars = bars.slice(-4);
  const risingCloses = recentBars.slice(1).filter((bar, index) => bar.close >= recentBars[index].close).length;
  const recentHigherHighs = recentBars.slice(1).filter((bar, index) => bar.high >= recentBars[index].high).length;
  const recentLowerCloses = recentBars.slice(1).filter((bar, index) => bar.close <= recentBars[index].close).length;
  const recentLowerHighs = recentBars.slice(1).filter((bar, index) => bar.high <= recentBars[index].high).length;
  const recentLowerLows = recentBars.slice(1).filter((bar, index) => bar.low <= recentBars[index].low).length;
  const recentVol = avgVolume(bars, Math.max(0, bars.length - 5), bars.length - 1);
  const prevVol = avgVolume(bars, Math.max(0, bars.length - 15), Math.max(0, bars.length - 6));
  const volRatio = prevVol > 0 ? recentVol / prevVol : 1;
  const momentum = Number.isFinite(mom10) ? mom10 : 0;
  const rsi = Number.isFinite(rsi14) ? rsi14 : 50;
  const structureSpan = Math.max(Math.abs(pressure1 - support), Math.max(Math.abs(last.close), 1) * 0.01);
  const closePosition = Number.isFinite(structureSpan) && structureSpan > 0
    ? (last.close - support) / structureSpan
    : 0.5;
  const normalizedClosePosition = Math.max(0, Math.min(1.2, closePosition));
  const nearConfirmZone = closePosition >= 0.72;
  const nearCRecoveryZone = closePosition >= 0.56;
  const nearSupportZone = closePosition <= 0.18;
  const belowMidZone = closePosition <= 0.38;
  const confirmGapRatio = structureSpan > 0 ? Math.max(0, (pressure1 - last.close) / structureSpan) : 1;
  const risingIntoConfirm = recentTrend > 0 && risingCloses >= 2 && recentHigherHighs >= 2;
  const breakoutAttempt = risingIntoConfirm && normalizedClosePosition >= 0.88;
  const fallingIntoBreak = recentTrend < 0 && recentLowerCloses >= 2 && recentLowerHighs >= 2 && recentLowerLows >= 2;
  const weakBounceUnderE20 = belowE20 && recentTrend > 0 && normalizedClosePosition <= 0.58;
  const bullAbc = buildBullAbcCandidate(bars);
  const bearAbc = buildBearAbcCandidate(bars);
  const pivots = findLocalPivots(bars.slice(-14));
  const bearBreakThreshold = bearAbc?.b ? bearAbc.b.low * 1.01 : support;
  const bearFailureThreshold = bearAbc?.a ? bearAbc.a.high : pressure2;
  const bearReboundCeiling = bearAbc?.c ? bearAbc.c.high : pressure1;
  const bullConfirmThreshold = bullAbc?.b ? bullAbc.b.high : pressure1;
  const bullCThreshold = bullAbc?.c ? bullAbc.c.low : support;
  let stage = "ABC不适合判断";
  let positionLabel = "当前结构暂不适合 ABC 归类";
  let phaseKey = "unknown";
  let progress = 0.5;
  let bias = "中性";
  let note = "当前价格节奏不够清晰，A / B / C 的分界还不稳定，先不要强行套入 ABC 结构。";
  let trendMode = "unknown";
  let suitable = false;
  let primaryJudgement = "不适合判断";
  let currentStage = "结构待确认";
  let nextConfirm = "继续观察关键位和下一段价格/量能确认。";
  let rule123 = null;

  function detectBull123() {
    for (let index = pivots.length - 3; index >= 0; index -= 1) {
      const a = pivots[index];
      const b = pivots[index + 1];
      const c = pivots[index + 2];
      if (!a || !b || !c) continue;
      if (a.type !== "low" || b.type !== "high" || c.type !== "low") continue;
      if (c.index <= b.index || b.index <= a.index) continue;
      if (c.price <= a.price * 1.002) continue;
      if (c.index < pivots[pivots.length - 1]?.index - 2) continue;
      const confirmed = last.close > b.price * 1.002;
      const stageName = confirmed ? "下跌123第三步确认" : "下跌123第二步观察";
      return {
        valid: true,
        mode: "bull123",
        step: confirmed ? 3 : 2,
        bias: confirmed ? "偏多" : "中性",
        stage: stageName,
        note: confirmed
          ? `前低 ${formatPrice(a.price)} 之后已出现回踩不创新低，且当前重新突破前高 ${formatPrice(b.price)}，更像下跌123转强确认。`
          : `前低 ${formatPrice(a.price)} 后出现反弹，并在回踩时守住更高低点 ${formatPrice(c.price)}，更像下跌123的第二步观察。`,
        nextConfirm: confirmed
          ? `重点看能否继续站稳 ${formatPrice(b.price)} 上方并延续放量。`
          : `下一步重点看是否有效突破前高 ${formatPrice(b.price)}。`,
      };
    }
    if (recentTrend > 0 && aboveE20 && recentHigherHighs >= 2) {
      return {
        valid: true,
        mode: "bull123",
        step: 1,
        bias: "中性",
        stage: "下跌123第一步观察",
        note: "下降节奏首次被打断，价格开始尝试站回中期均线，但还没有形成完整的高低点确认。",
        nextConfirm: `下一步看回踩是否不再创新低，并尝试突破 ${formatPrice(pressure1)}。`,
      };
    }
    return null;
  }

  function detectBear123() {
    for (let index = pivots.length - 3; index >= 0; index -= 1) {
      const a = pivots[index];
      const b = pivots[index + 1];
      const c = pivots[index + 2];
      if (!a || !b || !c) continue;
      if (a.type !== "high" || b.type !== "low" || c.type !== "high") continue;
      if (c.index <= b.index || b.index <= a.index) continue;
      if (c.price >= a.price * 0.998) continue;
      if (c.index < pivots[pivots.length - 1]?.index - 2) continue;
      const confirmed = last.close < b.price * 0.998;
      const stageName = confirmed ? "上涨123第三步确认" : "上涨123第二步观察";
      return {
        valid: true,
        mode: "bear123",
        step: confirmed ? 3 : 2,
        bias: "偏空",
        stage: stageName,
        note: confirmed
          ? `前高 ${formatPrice(a.price)} 之后已出现反弹不创新高，且当前跌回前低 ${formatPrice(b.price)} 下方，更像上涨123转弱确认。`
          : `前高 ${formatPrice(a.price)} 之后的反弹没有收复新高，当前更像上涨123第二步，正在等待前低 ${formatPrice(b.price)} 是否失守。`,
        nextConfirm: confirmed
          ? `重点看是否继续压在 ${formatPrice(b.price)} 下方并形成新的下跌段。`
          : `下一步重点看是否跌破前低 ${formatPrice(b.price)}。`,
      };
    }
    if (recentTrend < 0 && belowE20 && recentLowerCloses >= 2) {
      return {
        valid: true,
        mode: "bear123",
        step: 1,
        bias: "中性",
        stage: "上涨123第一步观察",
        note: "上升节奏首次被打断，价格回到中期均线下方，但还没有形成完整的不创新高与跌破前低确认。",
        nextConfirm: `下一步看反弹是否不能收复前高，并观察 ${formatPrice(support)} 是否被跌破。`,
      };
    }
    return null;
  }

  rule123 = detectBear123() || detectBull123();

  if (bearAbc?.valid && last.close < bearAbc.b.low && recentTrend < 0) {
    stage = "高位ABC跌破 B";
    positionLabel = "当前更像高位下跌 ABC 完成，正在跌破 B 点";
    phaseKey = "C_DOWN";
    progress = 0.95;
    bias = "偏空";
    note = `A 高点 ${formatPrice(bearAbc.a.high)}、B 低点 ${formatPrice(bearAbc.b.low)}、C 反抽高点 ${formatPrice(bearAbc.c.high)} 已形成；当前正在向下跌破 B 点，更像高位 ABC 转弱确认。`;
    trendMode = "bear";
    suitable = true;
  } else if (bearAbc?.valid && last.close <= bearBreakThreshold && recentTrend < 0) {
    stage = "高位ABC临近跌破 B";
    positionLabel = "当前更像高位下跌 ABC 的 C 段末端，正逼近 B 点";
    phaseKey = "C_DOWN";
    progress = 0.88;
    bias = "偏空";
    note = `A / B / C 三段已经较完整，当前价已逼近 B 点 ${formatPrice(bearAbc.b.low)}，下一步重点看是否有效跌破。`;
    trendMode = "bear";
    suitable = true;
  } else if (bearAbc?.valid && last.close < bearReboundCeiling && belowE20 && recentTrend <= 0) {
    stage = "高位ABC的 C 段下压";
    positionLabel = "当前更像高位下跌 ABC 的 C 段下压";
    phaseKey = "C_DOWN";
    progress = 0.78;
    bias = "偏空";
    note = `价格在 C 段反抽后重新走弱，仍未回到 A 高点上方，更像高位 ABC 的 C 段向下延伸。`;
    trendMode = "bear";
    suitable = true;
  } else if (bearAbc?.valid && last.close < bearAbc.a.high && recentTrend > 0) {
    stage = "高位ABC的 B→C 反抽";
    positionLabel = "当前更像高位下跌 ABC 的 B 到 C 反抽";
    phaseKey = "B_REBOUND";
    progress = 0.52;
    bias = "偏空";
    note = `前面已经走出 A 高点到 B 低点的下跌，当前反抽更像 B 到 C，而不是新的上升主段。`;
    trendMode = "bear";
    suitable = true;
  } else if (bearAbc?.valid && belowE20 && recentTrend < 0 && bearAbc.aIndex <= 3) {
    stage = "高位ABC的 A 段下跌";
    positionLabel = "当前更像高位下跌 ABC 的 A 段启动";
    phaseKey = "A_DOWN";
    progress = 0.24;
    bias = "偏空";
    note = `上方高点后开始转弱，但 B / C 尚未完全走出，更像高位 ABC 的第一段下跌。`;
    trendMode = "bear";
    suitable = true;
  } else if (belowE20 && belowE60 && momentum <= -2.5 && last.close < support) {
    stage = "C 段跌破延续";
    positionLabel = "当前更像下跌 ABC 的 C 段破位延续";
    phaseKey = "C_DOWN";
    progress = 0.95;
    bias = "偏空";
    note = "前低已被跌穿，反抽没有站回关键位，更像下跌 ABC 的 C 段破位延续。";
    trendMode = "bear";
    suitable = true;
  } else if (belowE20 && fallingIntoBreak && nearSupportZone) {
    stage = "C 段临近破前低";
    positionLabel = "当前更像下跌 ABC 的 C 段下压，正逼近前低";
    phaseKey = "C_DOWN";
    progress = 0.88;
    bias = "偏空";
    note = "最近几根K线连续走弱，已经逼近前低，下一步重点看是否向下破位。";
    trendMode = "bear";
    suitable = true;
  } else if (belowE20 && momentum < 0 && belowMidZone) {
    stage = "C 段再下压";
    positionLabel = "当前更像下跌 ABC 的 C 段再下压";
    phaseKey = "C_DOWN";
    progress = 0.76;
    bias = "偏空";
    note = "反抽后重新转弱，价格回到结构下半区，更像进入 C 段再下压。";
    trendMode = "bear";
    suitable = true;
  } else if (weakBounceUnderE20) {
    stage = "B 段反抽";
    positionLabel = "当前更像下跌 ABC 的 B 段反抽";
    phaseKey = "B_REBOUND";
    progress = 0.50;
    bias = "偏空";
    note = "价格有反弹，但仍压在 E20 下方，更像下跌结构中的 B 段反抽，而非新一轮上升。";
    trendMode = "bear";
    suitable = true;
  } else if (belowE20 && recentTrend < 0 && normalizedClosePosition <= 0.62) {
    stage = "A 段下跌启动";
    positionLabel = "当前更像下跌 ABC 的 A 段下跌";
    phaseKey = "A_DOWN";
    progress = 0.24;
    bias = "偏空";
    note = "价格脱离上方压力并持续走弱，更像下跌结构的 A 段正在展开。";
    trendMode = "bear";
    suitable = true;
  } else if (last.close < support && !aboveE20 && momentum < 0) {
    stage = "结构失败";
    positionLabel = "ABC 结构失效，优先按破位处理";
    phaseKey = "fail";
    progress = 1;
    bias = "偏空";
    note = "关键支撑被破坏后，原先的 ABC 解释优先降级，先看是否形成新的底部结构。";
    trendMode = "bear";
    suitable = true;
  } else if (bullAbc?.valid && last.close > bullAbc.b.high && recentTrend > 0) {
    stage = "低位ABC突破 B";
    positionLabel = "当前更像低位修复 ABC 完成，正在突破 B 点";
    phaseKey = "C";
    progress = 0.94;
    bias = "偏多";
    note = `A 低点 ${formatPrice(bullAbc.a.low)}、B 高点 ${formatPrice(bullAbc.b.high)}、C 回踩低点 ${formatPrice(bullAbc.c.low)} 已形成；当前更像低位 ABC 的突破确认。`;
    trendMode = "bull";
    suitable = true;
  } else if (bullAbc?.valid && last.close >= bullConfirmThreshold * 0.985 && recentTrend > 0) {
    stage = "低位ABC临近突破 B";
    positionLabel = "当前更像低位修复 ABC 的 C 段末端，正靠近 B 点";
    phaseKey = "C";
    progress = 0.84;
    bias = "偏多";
    note = `当前位置已经从 C 点低位回升到 B 点附近，重点看是否能有效突破 ${formatPrice(bullAbc.b.high)}。`;
    trendMode = "bull";
    suitable = true;
  } else if (bullAbc?.valid && last.close > bullCThreshold && aboveE20 && recentTrend > 0) {
    stage = "低位ABC的 C 段回升";
    positionLabel = "当前更像低位修复 ABC 的 C 段回升";
    phaseKey = "C";
    progress = 0.72;
    bias = "偏多";
    note = `B 后回踩没有跌破 A，当前重新回升，更像从 C 点区域向确认位推进。`;
    trendMode = "bull";
    suitable = true;
  } else if (bullAbc?.valid && last.close > bullAbc.a.low && recentTrend <= 0) {
    stage = "低位ABC的 B→C 回踩";
    positionLabel = "当前更像低位修复 ABC 的 B 到 C 回踩";
    phaseKey = "BC";
    progress = 0.56;
    bias = "中性";
    note = `当前更像 B 后回踩途中，关键看 C 点是否高于 A 点并缩量企稳。`;
    trendMode = "bull";
    suitable = true;
  } else if (momentum >= 3 && aboveE20 && aboveE60 && last.close >= pressure2) {
    stage = "C 段延续";
    positionLabel = "当前更像 C 段后半段 / 延续加速";
    phaseKey = "C";
    progress = 0.97;
    bias = "偏多";
    note = "动量较强且价格站上中期均线，更像 C 段再次上冲后的延续。";
    trendMode = "bull";
    suitable = true;
  } else if (momentum >= 1 && aboveE20 && last.close >= pressure1) {
    stage = "C 段突破确认";
    positionLabel = "当前更像 C 段突破确认 / 已站上确认位";
    phaseKey = "C";
    progress = 0.90 + Math.min(0.04, Math.max(0, normalizedClosePosition - 1) * 0.16);
    bias = "偏多";
    note = "回踩后已经重新站上确认位，当前位置不再只是试探，更接近 C 段确认后的继续上攻。";
    trendMode = "bull";
    suitable = true;
  } else if (aboveE20 && risingIntoConfirm && breakoutAttempt) {
    stage = "C 段上攻 / 冲击前高";
    positionLabel = "当前更像 C 段上攻，正在冲击原 B 高";
    phaseKey = "C";
    progress = 0.82 + Math.min(0.07, Math.max(0, normalizedClosePosition - 0.88) * 0.45);
    bias = "偏多";
    note = "当前位置已经脱离 C 点低位，属于从 C 点向上修复并冲击原 B 高的阶段，重点看能否把冲高变成有效突破。";
    trendMode = "bull";
    suitable = true;
  } else if (aboveE20 && risingIntoConfirm && nearConfirmZone) {
    stage = "C 段回升 / 靠近确认";
    positionLabel = "当前更像 C 段回升，正在靠近确认位";
    phaseKey = "C";
    progress = 0.72 + Math.min(0.08, Math.max(0, normalizedClosePosition - 0.72) * 0.4);
    bias = "偏多";
    note = "最近几根K线持续抬高、价格已靠近确认位，说明已经离开 C 点低位，正在从 C 段回升向确认区推进。";
    trendMode = "bull";
    suitable = true;
  } else if (aboveE20 && recentTrend > 0 && nearCRecoveryZone) {
    stage = "C 段止跌 / 初步回升";
    positionLabel = "当前更像 C 段止跌后回升初期";
    phaseKey = "C";
    progress = 0.64 + Math.min(0.06, Math.max(0, normalizedClosePosition - 0.56) * 0.35);
    bias = "中性";
    note = "当前位置更像从 C 点附近刚开始抬头，先看止跌是否成立，再看能否逐步走向确认位。";
    trendMode = "bull";
    suitable = true;
  } else if (aboveE20 && recentTrend >= 0 && confirmGapRatio <= 0.14) {
    stage = "C 段前确认";
    positionLabel = "当前更像 C 段前确认 / 靠近确认位";
    phaseKey = "C";
    progress = 0.74 + Math.min(0.10, Math.max(0, 0.14 - confirmGapRatio) * 0.5);
    bias = "偏多";
    note = "价格已经靠近确认位，即使还没正式突破，也更像 C 段前确认，而不只是 B→C 过渡。";
    trendMode = "bull";
    suitable = true;
  } else if (momentum >= 1 && aboveE20 && last.close < pressure1) {
    stage = "B→C 过渡";
    positionLabel = "当前更像 B 末段，正在向 C 过渡";
    phaseKey = "BC";
    progress = 0.58 + Math.min(0.12, Math.max(0, normalizedClosePosition - 0.45) * 0.35);
    bias = "偏多";
    note = "回踩后动量开始修复，但还没有完全越过确认位，属于 B 向 C 的过渡。";
    trendMode = "bull";
    suitable = true;
  } else if (momentum <= -3 && !aboveE20) {
    stage = "A 段后回撤";
    positionLabel = "当前更像 A 段后回撤 / 失速";
    phaseKey = "A";
    progress = 0.26;
    bias = "偏空";
    note = "上冲后动量转弱，若失去 E20，容易演化为 A 段后的回撤或失效。";
    trendMode = "bull";
    suitable = true;
  } else if (momentum < 0 && aboveE20 && last.close >= support) {
    stage = "B 段健康回踩";
    positionLabel = "当前更像 B 段回踩中后段";
    phaseKey = "B";
    progress = 0.48;
    bias = "中性";
    note = "价格仍守住中期均线，但动量在消化，常见于 B 段回调或横盘整理。";
    trendMode = "bull";
    suitable = true;
  } else if (!aboveE20 && recentTrend < 0 && last.close >= support) {
    stage = "B 段偏弱整理";
    positionLabel = "当前更像 B 段偏弱整理 / 等待方向确认";
    phaseKey = "B";
    progress = 0.44;
    bias = "中性";
    note = "价格仍在支撑之上，但已经压在中期均线下，更像 B 段整理偏弱。";
    trendMode = "bull";
    suitable = true;
  } else if (!aboveE20 && recentTrend < 0) {
    stage = "A 段失败 / 转弱";
    positionLabel = "当前更像 A 段失败后的转弱区";
    phaseKey = "A";
    progress = 0.18;
    bias = "偏空";
    note = "价格偏离中期均线且最近趋势转弱，更像 A 段后失守，需要防止继续回落。";
    trendMode = "bull";
    suitable = true;
  } else if (aboveE20 && recentTrend > 0 && last.close < pressure1) {
    stage = "B 段止跌 / 等待 C";
    positionLabel = "当前更像 B 段止跌，等待 C 段触发";
    phaseKey = "B";
    progress = 0.56;
    bias = "中性";
    note = "结构还守得住，但还没到强确认；更像 B 段止跌后等待 C 段触发。";
    trendMode = "bull";
    suitable = true;
  } else if (aboveE20 && recentTrend > 0) {
    stage = "C 段试探";
    positionLabel = "当前更像 C 段试探 / 尝试离开低位";
    phaseKey = "C";
    progress = 0.68;
    bias = "偏多";
    note = "价格和趋势都开始向上，但更像刚从 C 段低位抬头，仍需确认回升是否有连续性。";
    trendMode = "bull";
    suitable = true;
  }
  const volume = prevVol > 0 ? (volRatio >= 1.12 ? "放量" : volRatio <= 0.88 ? "缩量" : "平量") : "量能不足";
  if (phaseKey === "unknown" && suitable) {
    phaseKey = stage.startsWith("C") ? "C" : stage.startsWith("B→C") ? "BC" : stage.startsWith("B") ? "B" : stage.startsWith("A") ? "A" : "unknown";
    progress = phaseKey === "A" ? 0.22 : phaseKey === "B" ? 0.48 : phaseKey === "BC" ? 0.64 : phaseKey === "C" ? 0.82 : 0.5;
  }
  if (rule123?.valid) {
    primaryJudgement = "123法则";
    currentStage = rule123.stage;
    nextConfirm = rule123.nextConfirm;
  } else if (suitable) {
    primaryJudgement = "ABC结构";
    currentStage = stage;
    if (trendMode === "bear") {
      nextConfirm = `重点看是否跌破 ${formatPrice(support)} 或重新压回 ${formatPrice(pressure1)} 下方。`;
    } else {
      nextConfirm = `重点看是否收复 / 站稳 ${formatPrice(pressure1)}，并延续向 ${formatPrice(pressure2)} 推进。`;
    }
  }
  return {
    stage,
    phaseKey,
    positionLabel,
    progress,
    bias,
    note,
    suitable,
    trendMode,
    primaryJudgement,
    currentStage,
    nextConfirm,
    rule123,
    summary: suitable
      ? `${primaryJudgement === "123法则" ? `${primaryJudgement}优先，当前阶段为 ${currentStage}` : `当前位置更像 ${stage}（${positionLabel}）`}，整体${rule123?.valid ? rule123.bias : bias}。${rule123?.valid ? rule123.note : note} 动量 ${Number.isFinite(mom10) ? `${mom10.toFixed(2)}%` : "数据不足"}，RSI ${Number.isFinite(rsi14) ? rsi14.toFixed(1) : "数据不足"}，量能${volume}。下一步：${nextConfirm}`
      : `当前结构暂不适合用 123 / 2B / ABC 归类，整体先按${bias}观察。${note} 动量 ${Number.isFinite(mom10) ? `${mom10.toFixed(2)}%` : "数据不足"}，RSI ${Number.isFinite(rsi14) ? rsi14.toFixed(1) : "数据不足"}，量能${volume}。`,
    volume,
    momentum: Number.isFinite(mom10) ? mom10.toFixed(2) : null,
    rsi: Number.isFinite(rsi14) ? rsi14.toFixed(1) : null,
    keyLevels: [
      `A 段突破位 ${formatPrice(pressure2)}`,
      `B 段低点 ${formatPrice(support)}`,
      `C 段确认位 ${formatPrice(pressure1)}`,
    ],
    strength: aboveE20 ? "站上 E20" : "压在 E20 下",
    volumeDetail: prevVol > 0 ? `近5根均量 ${Math.round(recentVol).toLocaleString()} / 前10根均量 ${Math.round(prevVol).toLocaleString()}` : "成交量基准不足",
    abcPoints: trendMode === "bear" && bearAbc?.valid
      ? {
          A: formatPrice(bearAbc.a.high),
          B: formatPrice(bearAbc.b.low),
          C: formatPrice(bearAbc.c.high),
        }
      : trendMode === "bull" && bullAbc?.valid
        ? {
            A: formatPrice(bullAbc.a.low),
            B: formatPrice(bullAbc.b.high),
            C: formatPrice(bullAbc.c.low),
          }
        : null,
    pivots,
  };
}

function abcPositionSvg(abc) {
  if (abc?.primaryJudgement === "123法则" && abc?.rule123?.valid) {
    const isBear123 = abc.rule123.mode === "bear123";
    const step = abc.rule123.step || 1;
    const currentColor = "#ffd166";
    const titleColor = isBear123 ? "#ff7a88" : "#40d98a";
    const pathD = isBear123
      ? "M38 126 C72 74, 94 54, 118 58 S172 94, 204 116 S258 122, 292 98 S338 54, 366 62"
      : "M38 62 C72 116, 98 136, 118 132 S170 92, 204 78 S262 66, 294 92 S338 128, 366 122";
    const guideColor = isBear123 ? "#ff6a6a" : "#5f96ff";
    const guideY = isBear123 ? 58 : 132;
    const point1 = isBear123 ? { x: 118, y: 58, fill: "#ff7a88", label: "前高" } : { x: 118, y: 132, fill: "#ff6a6a", label: "前低" };
    const point2 = isBear123 ? { x: 214, y: 116, fill: "#40d98a", label: "前低" } : { x: 214, y: 78, fill: "#40d98a", label: "前高" };
    const point3 = isBear123 ? { x: 294, y: 92, fill: "#4c8dff", label: "反弹高点" } : { x: 294, y: 92, fill: "#4c8dff", label: "回踩低点" };
    const currentPoint = step === 1
      ? { x: isBear123 ? 174 : 174, y: isBear123 ? 88 : 104 }
      : step === 2
        ? { x: point3.x, y: point3.y }
        : { x: isBear123 ? 348 : 348, y: isBear123 ? 108 : 82 };
    const topLabel = safeHtml(abc.currentStage || abc.stage || "123法则观察");
    const textLine1 = step === 1
      ? (isBear123 ? "上涨节奏首次被破坏" : "下跌节奏首次被破坏")
      : step === 2
        ? (isBear123 ? "反弹不再创新高" : "回踩没有再创新低")
        : (isBear123 ? "再次跌破前低，123 转弱确认" : "再次突破前高，123 转强确认");
    const textLine2 = safeHtml(abc.nextConfirm || "继续观察关键位确认。");
    const noteBox = step === 3
      ? { x: 204, y: isBear123 ? 24 : 126, w: 150, h: 42 }
      : { x: 184, y: isBear123 ? 22 : 124, w: 162, h: 42 };
    return `<div class="abc-stage"><svg class="abc-stage-svg" viewBox="0 0 420 196" role="img" aria-label="123法则位置示意图"><defs><marker id="oneTwoThreeArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="${currentColor}"/></marker></defs><rect x="8" y="8" width="404" height="180" rx="14" fill="#0b1227" stroke="rgba(255,255,255,.06)"/><rect x="16" y="16" width="388" height="24" rx="12" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)"/><text x="28" y="32" fill="${titleColor}" font-size="12" font-weight="800">${topLabel}</text><line x1="28" y1="164" x2="388" y2="164" stroke="rgba(255,255,255,.18)" stroke-width="2"/><line x1="28" y1="${guideY}" x2="${step === 3 ? 360 : 300}" y2="${guideY}" stroke="${guideColor}" stroke-width="1.4" stroke-dasharray="6 6" opacity=".92"/><path d="${pathD}" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="3"/><circle cx="${point1.x}" cy="${point1.y}" r="8" fill="${point1.fill}"/><circle cx="${point2.x}" cy="${point2.y}" r="8" fill="${point2.fill}"/><circle cx="${point3.x}" cy="${point3.y}" r="8" fill="${point3.fill}"/><path d="M${currentPoint.x - 22} ${currentPoint.y} C${currentPoint.x - 10} ${currentPoint.y}, ${currentPoint.x - 6} ${currentPoint.y}, ${currentPoint.x + 16} ${currentPoint.y}" fill="none" stroke="${currentColor}" stroke-width="3" stroke-dasharray="8 5" marker-end="url(#oneTwoThreeArrow)"/><circle cx="${currentPoint.x}" cy="${currentPoint.y}" r="7" fill="${currentColor}" stroke="#fff3d1" stroke-width="2"/><text x="${point1.x - 16}" y="182" fill="${point1.fill}" font-size="12" font-weight="900">1</text><text x="${point2.x - 16}" y="182" fill="${point2.fill}" font-size="12" font-weight="900">2</text><text x="${point3.x - 16}" y="182" fill="${point3.fill}" font-size="12" font-weight="900">3</text><rect x="${noteBox.x}" y="${noteBox.y}" width="${noteBox.w}" height="${noteBox.h}" rx="11" fill="rgba(34,27,9,.92)" stroke="${currentColor}" stroke-width="1.4"/><text x="${noteBox.x + 10}" y="${noteBox.y + 16}" fill="${currentColor}" font-size="11" font-weight="800">当前位置：</text><text x="${noteBox.x + 10}" y="${noteBox.y + 30}" fill="#fff4d6" font-size="11" font-weight="700">${safeHtml(textLine1)}</text><text x="${noteBox.x + 10}" y="${noteBox.y + 44}" fill="#dbe5ff" font-size="10">${textLine2}</text></svg><div class="abc-stage-note"><span class="abc-stage-chip">${safeHtml(abc.primaryJudgement)}</span>${directionMarkup(abc.rule123.bias || abc.bias)}<span class="abc-stage-chip abc-stage-chip-soft">${safeHtml(abc.currentStage || abc.stage)}</span></div></div>`;
  }
  if (!abc?.suitable) {
    return `<div class="abc-stage"><svg class="abc-stage-svg" viewBox="0 0 520 170" role="img" aria-label="ABC结构暂不适合判断"><rect x="8" y="8" width="504" height="154" rx="14" fill="#0b1227" stroke="rgba(255,255,255,.06)"/><rect x="16" y="16" width="488" height="24" rx="12" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)"/><text x="28" y="32" fill="#d7e3ff" font-size="12" font-weight="800">ABC 结构暂不适合判断</text><rect x="34" y="54" width="452" height="82" rx="14" fill="rgba(255,255,255,.025)" stroke="rgba(255,209,102,.24)" stroke-dasharray="6 6"/><text x="52" y="82" fill="#ffd166" font-size="12" font-weight="800">当前先不要强行定位 A / B / C</text><text x="52" y="104" fill="#dbe5ff" font-size="11">最近价格与动量节奏不够清晰，既不像完整的上涨 ABC，</text><text x="52" y="122" fill="#dbe5ff" font-size="11">也不像明确的下跌 ABC，先等关键位或下一段走势确认。</text></svg></div>`;
  }
  const phase = abc.phaseKey || "unknown";
  const trendMode = abc.trendMode || "bull";
  const isBear = trendMode === "bear";
  const active = phase === "BC" ? "B" : phase === "fail" ? "B" : phase === "A_DOWN" ? "A" : phase === "B_REBOUND" ? "B" : phase === "C_DOWN" ? "C" : phase;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const palette = {
    A: "#ff7a88",
    B: "#40d98a",
    C: "#4c8dff",
    fail: "#ff7a88",
    unknown: "#9fb0d8",
  };
  const currentColor = "#ffd166";
  const semanticColor = palette[phase] || palette[active] || palette.unknown;
  const titleColor = phase === "fail" || isBear ? "#ff7a88" : active === "A" ? "#ff7a88" : "#40d98a";
  const progress = Number.isFinite(abc.progress) ? Math.max(0, Math.min(1, abc.progress)) : 0.5;
  const curve = isBear
    ? [
        { x: 34, y: 58 },
        { x: 104, y: 154 },
        { x: 214, y: 84 },
        { x: 336, y: 162 },
        { x: 474, y: 126 },
      ]
    : [
        { x: 34, y: 118 },
        { x: 104, y: 154 },
        { x: 214, y: 54 },
        { x: 336, y: 150 },
        { x: 474, y: 34 },
      ];
  const segmentForProgress = (value) => {
    if (isBear) {
      if (value <= 0.30) return [curve[0], curve[1], value / 0.30];
      if (value <= 0.58) return [curve[1], curve[2], (value - 0.30) / 0.28];
      if (value <= 0.88) return [curve[2], curve[3], (value - 0.58) / 0.30];
      return [curve[3], curve[4], (value - 0.88) / 0.12];
    }
    if (value <= 0.18) return [curve[0], curve[1], value / 0.18];
    if (value <= 0.48) return [curve[1], curve[2], (value - 0.18) / 0.30];
    if (value <= 0.76) return [curve[2], curve[3], (value - 0.48) / 0.28];
    return [curve[3], curve[4], (value - 0.76) / 0.24];
  };
  const [from, to, localT] = segmentForProgress(progress);
  const markerX = from.x + (to.x - from.x) * localT;
  const markerY = from.y + (to.y - from.y) * localT;
  const rawTopLabel = abc.positionLabel || abc.stage || "当前位置待确认";
  const simplifiedTopLabel = rawTopLabel.includes("/")
    ? rawTopLabel.split("/").pop().trim()
    : rawTopLabel.replace(/^当前更像\s*/, "").trim();
  const topLabel = safeHtml(simplifiedTopLabel || "当前位置待确认");
  const stageTextMap = {
    "结构失败": ["当前位置：", "ABC 结构失效，先按破位/转弱处理。"],
    "A 段下跌启动": ["当前位置：", "下跌 A 段正在展开，先看反抽是否无力。"],
    "B 段反抽": ["当前位置：", "下跌后的 B 段反抽，重点看是否受阻。"],
    "C 段再下压": ["当前位置：", "反抽后进入 C 段下压，关注前低是否失守。"],
    "C 段临近破前低": ["当前位置：", "已逼近前低，下一步重点看是否向下破位。"],
    "C 段跌破延续": ["当前位置：", "前低已失守，更像 C 段破位延续。"],
    "A 段后回撤": ["当前位置：", "A→B 上升段失速，先看是否继续回撤。"],
    "A 段失败 / 转弱": ["当前位置：", "A 段失败后转弱，先防继续下探。"],
    "B 段健康回踩": ["当前位置：", "B→C 回踩中，先看止跌，再看是否转强。"],
    "B 段偏弱整理": ["当前位置：", "B 段偏弱整理，等待方向进一步明确。"],
    "B 段止跌 / 等待 C": ["当前位置：", "B 段止跌后横住，等 C 段触发。"],
    "B→C 过渡": ["当前位置：", "B 末段向 C 过渡，修复刚刚开始。"],
    "C 段试探": ["当前位置：", "刚从 C 点附近抬头，先看回升是否连续。"],
    "C 段止跌 / 初步回升": ["当前位置：", "C 点附近止跌回升，先看能否继续抬高。"],
    "C 段回升 / 靠近确认": ["当前位置：", "已离开 C 点低位，正在靠近确认区。"],
    "C 段上攻 / 冲击前高": ["当前位置：", "已从 C 点回升，正在冲击原 B 高。"],
    "C 段突破确认": ["当前位置：", "已站上确认位，重点看突破能否延续。"],
    "C 段延续": ["当前位置：", "已越过确认区，处于 C 段延续上攻。"],
  };
  const currentText = stageTextMap[abc.stage]
    || (phase === "fail"
      ? ["当前位置：", "ABC 结构失效，先按破位/转弱处理。"]
      : isBear
        ? active === "A"
          ? ["当前位置：", "下跌 A 段正在展开，先看反抽是否出现。"]
          : active === "B"
            ? ["当前位置：", "下跌后的 B 段反抽中，重点看是否重新受阻。"]
            : ["当前位置：", "当前更像下跌 C 段，重点看前低是否会被跌穿。"]
      : active === "A"
        ? ["当前位置：", "A→B 上升段，重点看能否继续抬高。"]
        : active === "B"
          ? ["当前位置：", "B→C 回踩中，先看止跌，再看是否转强。"]
          : progress >= 0.82
            ? ["当前位置：", "已从 C 点回升，正在冲击原 B 高 / 确认位。"]
            : ["当前位置：", "接近 C 确认区，重点看是否突破并延续。"]);
  const noteBoxBase = { w: active === "A" ? 208 : 206, h: active === "A" ? 56 : 60, stroke: currentColor, fill: "rgba(255,209,102,.10)" };
  let noteX = markerX + 16;
  let noteY = markerY - noteBoxBase.h / 2;
  if (active === "A") {
    noteX = markerX + 20;
    noteY = markerY - 18;
  } else if (active === "B" || phase === "fail") {
    noteX = markerX + 24;
    noteY = markerY + 22;
  } else if (isBear) {
    noteX = markerX - noteBoxBase.w - 18;
    noteY = markerY - noteBoxBase.h - 6;
  } else {
    noteX = markerX + 20;
    noteY = markerY - noteBoxBase.h + 10;
  }
  const noteBox = {
    ...noteBoxBase,
    x: clamp(noteX, 28, 504 - noteBoxBase.w - 12),
    y: clamp(noteY, 48, 216 - noteBoxBase.h - 10),
  };
  const pointFillA = "#ff5d73";
  const pointFillB = "#40d98a";
  const pointFillC = "#4c8dff";
  const pathD = isBear
    ? "M34 58 C66 108, 84 164, 104 154 S184 88, 214 84 S306 176, 336 162 S432 124, 474 126"
    : "M34 118 C66 168, 84 170, 104 154 S184 74, 214 54 S306 132, 336 150 S432 76, 474 34";
  const lowGuideY = isBear ? 154 : 154;
  const highGuideY = isBear ? 84 : 54;
  const highGuideX2 = isBear ? 214 : 214;
  return `<div class="abc-stage"><svg class="abc-stage-svg" viewBox="0 0 520 232" role="img" aria-label="ABC和2B结构位置示意图"><defs><filter id="abcGlow2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><marker id="abcArrowHead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${currentColor}"/></marker></defs><rect x="8" y="8" width="504" height="216" rx="14" fill="#0b1227" stroke="rgba(255,255,255,.06)"/><rect x="16" y="16" width="488" height="24" rx="12" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)"/><text x="28" y="32" fill="${titleColor}" font-size="12" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif" font-weight="800">${topLabel}</text><line x1="28" y1="176" x2="492" y2="176" stroke="rgba(255,255,255,.18)" stroke-width="2"/><line x1="28" y1="176" x2="28" y2="44" stroke="rgba(255,255,255,.18)" stroke-width="2"/><path d="${pathD}" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="3"/><line x1="28" y1="${lowGuideY}" x2="336" y2="${lowGuideY}" stroke="#ff6a6a" stroke-width="1.4" stroke-dasharray="6 6" opacity=".9"/><line x1="28" y1="${highGuideY}" x2="${highGuideX2}" y2="${highGuideY}" stroke="#5f96ff" stroke-width="1.4" stroke-dasharray="6 6" opacity=".9"/><circle cx="104" cy="${isBear ? 154 : 154}" r="8" fill="${pointFillA}"/><circle cx="214" cy="${isBear ? 84 : 54}" r="8" fill="${pointFillB}"/><circle cx="336" cy="${isBear ? 162 : 150}" r="8" fill="${pointFillC}"/><text x="98" y="188" fill="#ff7a88" font-size="14" font-weight="900">A 段</text><text x="204" y="188" fill="#40d98a" font-size="14" font-weight="900">B 段</text><text x="326" y="188" fill="#4c8dff" font-size="14" font-weight="900">C 段</text><path d="M${markerX - 26} ${markerY} C${markerX - 12} ${markerY}, ${markerX - 8} ${markerY}, ${markerX + 18} ${markerY}" fill="none" stroke="${currentColor}" stroke-width="4" stroke-dasharray="8 6" filter="url(#abcGlow2)" marker-end="url(#abcArrowHead)"/><circle cx="${markerX}" cy="${markerY}" r="7" fill="${currentColor}" stroke="#fff3d1" stroke-width="2"/><rect x="${noteBox.x}" y="${noteBox.y}" width="${noteBox.w}" height="${noteBox.h}" rx="12" fill="${noteBox.fill}" stroke="${noteBox.stroke}" stroke-width="1.6"/><text x="${noteBox.x + 12}" y="${noteBox.y + 21}" fill="${noteBox.stroke}" font-size="11" font-weight="800">${safeHtml(currentText[0])}</text><text x="${noteBox.x + 12}" y="${noteBox.y + 40}" fill="#fff4d6" font-size="11" font-weight="700">${safeHtml(currentText[1])}</text><text x="448" y="28" fill="rgba(255,255,255,.45)" font-size="11">价格</text><text x="466" y="208" fill="rgba(255,255,255,.45)" font-size="11">时间</text></svg><div class="abc-stage-note"><span class="abc-stage-chip">${safeHtml(abc.stage)}</span>${directionMarkup(abc.bias)}<span class="abc-stage-chip abc-stage-chip-soft">${safeHtml(abc.positionLabel || "当前位置待确认")}</span></div></div>`;
}

function buildAnalysisAngles({ bars, cards, last, support, pressure1, pressure2, e20, e60, mom10, rsi14, historicalTrendStats }) {
  const top = cards[0];
  const trendPaths = futureTrendPaths({ cards, last, support, pressure1, pressure2, e20, e60, mom10, rsi14, historicalTrendStats });
  const abc = summarizeAbcMomentum({ bars, last, support, pressure1, pressure2, e20, e60, mom10, rsi14 });
  const similarity = top
    ? {
        title: top.name,
        score: top.score,
        matchBars: top.matchBars,
        bias: top.bias,
        judgement: top.judgement,
        detail: `规则 / 图形分：${top.ruleScore}% / ${top.shapeScore}%`,
        note: "这是“像不像”的判断，主要回答当前末尾K线是否接近某个经典轮廓。",
      }
    : {
        title: `暂无超过${MIN_PATTERN_SCORE}%的高可信形态`,
        score: null,
        matchBars: 0,
        bias: "中性",
        judgement: "不强行套形态",
        detail: "规则分或图形分未同时达标。",
        note: "系统仍会继续看价格图和后续确认，而不会硬套经典轮廓。",
      };
  const trend = historicalTrendStats && !historicalTrendStats.insufficient && historicalTrendStats.valid >= 8
    ? {
        available: true,
        source: `历史样本 ${historicalTrendStats.valid}，回看后 ${historicalTrendStats.horizon} 根K线`,
        rows: [
          ["偏多", `${historicalTrendStats.bullProbability}%`, "历史相似样本后向上超过阈值"],
          ["偏空", `${historicalTrendStats.bearProbability}%`, "历史相似样本后向下超过阈值"],
          ["震荡", `${historicalTrendStats.flatProbability}%`, "历史相似样本后未走出明显方向"],
        ],
        note: "这部分就是 9 测试模式里的历史样本统计，直接回答“过去类似后通常怎么走”。",
      }
    : {
        available: false,
        source: "请使用 9 测试模式生成历史样本统计",
        rows: [
          ["偏多", "--", "样本不足"],
          ["偏空", "--", "样本不足"],
          ["震荡", "--", "样本不足"],
        ],
        note: "当前没有足够的 9 测试模式历史样本，暂时只能看当前结构与动量。",
      };
  return { similarity, trend, abc, trendPaths };
}

function summarizeTwoB({ bars, last, support, pressure1, e20, mom10, rsi14 }) {
  const n = bars.length;
  const prev = bars.slice(Math.max(0, n - 9), Math.max(0, n - 4));
  const recent = bars.slice(Math.max(0, n - 4));
  const prevLow = prev.length ? Math.min(...prev.map((x) => x.low)) : null;
  const prevHigh = prev.length ? Math.max(...prev.map((x) => x.high)) : null;
  const recentLow = recent.reduce((best, bar, index) => (best == null || bar.low < best.bar.low ? { bar, index } : best), null);
  const recentHigh = recent.reduce((best, bar, index) => (best == null || bar.high > best.bar.high ? { bar, index } : best), null);
  const fakeBreakLow = prevLow != null && recentLow && recentLow.bar.low < prevLow * 0.998;
  const fakeBreakHigh = prevHigh != null && recentHigh && recentHigh.bar.high > prevHigh * 1.002;
  const reclaimedLow = prevLow != null && last.close > prevLow && last.close > (recentLow?.bar.close ?? -Infinity);
  const rejectedHigh = prevHigh != null && last.close < prevHigh && last.close < (recentHigh?.bar.close ?? Infinity);
  const lowBreakThenRecover = Boolean(
    fakeBreakLow &&
      recentLow &&
      recentLow.index < recent.length - 1 &&
      reclaimedLow &&
      last.low > recentLow.bar.low &&
      (last.close >= last.open || last.close >= support)
  );
  const highBreakThenFail = Boolean(
    fakeBreakHigh &&
      recentHigh &&
      recentHigh.index < recent.length - 1 &&
      rejectedHigh &&
      last.high < recentHigh.bar.high &&
      (last.close <= last.open || last.close < pressure1)
  );
  let stage = "2B未成立";
  let bias = "中性";
  let note = "最近末尾K线没有形成标准的前低/前高假突破后快速收回结构，暂不按 2B 强行归类。";
  let valid = false;
  if (lowBreakThenRecover) {
    stage = "底部2B确认";
    bias = "偏多";
    note = "先跌破前低、随后重新收回，符合底部2B 的核心特征，后续更关注是否继续站稳。";
    valid = true;
  } else if (highBreakThenFail) {
    stage = "顶部2B观察";
    bias = "偏空";
    note = "上方尝试突破后又回到确认位下方，更像顶部2B 的反复确认过程，需防止再次转弱。";
    valid = true;
  }
  return {
    stage,
    bias,
    note,
    valid,
    summary: valid
      ? `当前位置更像 ${stage}，整体${bias}。${note} 重点看 ${formatPrice(support)} 的支撑与 ${formatPrice(pressure1)} 的确认。`
      : `当前末尾结构不符合标准 2B 形态，整体先按${bias}观察。${note}`,
    detail: `动量 ${Number.isFinite(mom10) ? `${mom10.toFixed(2)}%` : "数据不足"}，RSI ${Number.isFinite(rsi14) ? rsi14.toFixed(1) : "数据不足"}，E20 ${formatPrice(e20)}。`,
    keyLevels: {
      support,
      confirm: pressure1,
      e20,
    },
    recentBars: recent.length ? recent : bars.slice(-3),
  };
}

function twoBPositionSvg(twoB) {
  if (!twoB?.valid) {
    return `<div class="abc-stage"><svg class="abc-stage-svg" viewBox="0 0 380 138" role="img" aria-label="2B结构未成立"><rect x="8" y="8" width="364" height="122" rx="14" fill="#0b1227" stroke="rgba(255,255,255,.06)"/><rect x="18" y="16" width="344" height="22" rx="11" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)"/><text x="28" y="30" fill="#d7e3ff" font-size="10.5" font-weight="800">2B 结构未成立</text><rect x="34" y="46" width="312" height="68" rx="12" fill="rgba(255,255,255,.025)" stroke="rgba(255,209,102,.24)" stroke-dasharray="6 6"/><text x="48" y="68" fill="#ffd166" font-size="10.5" font-weight="800">当前先不强画 2B 位置图</text><text x="48" y="88" fill="#dbe5ff" font-size="9.2">最近几根K线未形成标准的假突破 / 假跌破后快速回收结构。</text><text x="48" y="104" fill="#9fb0d8" font-size="8.8">先结合 ABC 位置与历史趋势继续观察会更稳妥。</text></svg></div>`;
  }
  const state = /顶部/.test(twoB.stage) ? "top" : /底部/.test(twoB.stage) ? "bottom" : "neutral";
  const currentColor = "#ffd166";
  const leftColor = state === "top" ? "#ff7a88" : state === "bottom" ? "#ff6a6a" : "#ff7a88";
  const rightColor = state === "top" ? "#4c8dff" : state === "bottom" ? "#40d98a" : "#79a8ff";
  const baseY = 122;
  const topY = 48;
  const lowY = 164;
  const curvePath = state === "bottom"
    ? "M42 94 C78 132, 96 138, 114 122 S158 82, 188 82 S240 168, 274 138 S316 90, 340 84"
    : state === "top"
      ? "M42 126 C76 88, 98 82, 116 94 S158 138, 188 138 S242 54, 276 84 S318 126, 340 132"
      : "M42 108 C76 94, 102 90, 126 104 S174 126, 208 118 S268 92, 340 98";
  const fakeBreakX = state === "top" ? 260 : state === "bottom" ? 260 : 190;
  const fakeBreakY = state === "top" ? 84 : state === "bottom" ? 138 : 108;
  const confirmX = state === "top" ? 320 : state === "bottom" ? 322 : 300;
  const confirmY = state === "top" ? 132 : state === "bottom" ? 84 : 98;
  const guideY = state === "top" ? 94 : 122;
  const labelLeft = state === "top" ? "前高 / 假突破" : "前低 / 假跌破";
  const labelRight = state === "top" ? "确认 / 回落" : "确认 / 回收";
  const noteBox = state === "top"
    ? { x: 198, y: 28, w: 136, h: 40 }
    : state === "bottom"
      ? { x: 196, y: 150, w: 136, h: 40 }
      : { x: 188, y: 32, w: 144, h: 40 };
  const noteText = state === "top"
    ? "上破前高后回落"
    : state === "bottom"
      ? "跌破前低后收回"
      : "等待真假突破确认";
  return `<div class="abc-stage"><svg class="abc-stage-svg" viewBox="0 0 380 206" role="img" aria-label="2B结构位置图"><defs><filter id="twoBGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><marker id="twoBArrow" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="${currentColor}"/></marker></defs><rect x="8" y="8" width="364" height="190" rx="14" fill="#0b1227" stroke="rgba(255,255,255,.06)"/><rect x="18" y="16" width="344" height="24" rx="12" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)"/><text x="28" y="32" fill="#d7e3ff" font-size="12" font-weight="800">${safeHtml(twoB.stage)}</text><line x1="28" y1="${baseY}" x2="350" y2="${baseY}" stroke="rgba(255,255,255,.16)" stroke-width="2"/><line x1="28" y1="${guideY}" x2="${state === "top" ? 274 : 116}" y2="${guideY}" stroke="${state === "top" ? "#79a8ff" : "#ff6a6a"}" stroke-width="1.4" stroke-dasharray="6 6" opacity=".92"/><path d="${curvePath}" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="3"/><circle cx="116" cy="${guideY}" r="8" fill="${leftColor}"/><circle cx="${fakeBreakX}" cy="${fakeBreakY}" r="8" fill="${currentColor}" stroke="#fff3d1" stroke-width="2"/><circle cx="${confirmX}" cy="${confirmY}" r="8" fill="${rightColor}"/><path d="M${fakeBreakX + 14} ${fakeBreakY} C${fakeBreakX + 34} ${fakeBreakY}, ${confirmX - 22} ${confirmY}, ${confirmX - 8} ${confirmY}" fill="none" stroke="${currentColor}" stroke-width="2.2" stroke-dasharray="7 5" filter="url(#twoBGlow)" marker-end="url(#twoBArrow)"/><rect x="${noteBox.x}" y="${noteBox.y}" width="${noteBox.w}" height="${noteBox.h}" rx="11" fill="rgba(34,27,9,.92)" stroke="${currentColor}" stroke-width="1.4"/><text x="${noteBox.x + 10}" y="${noteBox.y + 16}" fill="${currentColor}" font-size="11" font-weight="800">如果当前在这里：</text><text x="${noteBox.x + 10}" y="${noteBox.y + 31}" fill="#fff4d6" font-size="11" font-weight="700">${safeHtml(noteText)}</text><text x="40" y="188" fill="${leftColor}" font-size="13" font-weight="900">${safeHtml(labelLeft)}</text><text x="258" y="196" fill="${rightColor}" font-size="13" font-weight="900">${safeHtml(labelRight)}</text></svg><div class="abc-stage-note"><span class="abc-stage-chip">${safeHtml(twoB.stage)}</span>${directionMarkup(twoB.bias)}<span class="abc-stage-chip abc-stage-chip-soft">${safeHtml(twoB.note)}</span></div></div>`;
}

function abcStructureSectionHtml({ abc, twoB, bars }) {
  const twoBMeta = twoB?.valid
    ? `<div class="structure-meta"><span class="structure-chip">${safeHtml(twoB.stage)}</span><span class="structure-chip structure-chip-soft">${safeHtml(twoB.detail)}</span></div>`
    : `<div class="structure-meta"><span class="structure-chip">${safeHtml(twoB.stage)}</span><span class="structure-chip structure-chip-soft">不满足 2B 关键特征，暂不强画</span></div>`;
  return `<section class="section structure-section"><h2>ABC 和 2B 结构，AI判断位置</h2><p>这一节不再只看“像不像”，而是把 <span class="trend-title-accent">2B 反转结构</span>、<span class="trend-title-accent">123 法则</span> 和 <span class="trend-title-accent">ABC 动量结构</span> 放在一起，按文档顺序判断当前更像假突破 / 假跌破、123 转势确认、上涨 ABC，还是下跌 ABC。</p><div class="structure-grid"><article class="structure-card"><h3>ABC / 123 主判断</h3><p class="structure-lead">${safeHtml(abc.summary)}</p><div class="structure-meta"><span class="structure-chip">${safeHtml(abc.primaryJudgement || "ABC结构")}</span><span class="structure-chip">${safeHtml(abc.currentStage || abc.stage)}</span><span class="structure-chip structure-chip-gold">${safeHtml(abc.positionLabel || "当前位置待确认")}</span><span class="structure-chip structure-chip-soft">${safeHtml(abc.nextConfirm || "等待关键位确认")}</span></div><div class="structure-meta"><span class="structure-chip structure-chip-soft">${safeHtml(abc.volumeDetail)}</span><span class="structure-chip structure-chip-soft">${safeHtml(abc.strength)}</span></div>${abcPositionSvg(abc)}</article><article class="structure-card"><h3>2B 结构判断</h3><p class="structure-lead">${safeHtml(twoB.summary)}</p>${twoBMeta}${twoBPositionSvg(twoB)}</article></div></section>`;
}

function aiInterpretationSectionHtml({ angles, gptHtml, twoB }) {
  const trendTopRow = Array.isArray(angles.trend?.rows) ? angles.trend.rows[0] : null;
  const useTwoBAsPrimary = Boolean(twoB?.valid);
  const structureBias = useTwoBAsPrimary ? (twoB?.bias || angles.abc?.bias || "中性") : (angles.abc?.bias || twoB?.bias || "中性");
  const structureStage = useTwoBAsPrimary ? (twoB?.stage || angles.abc?.currentStage || angles.abc?.stage || "结构待确认") : (angles.abc?.currentStage || angles.abc?.stage || twoB?.stage || "结构待确认");
  const structureJudge = useTwoBAsPrimary ? "2B法则" : (angles.abc?.primaryJudgement || "ABC结构");
  const structureNote = useTwoBAsPrimary ? (twoB?.note || angles.abc?.summary || "") : (angles.abc?.note || angles.abc?.summary || twoB?.note || "");
  const summaryItems = [
    angles.similarity.score
      ? `K线形态匹配：${angles.similarity.title}，${angles.similarity.score}% ，${angles.similarity.bias}`
      : `K线形态匹配：暂无超过${MIN_PATTERN_SCORE}%的高可信形态，按中性处理`,
    angles.trend.available && trendTopRow
      ? `历史趋势拟合：${trendTopRow[0]}，概率 ${trendTopRow[1]}`
      : "历史趋势拟合：样本不足，暂不单独定方向",
    `${structureJudge}：${structureBias}，${structureStage}`,
  ];
  const aiFlat = flattenAiSection(gptHtml || "");
  const mergedThesisParts = [
    safeHtml(summaryItems.join('；')),
    safeHtml(angles.abc.positionLabel || angles.abc.summary),
    safeHtml(structureNote),
    aiFlat.thesis,
  ].filter(Boolean);
  const sourceSummaryHtml = `<div class="ai-source-summary" style="margin:0 0 12px;padding:12px 16px;border:1px solid rgba(130,160,255,.18);border-radius:12px;background:rgba(18,26,51,.55)"><ol style="margin:0;padding-left:18px;display:grid;gap:6px">${summaryItems.map((item) => `<li>${safeHtml(item)}</li>`).join("")}</ol></div>`;
  const abcNote = `<div class="ai-thesis"><strong>核心判断：</strong>${mergedThesisParts.join('。')}。</div>`;
  const aiBody = aiFlat.body ? `<div class="ai-body">${aiFlat.body}</div>` : "";
  return `<section class="section ai-brief"><h2>AI 解读</h2>${sourceSummaryHtml}${abcNote}${aiBody}</section>`;
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
  const mom10 = momentum(closes);
  const twoB = summarizeTwoB({ bars, last, support, pressure1, e20, mom10, rsi14 });
  const analysisAngles = buildAnalysisAngles({ bars, cards, last, support, pressure1, pressure2, e20, e60, mom10, rsi14, historicalTrendStats: options.historicalTrendStats });
  const recent = bars.slice(-14);
  const intervalText = intervalLabel(interval);
  const maxMatchBars = options.maxMatchBars || 10;
  const title = `${displaySymbol}｜${intervalText} 1-${safeHtml(maxMatchBars)}根K线形态匹配`;
  const structureSpan = Math.max(Math.abs(pressure1 - support), Math.max(Math.abs(last.close), 1) * 0.01);
  const recentVol = avgVolume(bars, Math.max(0, bars.length - 5), bars.length - 1);
  const prevVol = avgVolume(bars, Math.max(0, bars.length - 15), Math.max(0, bars.length - 6));
  const volRatio = prevVol > 0 ? recentVol / prevVol : NaN;
  const volumeState = volumeStateFromRatio(volRatio);
  const volumeStatus = /放量/.test(volumeState)
    ? (mom10 >= 0 ? "偏多修复" : "偏空风险")
    : /缩量/.test(volumeState)
      ? "中性观察"
      : statusFromPriceVsAverage(last.close, e20);
  const positionStatus = last.close < support
    ? "偏空风险"
    : last.close >= pressure1
      ? "偏多修复"
      : Math.abs(last.close - pressure1) <= Math.max(structureSpan || 0, Math.abs(last.close) * 0.01) * 0.12
        ? "偏多修复"
        : "中性观察";
  const maStatus = Number.isFinite(e20) && Number.isFinite(e60)
    ? (last.close >= e20 && last.close >= e60
        ? "偏多修复"
        : last.close < e20 && last.close < e60
          ? "偏空风险"
          : "中性观察")
    : statusFromPriceVsAverage(last.close, e20);
  const top5Rows = cards
    .map((c) => `<tr><td>${safeHtml(c.name)}</td><td>${safeHtml(c.matchBars)}根</td><td class="price">${c.score}%</td><td>${directionMarkup(c.bias)}</td><td>${safeHtml(c.judgement)}</td></tr>`)
    .join("");
  const noMatchHtml = `<div class="no-match"><strong>暂无超过${MIN_PATTERN_SCORE}%的经典形态匹配。</strong><p>系统只检测最新末尾K线，且要求规则分和图形DTW相似度同时达标。当前结构可能有反弹或回落片段，但没有达到高可信经典形态阈值，因此不强行套形态；请优先看价格图中的确认位、失败位和下一根K线。</p></div>`;
  const topMatchHtml = `<div class="top-match"><h2>K线形态AI匹配（相识度超过${MIN_PATTERN_SCORE}%的）</h2>${cards.length ? `<table><thead><tr><th>形态</th><th>匹配条数</th><th>匹配度</th><th>方向</th><th>状态</th></tr></thead><tbody>${top5Rows}</tbody></table>` : noMatchHtml}</div>`;
  const cardHtml = cards
    .map(
      (c, idx) => `<article class="card"><div class="head"><div><h2>匹配 ${idx + 1} · ${safeHtml(c.name)} · ${directionMarkup(c.bias)} · ${safeHtml(c.judgement)}</h2><p>匹配区间（市场时间）：${safeHtml(c.range)}；匹配K线：${safeHtml(c.matchBars)}根；规则分/图形分：${safeHtml(c.ruleScore)}% / ${safeHtml(c.shapeScore)}%</p></div><div class="score">${c.score}%<span>${safeHtml(c.matchBars)}根K线匹配度</span></div></div><div class="visual-box"><div class="compare"><div class="panel chart-panel"><h3>原始K线高亮</h3>${miniHighlightChartSvg(bars, c)}</div><div class="panel chart-panel"><h3>规则库标准轮廓</h3>${patternSketchSvg(c)}</div></div></div><div class="detail-box"><p>${safeHtml(c.why)}</p><table><tr><th>确认/失败位</th><td><span class="price">${safeHtml(c.confirm)}</span> / <span class="price">${safeHtml(c.failure)}</span></td></tr></table></div></article>`
    )
    .join("");
  const matrix = [
    ["形态", cards[0]?.bias === "偏多" ? "偏多修复" : cards[0]?.bias === "偏空" ? "偏空风险" : "中性观察", cards[0] ? `最高匹配为「${cards[0].name}」，匹配度 ${cards[0].score}%。` : `暂无超过${MIN_PATTERN_SCORE}%的经典形态匹配，不强行归类。`],
    ["位置", positionStatus, last.close < support ? `最新价已跌破近期支撑 ${formatPrice(support)}，原结构需要降级处理。` : last.close >= pressure1 ? `最新价已接近或站上确认位 ${formatPrice(pressure1)}，重点看能否延续。` : `最新价 ${formatPrice(last.close)} 位于支撑 ${formatPrice(support)} 与确认位 ${formatPrice(pressure1)} 之间，仍需等待确认。`],
    ["均线", maStatus, !Number.isFinite(e20) || !Number.isFinite(e60) ? "均线数据不足。" : last.close >= e20 && last.close >= e60 ? `最新价 ${formatPrice(last.close)} 站上 E20 ${formatPrice(e20)} 与 E60 ${formatPrice(e60)}，均线结构偏强。` : last.close < e20 && last.close < e60 ? `最新价 ${formatPrice(last.close)} 位于 E20 ${formatPrice(e20)} 与 E60 ${formatPrice(e60)} 下方，均线结构偏弱。` : `最新价 ${formatPrice(last.close)} 位于 E20 ${formatPrice(e20)} 与 E60 ${formatPrice(e60)} 附近，均线方向仍在拉锯。`],
    ["RSI", (rsi14 || 50) < 45 ? "偏空风险" : "中性观察", rsi14 == null ? "RSI数据不足。" : `RSI14=${rsi14.toFixed(1)}，只作为强弱辅助，不单独决定方向。`],
    ["随机指数", "中性观察", "随机指数只做保留，不作为主判断。"],
    ["动力", (mom10 || 0) < 0 ? "偏空风险" : "偏多修复", mom10 == null ? "动力数据不足。" : `10根动量=${mom10.toFixed(2)}%，看反弹是否能持续。`],
    ["成交量", volumeStatus, !Number.isFinite(volRatio) ? "成交量基准不足。" : `近5根均量 ${Math.round(recentVol).toLocaleString()} / 前10根均量 ${Math.round(prevVol).toLocaleString()}，当前属于${volumeState}。`],
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
  const chartHtml = candleChartSvg(bars, cards, {
    failure: support,
    latest: last.close,
    confirm: pressure1,
    pressure: pressure2,
    e20,
    trendPaths: analysisAngles.trendPaths,
    historicalTrendStats: options.historicalTrendStats,
  });
  const trendStats = options.historicalTrendStats;
  const trendStatsHtml = trendStats
    ? `<span class="chip">历史样本 ${safeHtml(trendStats.valid ?? 0)}</span><span class="chip">后 ${safeHtml(trendStats.horizon ?? 5)} 根K线</span>`
    : "";
  const recentTableHtml = `<div class="table-scroll"><table><thead><tr><th>时间</th><th>开盘</th><th>最高</th><th>最低</th><th>收盘</th><th>涨跌幅</th><th>成交量</th></tr></thead><tbody>${candleTable(recent)}</tbody></table></div>`;
  const cardsSectionHtml = cards.length
    ? `<details class="fold" open><summary>K线匹配详细情况</summary>${cardHtml}</details>`
    : "";
  const signalMatrixHtml = `<div class="table-scroll"><table><thead><tr><th>模块</th><th>方向</th><th>怎么理解</th></tr></thead><tbody>${matrix}</tbody></table></div>`;
  const levelsHtml = `<div class="table-scroll"><table><thead><tr><th>位置</th><th>含义</th><th>AI动作判断</th></tr></thead><tbody>${levels}</tbody></table></div>`;
  const aiHtml = aiInterpretationSectionHtml({ angles: analysisAngles, gptHtml, twoB });
  const abcHtml = abcStructureSectionHtml({ abc: analysisAngles.abc, twoB, bars });
  const sellPutHtml = cards.length
    ? cards.some((card) => card.bias === "偏多")
      ? "当前结构里已经出现偏多修复信号，但卖 Put 仍应放在明确支撑位下方，并等待下一根K线确认。"
      : "当前高分形态以偏空或观察为主，卖 Put 先看支撑是否有效，避免在失效位上方过早承接。"
    : `暂无超过${MIN_PATTERN_SCORE}%的高可信形态，卖 Put 只能参考支撑/失败位，不应仅凭当前末尾K线入场。`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeHtml(title)}</title>
  <style>
    :root{
      --bg:#08101f;--panel:#101b33;--panel-2:#15213d;--line:rgba(130,160,255,.18);
      --text:#edf2ff;--muted:#9fb0d8;--gold:#ffd166;--bull:#ff7a88;--bear:#40d98a;--flat:#b993ff;
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif;background:var(--bg);color:var(--text)}
    .page{max-width:1320px;margin:0 auto;padding:28px 20px 64px}
    .hero h1{margin:0 0 10px;font-size:48px;line-height:1.08}
    .hero p{margin:0 0 18px;color:var(--muted);font-size:18px}
    .chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
    .chip{display:inline-flex;align-items:center;padding:10px 16px;border-radius:999px;background:rgba(130,160,255,.1);border:1px solid var(--line);color:var(--text);font-size:14px;font-weight:700}
    .section,.top-match,.ai-brief,.chart-section{margin-top:24px;padding:24px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,var(--panel),var(--panel-2))}
    .section h2,.top-match h2,.ai-brief h2,.chart-section h2{margin:0 0 12px;font-size:22px}
    .section p,.top-match p,.ai-brief p,.chart-section p{margin:0 0 12px;color:var(--muted);line-height:1.7}
    .trend-title-accent{color:var(--gold)}
    .table-scroll{overflow-x:auto}
    table{width:100%;border-collapse:collapse;min-width:760px}
    th,td{padding:14px 12px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;vertical-align:top}
    th{color:#e6edff;font-size:14px}
    td{color:#cbd6ef}
    .price{color:var(--gold);font-weight:800}
    .dir,.signal{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:800}
    .dir-icon{font-size:12px}
    .dir-bull,.signal-bull{color:var(--bull);background:rgba(255,122,136,.12)}
    .dir-bear,.signal-bear{color:var(--bear);background:rgba(64,217,138,.12)}
    .dir-flat,.signal-flat{color:var(--gold);background:rgba(255,209,102,.12)}
    .no-match{padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.12)}
    .card{margin-top:18px;padding:18px;border-radius:16px;background:rgba(10,18,39,.72);border:1px solid var(--line)}
    .card .head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:14px}
    .card .head h2{margin:0 0 8px;font-size:18px}
    .card .head p{margin:0;color:var(--muted)}
    .score{font-size:40px;font-weight:900;color:var(--gold);line-height:1;text-align:right;white-space:nowrap}
    .score span{display:block;margin-top:8px;font-size:14px;color:var(--muted);font-weight:700}
    .compare{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .panel{padding:14px;border-radius:14px;background:rgba(8,16,31,.72);border:1px solid rgba(255,255,255,.06)}
    .panel h3{margin:0 0 10px;font-size:16px}
    .chart,.abc-stage-svg{width:100%;height:auto;display:block}
    .chart-wrap svg{width:100%;height:auto;display:block}
    .detail-box{margin-top:14px}
    .detail-box table{min-width:0}
    .structure-grid{display:grid;grid-template-columns:1fr;gap:18px}
    .structure-card{padding:18px;border-radius:16px;background:rgba(8,16,31,.56);border:1px solid rgba(255,255,255,.06)}
    .structure-card h3{margin:0 0 10px;font-size:18px}
    .structure-lead{margin:0 0 12px;color:#dbe5ff}
    .structure-meta,.abc-stage-note{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
    .structure-chip,.abc-stage-chip{display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.06);color:#edf2ff;font-size:13px;font-weight:700}
    .structure-chip-gold,.abc-stage-chip-soft{background:rgba(255,209,102,.12);color:var(--gold)}
    .ai-thesis{margin:0 0 12px;padding:16px 18px;border-left:5px solid var(--gold);border-radius:14px;background:rgba(255,209,102,.08);font-size:16px;line-height:1.8;color:#ffecb3}
    .ai-body{color:#d6e0f6;line-height:1.8}
    .fold{margin-top:24px;padding:0 20px 18px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,var(--panel),var(--panel-2))}
    .fold > summary{cursor:pointer;list-style:none;padding:18px 0;font-size:20px;font-weight:900}
    .fold > summary::-webkit-details-marker{display:none}
    .sellput-box{padding:18px;border-radius:16px;background:rgba(8,16,31,.56);border:1px solid rgba(255,255,255,.06);color:#d6e0f6;line-height:1.8}
    .footer-note{margin-top:20px;color:#8ea2cf;font-size:13px;line-height:1.7}
    @media (max-width: 900px){
      .page{padding:18px 14px 42px}
      .hero h1{font-size:32px}
      .compare{grid-template-columns:1fr}
      .card .head{flex-direction:column}
      .score{text-align:left}
      .section,.top-match,.ai-brief,.chart-section,.fold{padding-left:14px;padding-right:14px}
      th,td{padding:12px 10px}
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <h1>${safeHtml(title)}</h1>
      <p>模式：${safeHtml(options.menu || "1")}；数据源：Yahoo Finance；周期 ${safeHtml(intervalText)}；最新K线可能随交易继续变化。</p>
      <div class="chips">
        <span class="chip">标的：${safeHtml(displaySymbol)}</span>
        <span class="chip">周期：${safeHtml(intervalText)}</span>
        <span class="chip">样本（${safeHtml(options.timeLabel || "市场时间")}）：${safeHtml(bars[0]?.date || "")} 至 ${safeHtml(last.date || "")}</span>
        <span class="chip">最大匹配：1-${safeHtml(maxMatchBars)}根</span>
        ${trendStatsHtml}
      </div>
    </header>
    ${topMatchHtml}
    ${chartHtml}
    ${abcHtml}
    ${aiHtml}
    <details class="fold">
      <summary>最近K线总览</summary>
      ${recentTableHtml}
    </details>
    ${cardsSectionHtml}
    <details class="fold">
      <summary>各类指标信号解读</summary>
      ${signalMatrixHtml}
    </details>
    <details class="fold">
      <summary>关键位置判断</summary>
      ${levelsHtml}
    </details>
    <details class="fold">
      <summary>卖Put辅助判断</summary>
      <div class="sellput-box">${safeHtml(sellPutHtml)}</div>
    </details>
    <p class="footer-note">本报告用于K线结构学习、风险复盘和交易辅助，不构成投资建议。市场价格会变化，形态判断会随收盘价、成交量和波动率变化而更新。</p>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  try {
    const data = req.body || {};
    const inputSymbol = String(data.symbol || "").trim();
    if (!inputSymbol) {
      return sendJson(res, 400, { ok: false, error: "请输入标的代码。" });
    }
    const provider = data.provider || "deepseek";
    const interval = data.interval || "1d";
    const requestedRange = data.range || (interval === "1d" ? "1mo" : "5d");
    const maxMatchBars = Math.max(1, Math.min(10, Number(data.maxMatchBars) || 10));
    const trendSampleScope = String(data.trendSampleScope ?? "0") === "1" ? "1" : "0";
    const range = normalizeRangeForInterval(requestedRange, interval);
    const resolved = await resolveMarketBars(inputSymbol, data.market, range, interval);
    const { yahoo, display, displayName, market, bars, timeLabel, timezone } = resolved;
    const cards = patternCards(bars, maxMatchBars);
    const last = bars.at(-1);
    const closes = bars.map((b) => b.close);
    const support = Math.min(...bars.slice(-10).map((b) => b.low));
    const pressure1 = Math.max(...bars.slice(-4).map((b) => b.high));
    const pressure2 = Math.max(...bars.slice(-10).map((b) => b.high));
    const e20 = ema(closes, 20).at(-1);
    const e60 = ema(closes, 60).at(-1);
    const rsi14 = rsi(closes);
    const mom10 = momentum(closes);
    const historicalSampleSets = await fetchHistoricalSampleSets({ yahoo, market, interval, scope: trendSampleScope });
    const historicalTrendStats = scanHistoricalTrendStats(historicalSampleSets, cards, maxMatchBars, 5);
    const analysisAngles = buildAnalysisAngles({ bars, cards, last, support, pressure1, pressure2, e20, e60, mom10, rsi14, historicalTrendStats });
    const options = {
      menu: data.menu || "1",
      provider,
      market,
      timezone,
      timeLabel,
      maxMatchBars,
      trendSampleScope,
      historicalTrendStats,
      modules: data.modules || [],
      extra: data.extra || "",
    };
    const payload = {
      symbol: displayName,
      code: display,
      interval,
      range,
      latest_bar: bars.at(-1),
      recent_bars: bars.slice(-14),
      top5: cards.map((card, idx) => ({ rank: idx + 1, ...card })),
      historical_trend_stats: historicalTrendStats,
      analysis_angles: analysisAngles,
      options,
    };
    const ai = await callAI(payload, provider);
    const html = buildReport({ displaySymbol: displayName, interval, range, bars, cards, gptHtml: ai.html, options });
    const filename = `${safeSlug(displayName)}_${safeSlug(interval)}_${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}.html`;
    return sendJson(res, 200, {
      ok: true,
      symbol: displayName,
      code: display,
      interval,
      status: "已生成",
      range,
      requested_range: requestedRange,
      time_label: timeLabel,
      timezone,
      used_gpt: ai.used,
      ai_provider: ai.provider,
      trend_sample_scope: trendSampleScope,
      historical_trend_stats: historicalTrendStats,
      message: ai.message,
      filename,
      html,
      top5: cards.map((card, idx) => ({
        rank: `匹配 ${idx + 1}`,
        name: card.name,
        score: card.score,
        ruleScore: card.ruleScore,
        shapeScore: card.shapeScore,
        matchBars: card.matchBars,
        bias: card.bias,
        judgement: card.judgement,
        canonicalName: card.canonicalName,
        english: card.english,
        family: card.family,
        implementationStatus: card.implementationStatus,
      })),
      pattern_coverage: patternCoverageSummary(),
    });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || String(error) });
  }
}
