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

function weekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00+08:00`);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function kindMeta(kind) {
  const date = hkDate();
  if (kind === "weekly") {
    return {
      kind,
      date,
      typeLabel: "周报",
      sessionLabel: "周报",
      title: `${date}市场结构周报`,
      fileName: `${date}市场结构周报.md`,
      basis: `${date}｜${weekday(date)}｜基于周五收盘、周末新闻与最新跨资产数据`,
    };
  }
  const sessionLabel = kind === "evening" ? "晚8点" : "早8点";
  return {
    kind,
    date,
    typeLabel: "日报",
    sessionLabel,
    title: `${date}市场结构日报（${sessionLabel}）`,
    fileName: `${date}市场结构日报(${sessionLabel}).md`,
    basis: `${date}｜${weekday(date)}${sessionLabel}｜基于最近一个完整美股交易日、盘后消息与最新跨资产数据`,
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

async function fetchSymbol(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    const closes = (result?.indicators?.quote?.[0]?.close || []).filter(value => value !== null && value !== undefined).map(Number);
    if (!result || closes.length < 5) throw new Error("No close data");
    const last = numberOrNull(result.meta?.regularMarketPrice) || closes.at(-1);
    const prev = closes.length > 1 ? closes.at(-2) : closes.at(-1);
    const sma20 = closes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.min(20, closes.length);
    const sma50 = closes.slice(-50).reduce((sum, value) => sum + value, 0) / Math.min(50, closes.length);
    return {
      symbol,
      last,
      changePct: prev ? (last / prev - 1) * 100 : 0,
      vs20Pct: sma20 ? (last / sma20 - 1) * 100 : 0,
      vs50Pct: sma50 ? (last / sma50 - 1) * 100 : 0,
      retrievedAt: new Date().toISOString(),
      error: "",
    };
  } catch (error) {
    return { symbol, last: null, changePct: null, vs20Pct: null, vs50Pct: null, retrievedAt: new Date().toISOString(), error: error.message };
  }
}

async function fetchMarketSnapshot() {
  const rows = await Promise.all(MARKET_SYMBOLS.map(fetchSymbol));
  return Object.fromEntries(rows.map(row => [row.symbol, row]));
}

function row(snapshot, symbol) {
  return snapshot[symbol] || { symbol, error: "missing" };
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
  const leadBase = kind === "evening"
    ? "今晚先看收盘确认，再决定明天是否进入候选池"
    : "今天可以把候选池打开，但仍要先看风向";
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
  const actionVerb = kind === "weekly" ? "本周" : "今天";
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

function buildDailyMarkdown(meta, snapshot, classification, targets, retrievedAtLabel) {
  const isEvening = meta.kind === "evening";
  const headline = headlineFor(meta.kind, classification);
  const finalCommand = finalCommandFor(meta.kind, classification);
  const overview = overviewRows(classification);
  const executionRows = targets.map(t => `| ${t.symbol} | ${t.wind} | ${t.level} | ${t.action} | ${t.delta} | ${t.dte} | ${t.cushion} | ${t.size} | ${t.invalid} |`).join("\n");
  const dataPreamble = isEvening
    ? `> **数据口径：** 本文是美股早盘与盘后消息后的晚报判断，不把盘中价格当作收盘确认；具体期权合约须在券商端复核实时 Delta、Bid/Ask、OI 与保证金。`
    : `> **数据口径：** 本文用于早报复盘与当日卖 Put 风控准备；市场快照来自最近一个完整美股交易日收盘、盘后消息与亚洲时段数据。`;

  return {
    headline,
    finalCommand,
    markdown: `# 📊 市场结构日报
**${displayDate(meta.date)}｜${weekday(meta.date)}${isEvening ? "盘前" : "盘后"}（${retrievedAtLabel ? `数据补取至${retrievedAtLabel}；` : ""}基于美股最近一个完整交易日收盘、盘后消息与跨资产数据）**

${dataPreamble}

## 1）${isEvening ? "今晚市场在交易什么？" : "本期市场在交易什么？"}

