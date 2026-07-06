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

function buildRuleMarkdown(meta, snapshot, classification, targets, aiSection) {
  const headline = classification.executionLevel === "D"
    ? "今日短期风向偏逆风，7天卖Put不适合新增，优先暂停高beta标的并等待VIX、利率和BTC重新确认。"
    : classification.executionLevel === "B"
      ? "今日短期风向按横风处理，7天卖Put只能小仓、远OTM、等盘中确认；MSTR需等待BTC确认。"
      : "今日短期风向偏顺风，但7天卖Put仍需按公共参数筛选，优先小仓分批而不是追价。";

  const finalCommand = classification.executionLevel === "D"
    ? "今天不新增7天Put，先观察VIX、10Y/DXY、半导体和BTC是否止稳。"
    : classification.executionLevel === "B"
      ? "今天只允许远OTM小仓观察，等VIX、10Y、BTC和半导体确认后再提高风险。"
      : "今天可小仓筛选7天Put，但必须复核实时IV、bid-ask、OI、事件日历和breakeven。";

  const executionRows = targets.map(t => `| ${t.symbol} | ${t.wind} | ${t.level} | ${t.action} | ${t.delta} | ${t.dte} | ${t.cushion} | ${t.size} | ${t.invalid} |`).join("\n");
  const strategyRows = targets.map(t => `| ${t.symbol} | 不追 | ${t.action} | ${t.invalid} |`).join("\n");

  return {
    headline,
    finalCommand,
    markdown: `# 📊 ${meta.kind === "weekly" ? "市场结构周报" : "市场结构日报"}

**${meta.basis}**

## 一句话结论
${headline}

> **今日短期风向：${classification.windLight}。**  
> **今天市场真正交易的是：${classification.trueTheme}。**  
> **今天真正说真话的是：${classification.truthTeller}。**

${aiSection || ""}

## 总览表

| 项目 | 判断 |
|:---|:---|
| **市场阶段** | ${classification.marketStage} |
| **资金流向** | ${classification.capitalFlow} |
| **风险评分** | ${classification.riskScore} / 10 |
| **7天卖put环境** | ${classification.putEnvironment} |
| **整体执行等级** | ${classification.executionLevel} |
| **事件风险** | ${classification.eventRisk} |

## 菜单6最小数据集

| Symbol | Last | Day% | Vs20% | Vs50% | Error |
|:---|---:|---:|---:|---:|:---|
${snapshotTable(snapshot)}

> 菜单6只做市场风向判断，不自动抓取期权链、Delta提醒、每日Sell Put总控数据包或模拟盘记录。若需要具体Put档位，应进入期权链/总控流程。

## 策略矩阵

| 资产 | 买CALL | 卖PUT | 核心逻辑 |
|:---|:---|:---|:---|
| QQQ / SPY | 观察 | 风向观察 | 先看风险偏好和市场宽度 |
${strategyRows}

## 短线卖 Put 环境评分

| 项目 | 评分 | 判断 |
|:---|:---|:---|
| 短期风向稳定度 | ${Math.max(1, 10 - Number(classification.riskScore)).toFixed(1)} / 10 | 是否适合承担7天风险 |
| 波动率风险 | ${classification.riskScore} / 10 | VIX / IV 是否可能突升 |
| 市场宽度 | ${row(snapshot, "IWM").changePct >= row(snapshot, "SPY").changePct ? "6.5" : "5.0"} / 10 | 是否只有少数股票硬撑 |
| 宏观冲击风险 | ${Math.min(9, 4 + Math.abs(row(snapshot, "^TNX").changePct || 0) + Math.abs(row(snapshot, "DX-Y.NYB").changePct || 0)).toFixed(1)} / 10 | 利率、美元、日元、油价是否冲击 |
| 事件跳空风险 | ${classification.eventRisk === "高" ? "8.0" : classification.eventRisk === "中" ? "6.0" : "4.0"} / 10 | 是否临近CPI/FOMC/财报/重大事件 |
| 期权卖方友好度 | ${classification.executionLevel === "A" ? "7.0" : classification.executionLevel === "B" ? "5.5" : "3.0"} / 10 | 权利金是否补偿风险 |

## 事件风险过滤器

> **事件风险：${classification.eventRisk}。**

| 事件 | 是否存在 | 处理 |
|:---|:---|:---|
| CPI / PPI / PCE | 待核验 | 高风险日前不卖贴价put |
| FOMC / Fed讲话 | 待核验 | 降低Delta或暂停 |
| 非农 / 失业率 | 待核验 | 数据日前谨慎 |
| 目标标的财报 | 待核验 | 原则上不跨财报 |
| 周末BTC风险 | 待核验 | MSTR避免跨周高风险仓 |
| BOJ / 日本CPI / 汇率干预 | 待核验 | 日元急升时暂停高beta卖put |

## 最终执行表

| 标的 | 风向 | 执行等级 | 操作 | Delta | DTE | 安全垫 | 仓位 | 失效条件 |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
${executionRows}

期权链数据不足，以上Delta与执行区间只是风控框架，实际下单前必须复核实时IV、bid-ask、OI、事件日历和breakeven。

## Checkbox

- [ ] 今天适合卖7天put
- [ ] 只能小仓
- [ ] 只能远OTM
- [ ] 等盘中确认
- [ ] 等IV抬升
- [ ] QLD可做
- [ ] EEM可做
- [ ] MSTR可做
- [ ] INTC可做
- [ ] MSTR暂停
- [ ] INTC暂停
- [ ] HOOD可做
- [ ] HOOD暂停
- [ ] 全部暂停

> **一句话交易指令：${finalCommand}。**

## 风险提示

本站内容仅用于投资研究与学习，不构成任何投资建议。`
  };
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
    const built = buildRuleMarkdown(meta, snapshot, classification, targets, ai.text);
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
