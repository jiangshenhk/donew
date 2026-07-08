const MARKET_SYMBOLS = [
  "QQQ", "SPY", "IWM", "QLD", "TQQQ", "SMH", "SOXX", "MAGS",
  "EEM", "FXI", "KWEB", "^VIX", "VIXY", "IBIT", "BTC-USD", "MSTR",
  "DX-Y.NYB", "^TNX", "JPY=X", "CL=F", "GC=F", "INTC", "HOOD"
];

const REQUIRED_TARGETS = ["QLD", "EEM", "MSTR", "INTC", "HOOD"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function sendJson(res, status, data) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  res.status(status).json(data);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function hkDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function marketSessionNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const minuteOfDay = Number(map.hour) * 60 + Number(map.minute);
  const weekend = map.weekday === "Sat" || map.weekday === "Sun";
  const phase = weekend
    ? "closed"
    : minuteOfDay >= 9 * 60 + 30 && minuteOfDay < 16 * 60
      ? "regular"
      : minuteOfDay >= 4 * 60 && minuteOfDay < 9 * 60 + 30
        ? "premarket"
        : minuteOfDay >= 16 * 60 && minuteOfDay < 20 * 60
          ? "afterhours"
          : "closed";
  const phaseLabels = {
    regular: "美股盘中",
    premarket: "美股盘前",
    afterhours: "美股盘后",
    closed: "美股休市",
  };
  return {
    phase,
    phaseLabel: phaseLabels[phase],
    etClock: `${pad(map.hour)}:${pad(map.minute)}`,
    weekday: map.weekday,
  };
}

function normalizeReportKind(kind) {
  return String(kind || "daily").toLowerCase() === "weekly" ? "weekly" : "daily";
}

function weekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00+08:00`);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function kindMeta(kind) {
  const date = hkDate();
  const normalized = normalizeReportKind(kind);
  if (normalized === "weekly") {
    return {
      kind: "weekly",
      date,
      typeLabel: "周报",
      sessionLabel: "周报",
      title: `${date}市场结构周报`,
      fileName: `${date}市场结构周报.md`,
      basis: `${date}｜${weekday(date)}｜基于周六美股收盘后到周一开盘前的周末窗口，以及最新跨资产数据`,
    };
  }
  const session = marketSessionNow();
  return {
    kind: "daily",
    date,
    typeLabel: "今日分析",
    sessionLabel: "今日最新分析",
    marketPhase: session.phase,
    marketPhaseLabel: session.phaseLabel,
    title: `${date}美股今日最新分析（${session.phaseLabel}）`,
    fileName: `${date}美股今日最新分析.md`,
    basis: `${date}｜${weekday(date)}｜以美股前一交易日收盘后到现在为止的最近24小时信息为主；当前阶段：${session.phaseLabel}`,
  };
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(value) {
  const n = numberOrNull(value);
  if (n === null) return "";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

async function fetchMarketSnapshot() {
  const session = marketSessionNow();
  const quoteMap = await fetchQuoteSnapshot().catch(() => ({}));
  const rows = await Promise.all(MARKET_SYMBOLS.map(symbol => fetchSymbol(symbol, quoteMap[symbol], session)));
  return Object.fromEntries(rows.map(row => [row.symbol, row]));
}

function row(snapshot, symbol) {
  return snapshot[symbol] || { symbol, error: "missing" };
}

async function fetchQuoteSnapshot() {
  const symbols = MARKET_SYMBOLS.join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Quote HTTP ${res.status}`);
  const json = await res.json();
  const results = json.quoteResponse?.result || [];
  return Object.fromEntries(results.map(item => [item.symbol, item]));
}

function latestPriceFromQuote(quote, phase) {
  if (!quote) return null;
  if (phase === "regular" && quote.regularMarketPrice != null) return quote.regularMarketPrice;
  if (phase === "premarket" && quote.preMarketPrice != null) return quote.preMarketPrice;
  if (phase === "afterhours" && quote.postMarketPrice != null) return quote.postMarketPrice;
  return quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? null;
}

function latestChangePctFromQuote(quote, phase) {
  if (!quote) return null;
  if (phase === "regular" && quote.regularMarketChangePercent != null) return quote.regularMarketChangePercent;
  if (phase === "premarket" && quote.preMarketChangePercent != null) return quote.preMarketChangePercent;
  if (phase === "afterhours" && quote.postMarketChangePercent != null) return quote.postMarketChangePercent;
  return quote.regularMarketChangePercent ?? quote.postMarketChangePercent ?? quote.preMarketChangePercent ?? null;
}