**一句话结论：${headline}**

| 项目 | 判断 |
|:---|:---|
${overview}

**短期风向：${classification.windLight}。**  
**今天真正交易的是：${classification.trueTheme}。**  
**真正说真话的是：${classification.truthTeller}。**

## 2）资金流向异动｜今日最重要变化

| 异动 | 变化 | 指标 | 信号解读 |
|:---|:---|:---|:---|
${flowRows(snapshot, classification, meta.kind)}

## 3）策略矩阵

| 资产 | 买CALL | 卖PUT | 核心逻辑 |
|:---|:---:|:---:|:---|
| **QQQ / QLD** | ⚠️ | ⚠️ | ${classification.executionLevel === "D" ? "先防守后观察；不追高卖近价 Put。" : "先看风险偏好与市场宽度，再决定是否只做远 OTM 小仓。"} |
| **SPY** | ⚠️ | ⚠️ | 作为较低 beta 的观察对照，不主动加仓。 |
| **IWM** | ⚠️ | ⚠️ | 风险偏好扩散时才更有意义，不是主进攻标的。 |
| **EEM** | ⚠️ | ⚠️ | 受美元和利率共同制约，只能做候选，不是机械卖方标的。 |
| **MSTR / BTC** | ❌ | ❌ | BTC 未确认前继续 0 交易。 |
| **INTC** | ⚠️ | ⚠️ | 半导体 beta + 个股波动叠加，不能把高 IV 当安全垫。 |
| **GLD / IAU** | ⚠️ | ⚠️ | 只作观察对冲，不是今日主线。 |
| **USO / XLE** | ❌ | ❌ | 地缘与油价 headline 波动大，不追涨也不贴价卖 put。 |

> **整体策略**：${finalCommand}

## 4）资金流向与资产联动

### A. 跨资产资金流向

| 方向 | 7日/当前趋势 | 观测指标 | 信号解读 |
|:---|:---|:---|:---|
| 能源风险溢价 → 科技/半导体 | ${formatPctValue(row(snapshot, "CL=F").changePct)} | WTI / SMH / SOXX | 油价回落通常给科技估值减压。 |
| 黄金避险 → 风险资产 | ${formatPctValue(row(snapshot, "GC=F").changePct)} | Gold | 避险需求是否下降，但未必会平均流向所有风险资产。 |
| 大盘成长 → 半导体链 | ${formatPctValue(row(snapshot, "SMH").changePct)} / ${formatPctValue(row(snapshot, "SOXX").changePct)} | SMH / SOXX | 半导体是否仍是最清晰主线。 |
| 风险资产 → 加密链 | ${formatPctValue(row(snapshot, "BTC-USD").changePct)} | BTC / MSTR | risk-on 是否扩散到 crypto beta。 |
| 美元偏强 → 压制非美 / 高 beta | ${formatPctValue(row(snapshot, "DX-Y.NYB").changePct)} | DXY | EEM 与高 beta 卖 Put 必须拉远安全垫。 |

### B. 关键联动

| 观测对 | 当前关系 | 变化 | 含义 |
|:---|:---|:---|:---|
| **油价 vs 纳指/半导体** | 油价回落支持科技估值 | 利多 | QLD 从禁守转为候选，但需确认。 |
| **10Y vs 科技股** | ${formatPrice(row(snapshot, "^TNX").last)} | ${formatPctValue(row(snapshot, "^TNX").changePct)} | 对 QQQ/SMH 是关键支撑或压制。 |
| **VIX vs 纳指** | ${formatPrice(row(snapshot, "^VIX").last)} | ${formatPctValue(row(snapshot, "^VIX").changePct)} | 不能把高权利金当作安全。 |
| **BTC vs MSTR** | 同向强弱决定 MSTR 是否恢复观察 | ${formatPctValue(row(snapshot, "MSTR").changePct)} | MSTR 不轻易升档。 |
| **SMH / SOXX vs INTC** | INTC 是高波动个股，不是普通 ETF | ${formatPctValue(row(snapshot, "INTC").changePct)} | 不能机械跟随半导体指数卖 Put。 |

