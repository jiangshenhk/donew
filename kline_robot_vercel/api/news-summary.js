const NEWS_API = "https://api.github.com/repos/jiangshenhk/donew/contents/jin10news/data/latest-24h.json?ref=main";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function timedFetch(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function loadNews() {
  const response = await timedFetch(NEWS_API + "&t=" + Date.now(), {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "donew-news-summary" }
  }, 12000);
  if (!response.ok) throw new Error("读取24小时新闻失败：GitHub HTTP " + response.status);
  const meta = await response.json();
  const payload = JSON.parse(Buffer.from(String(meta.content || "").replace(/\n/g, ""), "base64").toString("utf8"));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .filter(item => Date.parse(item.time) >= cutoff)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  if (!items.length) throw new Error("最近24小时新闻缓存为空");
  return { ...payload, items, count: items.length, contentSha: meta.sha };
}

const IMPORTANT = /美联储|央行|利率|降息|加息|通胀|CPI|PCE|非农|战争|导弹|袭击|制裁|霍尔木兹|特朗普|关税|原油|黄金|比特币|暴跌|暴涨|熔断|违约|破产|紧急|意外/u;

function selectForAI(items, maxItems = 360) {
  if (items.length <= maxItems) return items;
  const now = Date.now();
  const selected = [];
  const used = new Set();
  const add = item => { if (!used.has(item.id) && selected.length < maxItems) { used.add(item.id); selected.push(item); } };
  items.filter(item => now - Date.parse(item.time) <= 2 * 60 * 60 * 1000).slice(0, 150).forEach(add);
  items.filter(item => IMPORTANT.test(item.content || "")).slice(0, 140).forEach(add);
  const groups = {};
  for (const item of items) for (const category of item.categories || ["其他"]) (groups[category] ||= []).push(item);
  Object.values(groups).forEach(group => group.slice(0, 24).forEach(add));
  const remaining = items.filter(item => !used.has(item.id));
  const slots = Math.max(0, maxItems - selected.length);
  const step = slots ? Math.max(1, Math.floor(remaining.length / slots)) : 1;
  for (let i = 0; i < remaining.length && selected.length < maxItems; i += step) add(remaining[i]);
  return selected.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

function compactItems(items) {
  return items.map(item => ({
    time: item.time,
    categories: item.categories || ["其他"],
    content: String(item.content || "").slice(0, 320)
  }));
}

function systemPrompt() {
  return [
    "你是一名为卖Put交易者服务的中文市场新闻编辑和跨资产分析师。",
    "根据最近24小时金十市场快讯生成高度浓缩、可执行的市场要闻整理。",
    "严格只使用输入新闻，不虚构数据、价格和事件；相同事件合并，不逐条复述。",
    "优先识别宏观、利率、地缘、科技、黄金、原油、美股、加密和中国市场主线。",
    "必须区分事实、市场影响推断和待确认风险。",
    "每条编号结论和项目符号必须采用：**不超过18字的小标题：** 正文说明。小标题必须以冒号结束。",
    "正文只对少量真正关键的短语或数字使用Markdown粗体，禁止把整句或整段加粗。",
    "重点解释对纳指/QLD、BTC/MSTR、黄金、美元、美债收益率和卖Put风险偏好的影响。",
    "输出Markdown，结论置顶，使用以下结构：",
    "# 最近24小时市场要闻整理",
    "标题后直接输出3-6条编号结论，不要出现“结论摘要”章节标题。",
    "## 一、市场正在交易什么",
    "## 二、分类要闻",
    "## 三、跨资产影响",
    "跨资产影响必须使用Markdown表格：| 资产 | 影响方向 | 核心逻辑 |。影响方向只允许填写“偏多”“偏空”或“中性”，不要使用其他描述。",
    "## 四、卖Put风险提示",
    "## 五、未来24小时观察清单",
    "最后注明：本内容为新闻整理，不构成投资建议。"
  ].join("\n");
}

async function callDeepSeek(newsPayload) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("Vercel 尚未配置 DEEPSEEK_API_KEY");
  const response = await timedFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.DEEPSEEK_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [{ role: "system", content: systemPrompt() }, { role: "user", content: JSON.stringify(newsPayload) }],
      temperature: 0.2,
      max_tokens: 5000
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("DeepSeek HTTP " + response.status + "：" + (data.error?.message || "调用失败"));
  return data.choices?.[0]?.message?.content || "";
}

async function callOpenAI(newsPayload) {
  if (!process.env.OPENAI_API_KEY) throw new Error("Vercel 尚未配置 OPENAI_API_KEY");
  const response = await timedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: systemPrompt(),
      input: JSON.stringify(newsPayload),
      max_output_tokens: 5000
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("OpenAI HTTP " + response.status + "：" + (data.error?.message || "调用失败"));
  return data.output_text || (data.output || []).flatMap(x => x.content || []).map(x => x.text || "").join("");
}

function normalizeReportMarkdown(markdown) {
  return String(markdown || "")
    .replace(/^##\s*(?:一、)?结论摘要[^\n]*\n?/gmu, "")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*市场正在交易什么[^\n]*$/gmu, "## 一、市场正在交易什么")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*分类要闻[^\n]*$/gmu, "## 二、分类要闻")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*跨资产影响[^\n]*$/gmu, "## 三、跨资产影响")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*卖Put风险提示[^\n]*$/gmu, "## 四、卖Put风险提示")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*未来24小时观察清单[^\n]*$/gmu, "## 五、未来24小时观察清单")
    .trim();
}

function fileTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return map.year + "-" + map.month + "-" + map.day + "_" + map.hour + map.minute + map.second;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  try {
    const provider = String(req.body?.provider || "deepseek").toLowerCase() === "openai" ? "openai" : "deepseek";
    const news = await loadNews();
    const selected = selectForAI(news.items);
    const payload = {
      window: "最近24小时",
      generatedAt: new Date().toISOString(),
      source: news.sourceLabel || news.source,
      totalItems: news.items.length,
      analyzedItems: selected.length,
      categoryStats: news.categoryStats || {},
      items: compactItems(selected)
    };
    const rawMarkdown = provider === "openai" ? await callOpenAI(payload) : await callDeepSeek(payload);
    const markdown = normalizeReportMarkdown(rawMarkdown);
    if (!markdown.trim()) throw new Error("AI返回内容为空");
    return res.status(200).json({
      ok: true,
      report: {
        id: "jin10-24h-" + Date.now(),
        title: "最近24小时市场要闻整理",
        fileName: fileTimestamp() + "-最近24小时市场要闻整理.md",
        provider: provider === "openai" ? "GPT" : "DeepSeek",
        generatedAt: new Date().toISOString(),
        sourceUpdatedAt: news.updatedAt,
        sourceLabel: news.sourceLabel || news.source,
        totalItems: news.items.length,
        analyzedItems: selected.length,
        categoryStats: news.categoryStats || {},
        markdown
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.name === "AbortError" ? "AI调用超时，请重试" : (error.message || String(error)) });
  }
}