async function fetchSymbol(symbol, quote, session) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    const closes = (result?.indicators?.quote?.[0]?.close || []).filter(value => value !== null && value !== undefined).map(Number);
    if (!result || closes.length < 5) throw new Error("No close data");
    const lastChart = numberOrNull(result.meta?.regularMarketPrice) || closes.at(-1);
    const prev = closes.length > 1 ? closes.at(-2) : closes.at(-1);
    const price = numberOrNull(latestPriceFromQuote(quote, session.phase)) ?? lastChart;
    const changePct = numberOrNull(latestChangePctFromQuote(quote, session.phase)) ?? (prev ? (price / prev - 1) * 100 : 0);
    const sma20 = closes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.min(20, closes.length);
    const sma50 = closes.slice(-50).reduce((sum, value) => sum + value, 0) / Math.min(50, closes.length);
    return {
      symbol,
      last: price,
      changePct,
      vs20Pct: sma20 ? (price / sma20 - 1) * 100 : 0,
      vs50Pct: sma50 ? (price / sma50 - 1) * 100 : 0,
      marketState: quote?.marketState || result?.meta?.marketState || "",
      retrievedAt: new Date().toISOString(),
      error: "",
    };
  } catch (error) {
    return { symbol, last: null, changePct: null, vs20Pct: null, vs50Pct: null, retrievedAt: new Date().toISOString(), error: error.message };
  }
}

function extractJin10Items(html, limit = 8) {
  const stripped = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
  const lines = stripped
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.length > 6);
  const items = [];
  const timePattern = /^\d{2}:\d{2}:\d{2}$/;
  for (let i = 0; i < lines.length; i += 1) {
    if (!timePattern.test(lines[i])) continue;
    let headline = "";
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const candidate = lines[j];
      if (timePattern.test(candidate)) break;
      if (/^(更多|登录|注册|直播|广告|首页|快讯|数据|日历|专题|频道|排行|免责声明|客服|搜索)$/i.test(candidate)) continue;
      if (candidate.length < 8) continue;
      headline = candidate;
      break;
    }
    if (headline) {
      items.push(headline);
      if (items.length >= limit) break;
    }
  }
  return items;
}

async function fetchJin10News() {
  const urls = [
    "https://search.jin10.com/?page=1&type=flash&order=1&keyword=%E9%87%91%E5%8D%81%E6%95%B0%E6%8D%AE%E6%95%B4%E7%90%86&offset=0&vip=&basic_mode=",
    "https://xnews.jin10.com/",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const html = await res.text();
      const items = extractJin10Items(html, 8);
      if (items.length) {
        return { source: url, items };
      }
    } catch (error) {
      continue;
    }
  }
  return { source: urls[0], items: [] };
}

function classify(snapshot) {
  const qqq = row(snapshot, "QQQ");
  const spy = row(snapshot, "SPY");
  const iwm = row(snapshot, "IWM");
  const vix = row(snapshot, "^VIX");
  const tnx = row(snapshot, "^TNX");
  const dxy = row(snapshot, "DX-Y.NYB");
  const btc = row(snapshot, "BTC-USD");
  const smh = row(snapshot, "SMH");
  const soxx = row(snapshot, "SOXX");

  let risk = 5.5;
  if ((vix.changePct || 0) > 5) risk += 1.2;
  if ((tnx.changePct || 0) > 1 || (dxy.changePct || 0) > 0.3) risk += 0.8;
  if ((qqq.vs20Pct || 0) < 0 || (spy.vs20Pct || 0) < 0) risk += 0.8;
  if ((smh.changePct || 0) < -1 || (soxx.changePct || 0) < -1) risk += 0.6;
  if ((btc.changePct || 0) < -2) risk += 0.8;
  if ((iwm.changePct || 0) > (spy.changePct || 0)) risk -= 0.3;
  if ((vix.changePct || 0) < -3) risk -= 0.5;
  risk = Math.max(1, Math.min(9.5, risk));

  const windLight = risk >= 7.5 ? "🔴 逆风" : risk >= 6.2 ? "🟡 横风" : "🟢 顺风";
  const executionLevel = risk >= 7.5 ? "D" : risk >= 6.2 ? "B" : "A";
  const putEnvironment = risk >= 7.5 ? "不适合" : risk >= 6.2 ? "谨慎" : "适合";
  const eventRisk = risk >= 7.5 ? "高" : risk >= 6.2 ? "中" : "低";

  return {
    riskScore: risk.toFixed(1),
    windLight,
    executionLevel,
    putEnvironment,
    eventRisk,
    marketStage: risk >= 7.5 ? "risk-off / 高beta降级" : risk >= 6.2 ? "横风震荡 / 主线筛选" : "顺风修复 / 可小仓进攻",
    trueTheme: `VIX ${pct(vix.changePct)}、10Y ${pct(tnx.changePct)}、DXY ${pct(dxy.changePct)}、半导体 ${pct(smh.changePct)}、BTC ${pct(btc.changePct)} 的组合确认`,
    truthTeller: "VIX、10Y/DXY、SMH/SOXX、BTC 与 MSTR 相对强弱",
    capitalFlow: `QQQ ${pct(qqq.changePct)}，SPY ${pct(spy.changePct)}，IWM ${pct(iwm.changePct)}；半导体SMH ${pct(smh.changePct)}，BTC ${pct(btc.changePct)}。`,
  };
}