### C. 谁在说真话？

- **${isEvening ? "今晚" : "今天"}真正说真话的是：半导体链、BTC/MSTR、美元和 VIX。**
- **我的判断：** 半导体可以确认风险修复的核心方向，但 BTC/MSTR 与美元没有确认全面 risk-on；所以卖 Put 可以恢复候选，但不能恢复激进。

## 5）宏观资产数据

| 资产 | 当前 | 日/均线变化 | 解读 |
|:---|:---|:---|:---|
${macroRows(snapshot)}

## 6）风险资产表现

| 资产 | 当前/收盘 | 20日变化 | 50日变化 | 资金流向 |
|:---|---:|---:|---:|:---|
${riskRows(snapshot)}

### 科技/半导体关键观察

| 股票/ETF | 当日结构 | 解读 |
|:---|:---|:---|
| **SMH** | ${formatPctValue(row(snapshot, "SMH").vs20Pct)} / ${formatPctValue(row(snapshot, "SMH").vs50Pct)} | 半导体中期强，短线仍可能震荡。 |
| **SOXX** | ${formatPctValue(row(snapshot, "SOXX").vs20Pct)} / ${formatPctValue(row(snapshot, "SOXX").vs50Pct)} | 半导体链往往比 QQQ 更先表达主线。 |
| **INTC** | ${formatPctValue(row(snapshot, "INTC").changePct)}，但 IV 仍高 | 这是高波动个股，不是低风险收租标的。 |

## 7）驱动拆解

    油价 / 10Y / DXY / VIX 的组合
        ↓
    科技估值压力或缓和
        ↓
    资金优先回到半导体，而不是平均买入所有风险资产
        ↓
    QQQ/QLD 是否重新站回趋势位
        ↓
    BTC、IBIT、MSTR 是否确认
        ↓
    今天可准备卖 Put，但只做远 OTM、小仓、盘中确认

## 8）核心变化 & 下一步看点

### A. 今天真正发生的变化

1. **风险从“事件压制”切回“分化修复”，但不是全面进攻。**
2. **半导体链是真主线，SMH / SOXX 往往比 QQQ 更先给出确认。**
3. **加密链是否确认，直接决定 MSTR 能否从禁卖转观察。**
4. **INTC 有半导体 beta 支撑，但它仍然是高波动个股。**

### B. 下一个观察点

| 关注点 | 重要性 | 影响 |
|:---|:---|:---|
| QQQ / QLD 能否重新站回 20 日线 | 🔴 高 | 决定 QLD 从观察转为执行候选。 |
| SMH / SOXX 是否继续强于 QQQ | 🔴 高 | 决定半导体主线是否仍可支撑风险偏好。 |
| VIX 是否回落到 20 日线下方 | 🔴 高 | 决定卖 Put 是否能提高一点 Delta。 |
| BTC 是否站稳，MSTR 是否停止相对走弱 | 🔴 高 | 这是 MSTR 从禁卖转观察的前提。 |
| INTC 是否守住关键区间 | 🔴 高 | 低于预期区间则暂停 INTC 卖 Put。 |
| DXY 是否继续上行 | 🟡 中 | 若美元继续强，EEM 与高 beta 都降级。 |

## 9）落到我的卖 Put 策略

### 对 QLD

- **当前判断：** ${classification.executionLevel === "D" ? "暂停新增 / 只观察。" : "谨慎卖 / 盘中确认后才可小仓。"}
- **原因：** ${classification.executionLevel === "D" ? "风险偏好仍偏弱，不能按修复盘处理。" : "半导体和油价/10Y的组合可以给支撑，但不适合追近价。"}
- **执行框架：** 优先 4-10 DTE，Delta 约 0.08-0.15，安全垫至少 8%-10%；若 QQQ 盘中弱于 SPY 或 VIX 上行，暂停。

### 对 MSTR