function targetRows(snapshot, classification) {
  const wind = classification.windLight;
  const level = classification.executionLevel;
  const noSell = level === "D" || wind.includes("逆风");
  const cautious = level === "B";
  const actionFor = (symbol) => {
    if (noSell) return "暂停新增";
    if (cautious) return symbol === "MSTR" ? "只观察，等待BTC确认" : "只允许远OTM小仓观察";
    return symbol === "MSTR" ? "顺风时也只考虑极小仓" : "可按公共参数小仓筛选";
  };
  const invalid = {
    QLD: "QQQ跌破5/10日趋势、VIX跳升、10Y压制科技",
    EEM: "DXY快速走强、10Y上行、亚洲资产转弱",
    MSTR: "BTC跌破关键位、MSTR弱于BTC、公司叙事受损",
    INTC: "弱于SOXX/QQQ、出现公司事件风险",
    HOOD: "Crypto风险退潮、券商风险偏好降温、强势结构跌破",
  };
  return REQUIRED_TARGETS.map(symbol => ({
    symbol,
    wind,
    level,
    action: actionFor(symbol),
    delta: noSell || cautious ? "不新开仓；仅观察" : "0.12-0.18，优先0.15",
    dte: noSell ? "不建议" : "4-10个自然日",
    cushion: "优先>=7%",
    size: noSell ? "0" : cautious ? "极小仓/小仓" : "小仓",
    invalid: invalid[symbol],
    latest: row(snapshot, symbol),
  }));
}

function snapshotTable(snapshot) {
  return MARKET_SYMBOLS.map(symbol => {
    const item = row(snapshot, symbol);
    return `| ${symbol} | ${item.last === null ? "" : item.last?.toFixed?.(2)} | ${pct(item.changePct)} | ${pct(item.vs20Pct)} | ${pct(item.vs50Pct)} | ${item.error || ""} |`;
  }).join("\n");
}

function archiveRow(report) {
  const date = report.date;
  const label = report.kind === "weekly" ? "周报" : report.sessionLabel;
  return `| **${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日** | ${weekday(date)} | ${report.typeLabel} | [${label}](/docs/市场/${report.fileName}) | ${report.headline} | ${report.targets.map(t => `${t.symbol}:${t.action}`).join("；")} | |`;
}

function displayDate(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatPctValue(value, digits = 2) {
  const n = numberOrNull(value);
  if (n === null) return "-";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function formatPrice(value) {
  const n = numberOrNull(value);
  if (n === null) return "-";
  return n.toFixed(2);
}

function formatRiskValue(value, digits = 1) {
  const n = numberOrNull(value);
  if (n === null) return "-";
  return `${n.toFixed(digits)} / 10`;
}

function headlineFor(kind, classification) {
  if (kind === "weekly") {
    return classification.executionLevel === "D"
      ? "本周市场发生了明显的风险重定价，高beta去杠杆已经出现，QLD暂停主动加仓，MSTR继续禁卖，INTC只观察。"
      : classification.executionLevel === "B"
        ? "本周市场以横风震荡为主，资金在修复与回撤之间反复切换，QLD只能远OTM小仓，MSTR继续等待BTC确认。"
        : "本周市场仍有修复，但结构并不统一，卖 Put 只能保守筛选，优先看半导体和低Delta机会。";
  }
  const leadBase = "以美股前一交易日收盘后到现在为止的最近24小时信息为主，先看美股和金十快讯，再决定候选池是否打开";
  return classification.executionLevel === "D"
    ? `${leadBase}：当前短期风向偏逆风，7天卖 Put 不适合新增，优先暂停高beta标的并等待VIX、利率和BTC重新确认。`
    : classification.executionLevel === "B"
      ? `${leadBase}：当前短期风向按横风处理，7天卖 Put 只能小仓、远OTM、等盘中确认；MSTR需等待BTC确认。`
      : `${leadBase}：当前短期风向偏顺风，但7天卖 Put 仍需按公共参数筛选，优先小仓分批而不是追价。`;
}

function finalCommandFor(kind, classification) {
  if (kind === "weekly") {
    return classification.executionLevel === "D"
      ? "下周先防守，QLD暂停主动加仓，MSTR继续禁卖，INTC只观察，不追strike。"
      : classification.executionLevel === "B"
        ? "下周以横风处理，QLD只保留极远OTM小仓候选，MSTR继续等BTC确认。"
        : "下周可以保留卖 Put 候选，但仍要先复核VIX、10Y、BTC与半导体结构。";
  }
  return classification.executionLevel === "D"
    ? "今天不新增7天Put，先观察VIX、10Y/DXY、半导体和BTC是否止稳。"
    : classification.executionLevel === "B"
      ? "今天只允许远OTM小仓观察，等VIX、10Y、BTC和半导体确认后再提高风险。"
      : "今天可小仓筛选7天Put，但必须复核实时IV、bid-ask、OI、事件日历和breakeven。";
}

function overviewRows(classification) {
  return `| **市场阶段** | **${classification.marketStage}** |
| **资金流向** | **${classification.capitalFlow}** |
| **风险评分** | **${classification.riskScore} / 10** |`;
}

function flowRows(snapshot, classification, kind) {
  const qqq = row(snapshot, "QQQ");
  const qld = row(snapshot, "QLD");
  const iwm = row(snapshot, "IWM");
  const smh = row(snapshot, "SMH");
  const soxx = row(snapshot, "SOXX");
  const btc = row(snapshot, "BTC-USD");
  const mstr = row(snapshot, "MSTR");
  const dxy = row(snapshot, "DX-Y.NYB");
  const vix = row(snapshot, "^VIX");
  const tnx = row(snapshot, "^TNX");
  const actionVerb = kind === "weekly" ? "本周" : "近24小时";
  return [
    `| 🟢 **半导体明显强于大盘** | ${formatPctValue(smh.vs20Pct)}、SOXX ${formatPctValue(soxx.vs20Pct)} | SMH / SOXX | AI/半导体仍是资金承接最清晰的方向。 |`,
    `| 🟡 **纳指修复但不够强** | QQQ ${formatPctValue(qqq.vs20Pct)}，QLD ${formatPctValue(qld.vs20Pct)} | QQQ / QLD | ${actionVerb}只能把候选池打开，不能按强趋势追价。 |`,
    `| 🟢 **小盘相对有扩散** | IWM ${formatPctValue(iwm.vs20Pct)} | IWM vs QQQ/SPY | 风险偏好有扩散，但未必足以支撑全面进攻。 |`,
    `| 🔴 **BTC 与 MSTR 继续打脸 risk-on** | BTC ${formatPctValue(btc.vs20Pct)}、MSTR ${formatPctValue(mstr.vs20Pct)} | BTC-USD / MSTR | 加密链不能作为卖 Put 的安全标的。 |`,
    `| 🟡 **美元与波动率仍需盯紧** | DXY ${formatPctValue(dxy.changePct)}，VIX ${formatPctValue(vix.changePct)}，10Y ${formatPctValue(tnx.changePct)} | DXY / VIX / 10Y | 流动性环境没有完全放松，卖 Put 必须降低 Delta。 |`,
  ].join("\n");
}

function strategyRows(snapshot, classification) {
  const targets = targetRows(snapshot, classification);
  return targets.map(t => `| **${t.symbol}** | ${t.symbol === "MSTR" ? "❌" : "⚠️"} | ${t.symbol === "MSTR" || t.wind.includes("逆风") ? "❌" : "⚠️"} | ${t.action} |`).join("\n");
}

function macroRows(snapshot) {
  return [
    `| **DXY** | \`${formatPrice(row(snapshot, "DX-Y.NYB").last)}\` | ${formatPctValue(row(snapshot, "DX-Y.NYB").changePct)} | 美元偏强仍压制 EEM 与高 beta 扩散。 |`,
    `| **美10Y收益率** | \`${formatPrice(row(snapshot, "^TNX").last)}\` | ${formatPctValue(row(snapshot, "^TNX").changePct)} | 对科技估值有利或不利，是风向的关键变量。 |`,
    `| **USDJPY** | \`${formatPrice(row(snapshot, "JPY=X").last)}\` | ${formatPctValue(row(snapshot, "JPY=X").changePct)} | 仍需观察是否触发 carry trade 进一步波动。 |`,
    `| **黄金** | \`${formatPrice(row(snapshot, "GC=F").last)}\` | ${formatPctValue(row(snapshot, "GC=F").changePct)} | 避险溢价与实际利率都在影响价格。 |`,
    `| **WTI 原油** | \`${formatPrice(row(snapshot, "CL=F").last)}\` | ${formatPctValue(row(snapshot, "CL=F").changePct)} | 油价是科技估值和通胀交易的共同变量。 |`,
    `| **比特币** | \`${formatPrice(row(snapshot, "BTC-USD").last)}\` | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} | 加密链是否确认，直接影响 MSTR 能不能从禁卖转观察。 |`,
    `| **VIX** | \`${formatPrice(row(snapshot, "^VIX").last)}\` | ${formatPctValue(row(snapshot, "^VIX").changePct)} | 风险没有消失，只是有时会暂时变得更可交易。 |`,
  ].join("\n");
}

function riskRows(snapshot) {
  return [
    `| **QQQ** | \`${formatPrice(row(snapshot, "QQQ").last)}\` | ${formatPctValue(row(snapshot, "QQQ").changePct)} | ${formatPctValue(row(snapshot, "QQQ").vs20Pct)} | ${formatPctValue(row(snapshot, "QQQ").vs50Pct)} |`,
    `| **SPY** | \`${formatPrice(row(snapshot, "SPY").last)}\` | ${formatPctValue(row(snapshot, "SPY").changePct)} | ${formatPctValue(row(snapshot, "SPY").vs20Pct)} | ${formatPctValue(row(snapshot, "SPY").vs50Pct)} |`,
    `| **IWM** | \`${formatPrice(row(snapshot, "IWM").last)}\` | ${formatPctValue(row(snapshot, "IWM").changePct)} | ${formatPctValue(row(snapshot, "IWM").vs20Pct)} | ${formatPctValue(row(snapshot, "IWM").vs50Pct)} |`,
    `| **QLD** | \`${formatPrice(row(snapshot, "QLD").last)}\` | ${formatPctValue(row(snapshot, "QLD").changePct)} | ${formatPctValue(row(snapshot, "QLD").vs20Pct)} | ${formatPctValue(row(snapshot, "QLD").vs50Pct)} |`,
    `| **SMH** | \`${formatPrice(row(snapshot, "SMH").last)}\` | ${formatPctValue(row(snapshot, "SMH").changePct)} | ${formatPctValue(row(snapshot, "SMH").vs20Pct)} | ${formatPctValue(row(snapshot, "SMH").vs50Pct)} |`,
    `| **SOXX** | \`${formatPrice(row(snapshot, "SOXX").last)}\` | ${formatPctValue(row(snapshot, "SOXX").changePct)} | ${formatPctValue(row(snapshot, "SOXX").vs20Pct)} | ${formatPctValue(row(snapshot, "SOXX").vs50Pct)} |`,
    `| **INTC** | \`${formatPrice(row(snapshot, "INTC").last)}\` | ${formatPctValue(row(snapshot, "INTC").changePct)} | ${formatPctValue(row(snapshot, "INTC").vs20Pct)} | ${formatPctValue(row(snapshot, "INTC").vs50Pct)} |`,
    `| **IBIT** | \`${formatPrice(row(snapshot, "IBIT").last)}\` | ${formatPctValue(row(snapshot, "IBIT").changePct)} | ${formatPctValue(row(snapshot, "IBIT").vs20Pct)} | ${formatPctValue(row(snapshot, "IBIT").vs50Pct)} |`,
    `| **MSTR** | \`${formatPrice(row(snapshot, "MSTR").last)}\` | ${formatPctValue(row(snapshot, "MSTR").changePct)} | ${formatPctValue(row(snapshot, "MSTR").vs20Pct)} | ${formatPctValue(row(snapshot, "MSTR").vs50Pct)} |`,
  ].join("\n");
}

function aiAppendix(aiText) {
  const cleaned = String(aiText || "").replace(/^## AI 市场风向解读\s*/i, "").trim();
  return cleaned ? `\n## AI 市场风向解读\n\n${cleaned}\n` : "";
}

function buildDailyMarkdownLite(meta, snapshot, classification, targets, retrievedAtLabel, aiText, jin10Items = [], jin10Source = "") {
  const phaseLabel = meta.marketPhaseLabel || "美股最新阶段";
  const timeLabel = marketSessionNow();
  const titleMeta = [retrievedAtLabel ? `数据补取至${retrievedAtLabel}` : "", phaseLabel].filter(Boolean).join("；");
  const headline = headlineFor(meta.kind, classification);
  const finalCommand = finalCommandFor(meta.kind, classification);
  const dataPreamble = `> **数据口径：** 以美股前一交易日收盘后到现在为止的最近 24 小时信息为主；如果美股盘中，优先使用最新盘中行情；盘前用盘前数据，盘后用盘后数据。金十财经快讯同步纳入。`;
  const jin10Block = jin10Items.length
    ? jin10Items.slice(0, 5).map(item => `- ${item}`).join("\n")
    : "- 金十快讯暂未抓到有效内容，请稍后重试。";
  const aiBlock = aiAppendix(aiText);

  return {
    headline,
    finalCommand,
    markdown: `# ${meta.title}
**${displayDate(meta.date)}｜${phaseLabel}（${titleMeta}）**

${dataPreamble}

**一句话结论：${headline}**

## 今天市场在交易什么

- **当前状态：** ${phaseLabel}，ET ${timeLabel.etClock}
- **真正交易的是：** ${classification.trueTheme}
- **真正说真话的是：** ${classification.truthTeller}
- **短期风向：** ${classification.windLight}

## 最近24小时金十快讯

${jin10Block}

## 资金与风险偏好

| 项目 | 判断 |
|:---|:---|
${overviewRows(classification)}

## 关键资产联动

| 观测 | 最新信号 | 解读 |
|:---|:---|:---|
| **VIX / 10Y / DXY** | ${formatPctValue(row(snapshot, "^VIX").changePct)} / ${formatPctValue(row(snapshot, "^TNX").changePct)} / ${formatPctValue(row(snapshot, "DX-Y.NYB").changePct)} | 流动性与波动率是否真正放松。 |
| **QQQ / SMH / SOXX** | ${formatPctValue(row(snapshot, "QQQ").changePct)} / ${formatPctValue(row(snapshot, "SMH").changePct)} / ${formatPctValue(row(snapshot, "SOXX").changePct)} | 科技和半导体是否继续领跑。 |
| **BTC / MSTR** | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} / ${formatPctValue(row(snapshot, "MSTR").changePct)} | 加密链是否还在拖累风险偏好。 |
| **QLD / EEM / INTC / HOOD** | ${formatPctValue(row(snapshot, "QLD").changePct)} / ${formatPctValue(row(snapshot, "EEM").changePct)} / ${formatPctValue(row(snapshot, "INTC").changePct)} / ${formatPctValue(row(snapshot, "HOOD").changePct)} | 卖 Put 候选是否真的可交易。 |

## 策略判断

| 资产 | 操作 | 失效条件 |
|:---|:---|:---|
${targets.map(t => `| **${t.symbol}** | ${t.action} | ${t.invalid} |`).join("\n")}

> **整体策略：** ${finalCommand}

## AI 市场风向解读

${aiBlock ? `${aiBlock}\n` : ""}

## 市场日志

| 日期 | 核心变量 | 风险评分 | 执行等级 |
|:---|:---|:---|:---|
| ${displayDate(meta.date)} | ${classification.marketStage} | ${classification.riskScore} | ${classification.executionLevel} |

## 数据来源

- 美股行情：Yahoo Finance quote + chart
- 金十财经：${jin10Source || "search.jin10.com"} 最近 24 小时快讯
- 菜单6最小数据集：${meta.basis}
- AI 提示词：DeepSeek / GPT 可选

> 本报告用于交易研究与风险控制记录，不构成自动下单指令。`
  };
}

function buildDailyMarkdown(meta, snapshot, classification, targets, retrievedAtLabel, aiText, jin10) {
  return buildDailyMarkdownLite(meta, snapshot, classification, targets, retrievedAtLabel, aiText, jin10?.items || [], jin10?.source || "");
}

function buildWeeklyMarkdown(meta, snapshot, classification, targets, aiText) {
  const headline = headlineFor(meta.kind, classification);
  const finalCommand = finalCommandFor(meta.kind, classification);
  const overview = overviewRows(classification);
  const executionRows = targets.map(t => `| ${t.symbol} | ${t.wind} | ${t.level} | ${t.action} | ${t.delta} | ${t.dte} | ${t.cushion} | ${t.size} | ${t.invalid} |`).join("\n");

  return {
    headline,
    finalCommand,
    markdown: `# AI每周市场情况分析
**${displayDate(meta.date)}｜${weekday(meta.date)}复盘（基于周五收盘、周末新闻与跨资产数据）**

**一句话结论：${headline}**

| 项目 | 判断 |
|:---|:---|
${overview}

## 一、资金流向与资产联动

### A. 跨资产资金流向

| 方向 | 本周状态 | 观测指标 | 解读 |
|:---|:---|:---|:---|
| AI 芯片 → 流出/再平衡 | ${classification.executionLevel === "D" ? "急剧恶化" : classification.executionLevel === "B" ? "震荡" : "局部承接"} | SOX、NVDA、MU、AMD、AVGO | 资金是否从最拥挤方向撤退。 |
| 高 beta 成长 → 防守 | ${classification.executionLevel === "D" ? "明显" : "部分发生"} | Nasdaq / Dow / 必需消费 | 市场是否开始降低风险预算。 |
| 债券 → 再定价 | ${formatPctValue(row(snapshot, "^TNX").changePct)} | 2Y、10Y 收益率 | 利率是否重新压住估值。 |
| BTC / 加密链 → 承压 | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} | BTC、MSTR、IBIT | 加密链是否成为风险放大器。 |
| 日元 carry → 风险升温 | ${formatPctValue(row(snapshot, "JPY=X").changePct)} | USDJPY、JGB | 若日元快速升值，高 beta 可能继续去杠杆。 |

### B. 关键联动

| 观测对 | 当前关系 | 变化 | 下周含义 |
|:---|:---|:---|:---|
| **半导体 / QQQ** | ${classification.marketStage} | ${classification.windLight} | QLD 不能按普通回踩处理。 |
| **10Y / QLD** | ${formatPrice(row(snapshot, "^TNX").last)} | ${formatPctValue(row(snapshot, "^TNX").changePct)} | 10Y 没回落前，不提高仓位。 |
| **BTC / MSTR** | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} vs ${formatPctValue(row(snapshot, "MSTR").changePct)} | ${classification.eventRisk} | MSTR 继续禁卖或仅观察。 |
| **USDJPY / 高 beta** | ${formatPrice(row(snapshot, "JPY=X").last)} | ${formatPctValue(row(snapshot, "JPY=X").changePct)} | carry 风险升温时暂停高 beta 卖 put。 |
| **SMH / SOXX vs INTC** | ${formatPctValue(row(snapshot, "INTC").changePct)} | 个股高波动 | INTC 不能机械跟随半导体指数卖 put。 |

### C. 谁在说真话

**本周真正说真话的是：SOX、2Y、10Y、BTC 和 USDJPY。**  
**我的判断：** 下周不是抄底竞赛，而是确认是否出现承接；先守住本金，再谈收权利金。

## 二、宏观资产数据

| 资产 | 最新状态 | 本周变化 | 解读 |
|:---|:---|:---|:---|
${macroRows(snapshot)}

## 三、风险资产表现

| 资产 | 本周表现 / 最新信号 | 结构判断 | 卖put含义 |
|:---|:---|:---|:---|
${riskRows(snapshot)}

## 四、AI 交易拥挤度与接力真空观察

| 观察项 | 本周状态 | 下周含义 |
|:---|:---|:---|
| **AI / 半导体拥挤度** | ${classification.executionLevel === "D" ? "明显释放" : "仍在高位"} | 不急着抄底。 |
| **SOX 整体动量** | ${classification.windLight} | 是否仍有压力测试。 |
| **软件接力能力** | ${classification.executionLevel === "D" ? "不足" : "未确认"} | 硬件回撤后有没有板块接棒。 |
| **接力真空** | ${classification.executionLevel === "D" ? "风险上升" : "仍需观察"} | 当前最大风险是资金没有新去处。 |

## 五、AI 宏观工作流检查

| 环节 | 当前状态 | 下周操作含义 |
|:---|:---|:---|
| 宏观变量 | ${classification.marketStage} | 高 beta 是否降级。 |
| 市场结构 | ${classification.windLight} | 进攻还是防守。 |
| AI 拥挤度 | ${classification.executionLevel === "D" ? "明显释放但未完成" : "等待确认"} | 不急着抄底。 |
| 标的状态 | QLD / MSTR / INTC | 三个标的都不适合贴价卖 put。 |
| 期权卖方环境 | ${classification.putEnvironment} | premium 变肥不等于安全垫变厚。 |
| 仓位动作 | ${classification.executionLevel === "D" ? "等承接、低 Delta、小仓" : "低 Delta、小仓"} | 保留现金，等待二次确认。 |

## 六、驱动拆解

    ${classification.marketStage}
        ↓
    ${classification.capitalFlow}
        ↓
    ${classification.windLight} / ${classification.executionLevel}
        ↓
    QLD / MSTR / INTC 的卖 Put 约束同步变化

## 七、本周真正发生的结构性变化

1. **风险有没有从事件压制切回分化修复。**
2. **半导体链是否仍然是主线。**
3. **加密链是否继续拖后腿。**
4. **INTC 是否只是高波动，而不是低风险收租。**

## 八、下周关键观察点

| 关注点 | 重要性 | 影响 |
|:---|:---|:---|
| QQQ / QLD 是否重新站回 20 日线 | 🔴 高 | 决定 QLD 能否从观察转为执行候选。 |
| SMH / SOXX 是否继续强于 QQQ | 🔴 高 | 决定半导体主线是否仍可支撑风险偏好。 |
| VIX 是否回落到 20 日线下方 | 🔴 高 | 决定卖 Put 是否能提高一点 Delta。 |
| BTC 是否站稳，MSTR 是否停止相对走弱 | 🔴 高 | 这是 MSTR 从禁卖转观察的前提。 |
| INTC 是否守住关键区间 | 🔴 高 | 低于预期区间则暂停 INTC 卖 Put。 |
| DXY 是否继续上行 | 🟡 中 | 若美元继续强，EEM 与高 beta 都降级。 |

## 九、落到卖 put 策略

### 对 QLD

- **当前判断：** ${classification.executionLevel === "D" ? "暂停主动加仓 / 只允许极远 OTM 观察单。" : "只保留极远 OTM 小仓候选。"}
- **原因：** ${classification.executionLevel === "D" ? "芯片和风险偏好都没有给出足够确认。" : "有修复，但仍需要结构确认。"}
- **执行方式：** 等开盘后或下周开盘后确认，不在快速下杀中卖。

### 对 MSTR

- **当前判断：** 继续禁卖 / 0 交易。
- **原因：** BTC 未确认前，MSTR 的高 IV 主要是尾部风险，不是机会。

### 对 INTC

- **当前判断：** 只观察；不因 IV 极高开新仓。
- **原因：** INTC 是高波动个股，不是普通半导体 beta。

### 下周动作建议

- [ ] 直接卖 7 天内 Put
- [ ] 贴价卖 Put
- [ ] 因为 IV 高就开仓
- [x] 只允许小仓、远 OTM
- [x] 等收盘/盘后确认
- [x] QLD 先看结构
- [x] MSTR 暂停
- [x] INTC 只观察 / 极远 OTM

**一句话交易建议：${finalCommand}**

## 十、AI 参考解读

${aiAppendix(aiText)}

## 数据来源

- 周报所用的公开跨资产快照
- Yahoo Finance / 公开行情抓取
- AI 提示词：DeepSeek / GPT 可选

> 本报告用于交易研究与风险控制记录，不构成自动下单指令.`
  };
}

function buildRuleMarkdown(meta, snapshot, classification, targets, aiText, retrievedAtLabel, jin10) {
  return meta.kind === "weekly"
    ? buildWeeklyMarkdown(meta, snapshot, classification, targets, aiText)
    : buildDailyMarkdown(meta, snapshot, classification, targets, retrievedAtLabel, aiText, jin10);
}

function marketPrompt() {
  return `你是熟悉美股短线市场结构、跨资产联动、AI交易拥挤度、BTC风险、半导体链和期权卖方风控的交易研究助手。
任务：基于菜单6市场最小数据集、金十财经最近24小时快讯和最新美股行情，输出一段可嵌入Markdown报告的中文分析。
要求：
1. 只分析市场风向，不给具体Strike，不抓取或假设期权链。
2. 结论前置，优先回答最近24小时最重要的大事。
3. 如果美股盘中，优先解释最新盘中行情；如果盘前或盘后，优先对应时段数据；如果休市，说明当前阶段和下一交易窗口。
4. 必须覆盖：短期风向灯、今天真正交易什么、谁在说真话、金十快讯、事件风险、QLD/EEM/MSTR/INTC/HOOD如何处理。
5. 不写宏观八股文，不把长期看好当短线卖put理由。
6. 返回Markdown片段，以“## AI 市场风向解读”开头。`;
}

async function callOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) return { used: false, provider: "GPT", text: "## AI 市场风向解读\n\n未配置 OPENAI_API_KEY，本次使用规则版报告。" };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [{ role: "system", content: marketPrompt() }, { role: "user", content: JSON.stringify(payload) }],
    }),
  });
  if (!res.ok) return { used: false, provider: "GPT", text: `## AI 市场风向解读\n\nGPT 调用失败：${res.status}。本次使用规则版报告。` };
  const data = await res.json();
  const text = data.output_text || (data.output || []).flatMap(item => item.content || []).map(c => c.text || "").join("");
  return { used: true, provider: "GPT", text: text || "## AI 市场风向解读\n\nGPT 返回为空，本次使用规则版报告。" };
}