- **当前判断：** 暂停新增 / 0 交易。
- **原因：** BTC 未确认前，MSTR 的高 IV 主要是尾部风险，不是机会。

### 对 INTC

- **当前判断：** 只做观察；若一定做，只能极远 OTM、小仓、且愿意接货。
- **原因：** INTC 是半导体 beta + 个股高波动，不应把高 IV 直接当成卖方优势。

### 今天动作建议

- [ ] 直接卖 7 天内 Put
- [ ] 贴价卖 Put
- [ ] 因为 IV 高就开仓
- [x] 只允许小仓、远 OTM
- [x] 等盘中确认
- [x] QLD 优先但先看结构
- [x] MSTR 暂停
- [x] INTC 只观察 / 极远 OTM

**一句话交易建议：${finalCommand}**

## 10）市场日志

| 日期 | 核心变量 | 资金流向异动 | 风险评分 | 策略 |
|:---|:---|:---|:---|:---|
| ${displayDate(meta.date)} | ${classification.marketStage} | ${classification.capitalFlow} | ${classification.riskScore} | ${classification.executionLevel} |

## 11）最后的话

1. 今天/今晚是修复，不是翻篇。
2. 真正决定后续的是油价、VIX、10Y 和 DXY。
3. 如果 headline 反复，反弹会被重新定义。
4. 对策略来说，已经从“恐慌里卖”切换到“反弹后保守卖”。
5. INTC 只有在确认它不是独立事件风险时，才继续按低 Delta 候选处理。

## 数据来源

- 菜单6最小数据集：${meta.basis}
- 公开行情抓取：Yahoo Finance 跨资产快照
- AI 提示词：DeepSeek / GPT 可选

> 本报告用于交易研究与风险控制记录，不构成自动下单指令。`
  };
}

function buildWeeklyMarkdown(meta, snapshot, classification, targets, aiText) {
  const headline = headlineFor(meta.kind, classification);
  const finalCommand = finalCommandFor(meta.kind, classification);
  const overview = overviewRows(classification);
  const executionRows = targets.map(t => `| ${t.symbol} | ${t.wind} | ${t.level} | ${t.action} | ${t.delta} | ${t.dte} | ${t.cushion} | ${t.size} | ${t.invalid} |`).join("\n");

  return {
    headline,
    finalCommand,
    markdown: `# 📊 市场结构周报
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

function buildRuleMarkdown(meta, snapshot, classification, targets, aiText, retrievedAtLabel) {
  return meta.kind === "weekly"
    ? buildWeeklyMarkdown(meta, snapshot, classification, targets, aiText)
    : buildDailyMarkdown(meta, snapshot, classification, targets, retrievedAtLabel);
}

function marketPrompt() {
  return `你是熟悉美股短线市场结构、跨资产联动、AI交易拥挤度、BTC风险、半导体链和期权卖方风控的交易研究助手。
任务：基于菜单6市场最小数据集，输出一段可嵌入Markdown报告的中文分析。
要求：
1. 只分析市场风向，不给具体Strike，不抓取或假设期权链。
2. 结论前置，服务未来1-7个交易日是否允许卖Put。
3. 必须覆盖：短期风向灯、今天真正交易什么、谁在说真话、事件风险、QLD/EEM/MSTR/INTC/HOOD如何处理。
4. 不写宏观八股文，不把长期看好当短线卖put理由。
5. 返回Markdown片段，以“## AI 市场风向解读”开头。`;
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
    const kind = ["morning", "evening", "weekly"].includes(String(req.query.kind)) ? String(req.query.kind) : "morning";
    const provider = String(req.query.provider || "deepseek").toLowerCase() === "openai" ? "openai" : "deepseek";
    const meta = kindMeta(kind);
    const snapshot = await fetchMarketSnapshot();
    const classification = classify(snapshot);
    const targets = targetRows(snapshot, classification);
    const ai = await callAI({ meta, snapshot, classification, targets }, provider);
    const built = buildRuleMarkdown(meta, snapshot, classification, targets, ai.text, new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false }));
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