async function callDeepSeek(payload) {
  if (!process.env.DEEPSEEK_API_KEY) return { used: false, provider: "DeepSeek", text: "## AI 市场风向解读\n\n未配置 DEEPSEEK_API_KEY，本次使用规则版报告。" };
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [{ role: "system", content: marketPrompt() }, { role: "user", content: JSON.stringify(payload) }],
      temperature: 0.2,
    }),
  });
  if (!res.ok) return { used: false, provider: "DeepSeek", text: `## AI 市场风向解读\n\nDeepSeek 调用失败：${res.status}。本次使用规则版报告。` };
  const data = await res.json();
  return { used: true, provider: "DeepSeek", text: data.choices?.[0]?.message?.content || "## AI 市场风向解读\n\nDeepSeek 返回为空，本次使用规则版报告。" };
}

function callAI(payload, provider) {
  return String(provider || "deepseek").toLowerCase() === "openai" ? callOpenAI(payload) : callDeepSeek(payload);
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  try {
    const kind = normalizeReportKind(req.query.kind);
    const provider = String(req.query.provider || "deepseek").toLowerCase() === "openai" ? "openai" : "deepseek";
    const meta = kindMeta(kind);
    const snapshot = await fetchMarketSnapshot();
    const jin10 = kind === "weekly" ? { source: "", items: [] } : await fetchJin10News();
    const classification = classify(snapshot);
    const targets = targetRows(snapshot, classification);
    const ai = await callAI({ meta, snapshot, classification, targets, jin10 }, provider);
    const built = buildRuleMarkdown(meta, snapshot, classification, targets, ai.text, new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false }), jin10);
    const report = {
      id: `${meta.fileName}-${Date.now()}`,
      ...meta,
      ...classification,
      headline: built.headline,
      finalCommand: built.finalCommand,
      targets,
      aiProvider: ai.provider,
      usedAi: ai.used,
      retrievedAt: new Date().toISOString(),
      retrievedAtLabel: new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false }),
      markdown: built.markdown,
    };
    report.archiveRow = archiveRow(report);
    return sendJson(res, 200, { ok: true, report });
  } catch (error) {
    return sendJson(res, 500, { ok: false, message: error.message || String(error) });
  }
}
