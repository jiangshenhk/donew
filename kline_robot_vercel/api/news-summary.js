import { securityCheck } from './_lib/security.js';
import { scanDecisionEventRisks } from './_lib/sell-put-decision-core.js';

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

/* ═══════════════════ 新闻摘要 ═══════════════════ */

export async function loadRecentMarketNews() {
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
  return items.map(item => ({ time: item.time, categories: item.categories || ["其他"], content: String(item.content || "").slice(0, 320) }));
}

const DECISION_ALIASES = {
  QLD: ["QLD", "QQQ", "纳指", "纳斯达克", "科技股"],
  QQQ: ["QQQ", "纳指", "纳斯达克", "科技股"],
  MSTR: ["MSTR", "MICROSTRATEGY", "STRATEGY", "比特币", "BTC"],
  INTC: ["INTC", "INTEL", "英特尔", "半导体", "芯片"],
  HOOD: ["HOOD", "ROBINHOOD", "券商", "加密货币"],
};
const DECISION_MACRO = /美联储|FOMC|利率|美债|非农|就业|CPI|PPI|PCE|GDP|通胀|关税|制裁|战争|冲突|原油|OPEC|美元|美股|纳指|标普|科技|半导体|芯片|比特币|加密|流动性|波动率|VIX/i;

export function selectDecisionNews(items, symbol, maxItems = 80) {
  if (!Array.isArray(items)) return [];
  const upper = String(symbol || "").trim().toUpperCase();
  const terms = [upper.replace(/-USD$/, ""), ...(DECISION_ALIASES[upper] || [])].filter(Boolean);
  return items
    .filter((item) => {
      const content = String(item?.content || "");
      const normalized = content.toUpperCase();
      return DECISION_MACRO.test(content) || terms.some((term) => normalized.includes(String(term).toUpperCase()));
    })
    .slice(0, maxItems);
}

export function summarizeDecisionNews(items, maxItems = 30) {
  if (!Array.isArray(items) || !items.length) return "";
  return items.slice(0, maxItems).map((item) => {
    const parsed = new Date(item.time);
    const time = Number.isNaN(parsed.getTime())
      ? "时间未取到"
      : parsed.toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hour12: false });
    const categories = (item.categories || []).join(",");
    return `[${time}][${categories}] ${String(item.content || "").slice(0, 200)}`;
  }).join("\n");
}

export function analyzeDecisionNews(items, symbol) {
  const selected = selectDecisionNews(items, symbol);
  return {
    selected,
    summary: summarizeDecisionNews(selected),
    eventRisks: scanDecisionEventRisks(selected),
  };
}

function newsSystemPrompt() {
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
    "标题后直接输出3-6条编号结论，不要出现\u201C结论摘要\u201D章节标题。",
    "编号结论后立即输出跨资产Markdown表格，不要为表格添加任何章节标题。表格格式：| 资产 | 影响方向 | 核心逻辑 |。",
    "每个资产只允许出现一行，必须综合该资产受到的全部相关新闻影响，不能只选择其中一条新闻。",
    "影响方向只允许填写\u201C偏多\u201D\u201C偏空\u201D或\u201C中性\u201D，代表多项因素合并后的净方向。",
    "核心逻辑必须采用：利多：...；利空：...；净判断：...。如果没有明确利多或利空因素，填写\u201C无明确因素\u201D；不得省略正反因素。",
    "若新闻影响互相冲突，应说明当前哪项因素占主导；无法判断主导因素时，影响方向必须填写\u201C中性\u201D。",
    "## 一、市场正在交易什么",
    "## 二、分类要闻",
    "## 三、卖Put风险提示",
    "## 四、未来24小时观察清单",
    "最后注明：本内容为新闻整理，不构成投资建议。"
  ].join("\n");
}

function normalizeReportMarkdown(markdown) {
  let text = String(markdown || "")
    .replace(/^##\s*(?:一、)?结论摘要[^\n]*\n?/gmu, "")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*市场正在交易什么[^\n]*$/gmu, "## 一、市场正在交易什么")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*分类要闻[^\n]*$/gmu, "## 二、分类要闻")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*跨资产影响[^\n]*$/gmu, "## 跨资产影响")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*卖Put风险提示[^\n]*$/gmu, "## 三、卖Put风险提示")
    .replace(/^##\s*[一二三四五六七八九十]*、?\s*未来24小时观察清单[^\n]*$/gmu, "## 四、未来24小时观察清单");
  const crossMatch = text.match(/(?:^|\n)##\s*跨资产影响\s*\n([\s\S]*?)(?=\n##\s|$)/u);
  if (crossMatch) {
    text = text.replace(crossMatch[0], "");
    const firstSection = /^## 一、市场正在交易什么\s*$/mu;
    text = text.replace(firstSection, crossMatch[1].trim() + "\n\n## 一、市场正在交易什么");
  }
  return text.trim();
}

function fileTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return map.year + "-" + map.month + "-" + map.day + "_" + map.hour + map.minute + map.second;
}

/* ═══════════════════ AI 调用（共用） ═══════════════════ */

async function callDeepSeek(payload, instructions, maxTokens = 7000) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("Vercel 尚未配置 DEEPSEEK_API_KEY");
  const response = await timedFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.DEEPSEEK_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
      messages: [{ role: "system", content: instructions }, { role: "user", content: typeof payload === "string" ? payload : JSON.stringify(payload) }],
      temperature: 0.2, max_tokens: maxTokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("DeepSeek HTTP " + response.status + "：" + (data.error?.message || "调用失败"));
  return data.choices?.[0]?.message?.content || "";
}

async function callOpenAI(payload, instructions, maxTokens = 7000) {
  if (!process.env.OPENAI_API_KEY) throw new Error("Vercel 尚未配置 OPENAI_API_KEY");
  const response = await timedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", instructions, input: JSON.stringify(payload), max_output_tokens: maxTokens })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("OpenAI HTTP " + response.status + "：" + (data.error?.message || "调用失败"));
  return data.output_text || (data.output || []).flatMap(x => x.content || []).map(x => x.text || "").join("");
}

async function callOpenAIChat(prompt, maxTokens = 8000) {
  if (!process.env.OPENAI_API_KEY) throw new Error("未配置 OPENAI_API_KEY");
  const resp = await timedFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", messages: [{ role: "system", content: "你是一个专业的内容总结助手。请用中文回复。" }, { role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.3 })
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(`OpenAI HTTP ${resp.status}: ${t.slice(0, 200)}`); }
  const json = await resp.json();
  return json.choices?.[0]?.message?.content || "";
}

async function callDeepSeekSimple(prompt, maxTokens = 8000) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("未配置 DEEPSEEK_API_KEY");
  const resp = await timedFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro", messages: [{ role: "system", content: "你是一个专业的内容总结助手。请用中文回复。" }, { role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.3 })
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(`DeepSeek HTTP ${resp.status}: ${t.slice(0, 200)}`); }
  const json = await resp.json();
  return json.choices?.[0]?.message?.content || "";
}

async function callAI(prompt) {
  if (process.env.DEEPSEEK_API_KEY) return { provider: "DeepSeek", text: await callDeepSeekSimple(prompt) };
  if (process.env.OPENAI_API_KEY) return { provider: "OpenAI", text: await callOpenAIChat(prompt) };
  throw new Error("未配置任何 AI API Key");
}

/* ═══════════════════ 视频/文章摘要工具函数 ═══════════════════ */

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function escMd(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\*/g, "\\*").replace(/_/g, "\\_").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/#/g, "\\#"); }

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("bilibili.com") || u.includes("b23.tv")) return "bilibili";
  if (u.includes("mp.weixin.qq.com") || u.includes("weixin.qq.com")) return "wechat";
  if (u.includes("douyin.com") || u.includes("tiktok.com")) return "tiktok";
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "xiaohongshu";
  return "other";
}

function extractYoutubeId(url) {
  const patterns = [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function extractBilibiliId(url) {
  const patterns = [/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/, /b23\.tv\/([a-zA-Z0-9]+)/, /bilibili\.com\/video\/av(\d+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

async function getYoutubeVideoInfo(videoId) {
  try {
    const resp = await timedFetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {}, 15000);
    if (resp.ok) { const data = await resp.json(); return { title: data.title, author: data.author_name || "YouTube" }; }
  } catch (e) { console.warn("oembed failed:", e.message); }
  return { title: videoId, author: "YouTube" };
}

async function getYoutubeTranscript(videoId) {
  try {
    const resp = await timedFetch(`https://youtubetranscript.com/?v=${videoId}`, {}, 20000);
    if (!resp.ok) return null;
    const xml = await resp.text();
    const texts = [];
    const regex = /<text[^>]*>([^<]*)<\/text>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) { const txt = match[1].trim(); if (txt) texts.push(txt); }
    return texts.length ? texts.join(" ") : null;
  } catch (e) { return null; }
}

async function getBilibiliVideoInfo(vid) {
  try {
    const resp = await timedFetch(`https://api.bilibili.com/x/web-interface/view?bvid=${vid}`, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com/" } }, 15000);
    if (!resp.ok) throw new Error("B站 API " + resp.status);
    const json = await resp.json();
    if (json.code !== 0) throw new Error("B站 API 错误");
    const data = json.data;
    return { title: data.title || vid, author: data.owner?.name || "B站用户", duration: data.duration || 0, description: data.desc || "", cid: data.cid || null };
  } catch (e) { return { title: vid, author: "B站用户", duration: 0, description: "", cid: null }; }
}

async function getBilibiliSubtitle(vid, cid) {
  if (!cid) return null;
  try {
    const resp = await timedFetch(`https://api.bilibili.com/x/player/v2?bvid=${vid}&cid=${cid}`, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com/" } }, 15000);
    if (!resp.ok) return null;
    const json = await resp.json();
    const subtitle = json.data?.subtitle?.subtitles;
    if (!subtitle || subtitle.length === 0) return null;
    const subUrl = subtitle[0].subtitle_url;
    if (!subUrl) return null;
    const subResp = await timedFetch(subUrl.startsWith("http") ? subUrl : "https:" + subUrl, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com/" } }, 15000);
    if (!subResp.ok) return null;
    const subData = await subResp.json();
    const texts = (subData.body || []).map(item => item.content).filter(Boolean);
    return texts.length ? texts.join("\n") : null;
  } catch (e) { return null; }
}

async function extractArticleFromUrl(url) {
  const resp = await timedFetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "Accept": "text/html" }, redirect: "follow" }, 20000);
  if (!resp.ok) throw new Error(`无法访问文章链接（HTTP ${resp.status}）`);
  const html = await resp.text();
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "").replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "").replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "").replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "").replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "").replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "").replace(/<code[^>]*>[\s\S]*?<\/code>/gi, "").replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[a-z]+;/g, " ").replace(/&#\d+;/g, " ").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  const lines = cleaned.split("\n").map(l => l.trim()).filter(l => l.length > 10);
  if (!lines.length) throw new Error("无法从该文章中提取文字内容");
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return { title: titleMatch ? titleMatch[1].trim() : "未知标题", text: lines.join("\n\n") };
}

function renderMarkdownToHtml(text) {
  let lines = text.split("\n"), result = [], inList = false;
  function nextNonEmpty(idx) { for (let j = idx + 1; j < lines.length; j++) { if (lines[j].trim()) return lines[j].trim(); } return null; }
  function isListItem(line) { return /^[-*]\s/.test(line) || /^\d+[\.\、]\s/.test(line); }
  function color(line) { return line.replace(/([+\u2191\u2b06]\s*\d+(?:\.\d+)?%?)/g, '<span class="num-pos">$1</span>').replace(/([-−\u2193\u2b07]\s*\d+(?:\.\d+)?%?)/g, '<span class="num-neg">$1</span>'); }
  function bold(line) { return line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) { if (inList && isListItem(nextNonEmpty(i) || "")) continue; if (inList) { result.push("</ul>"); inList = false; } continue; }
    if (/^#{3,4}\s/.test(t)) { if (inList) { result.push("</ul>"); inList = false; } result.push(`<h3>${color(bold(t.replace(/^#{3,4}\s*/, "")))}</h3>`); continue; }
    if (/^##\s/.test(t)) { if (inList) { result.push("</ul>"); inList = false; } result.push(`<h2>${color(bold(t.replace(/^##\s*/, "")))}</h2>`); continue; }
    if (isListItem(t)) { if (!inList) { result.push("<ul>"); inList = true; } result.push(`<li>${color(bold(t.replace(/^[-*]\s/, "").replace(/^\d+[\.\、]\s/, "")))}</li>`); continue; }
    if (/^---+$/.test(t)) { if (inList) { result.push("</ul>"); inList = false; } result.push("<hr>"); continue; }
    if (inList) { result.push("</ul>"); inList = false; }
    result.push(`<p>${color(bold(t))}</p>`);
  }
  if (inList) result.push("</ul>");
  return result.join("\n");
}

function buildSummaryHtml({ title, mode, platform, sourceTitle, sourceAuthor, sourceUrl, summary, generatedAt, provider }) {
  const label = mode === "article" ? "文章" : "视频";
  const separator = "## AI 深度分析";
  const sepIdx = summary.indexOf(separator);
  const summaryPart = sepIdx !== -1 ? summary.substring(0, sepIdx).trim() : summary;
  const analysisPart = sepIdx !== -1 ? summary.substring(sepIdx).trim().replace(/^## AI 深度分析\s*/g, "") : "";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0f172a;color:#cbd5e1;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Helvetica Neue",sans-serif;font-size:16px;line-height:1.75}main{max-width:960px;margin:0 auto;padding:32px 20px 56px}h1{margin:0 0 .6em;font-size:2rem;color:#fde047;font-weight:700}h2{font-size:1.5rem;margin:1.2em 0 .6em;color:#fde047;font-weight:700;border-left:4px solid #fde047;padding-left:14px}h3{font-size:1.2rem;margin:1em 0 .5em;color:#fde047;font-weight:700}.meta{color:#94a3b8;font-size:13px;margin-bottom:20px}.meta a{color:#60a5fa}.card{background:#172554;border:1px solid #334155;border-radius:18px;padding:24px 28px;margin-bottom:18px}.tag{display:inline-block;background:#1e3a5f;color:#93c5fd;border-radius:8px;padding:2px 10px;font-size:12px;margin-right:6px}.content-box{font-size:16px;line-height:1.75}.content-box p{margin:1em 0}.content-box ul,.content-box ol{padding-left:24px;margin:1em 0}.content-box li{margin:.5em 0}.content-box strong{color:#fde047;font-weight:700}.content-box hr{border:0;border-top:1px solid #334155;margin:2em 0}.num-pos{color:#4ade80;font-weight:700}.num-neg{color:#f87171;font-weight:700}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #334155;color:#64748b;font-size:13px}</style>
</head><body><main>
<h1>${esc(title)}</h1>
<div class="meta"><span class="tag">${esc(platform)}</span><span class="tag">${esc(label)}</span>${sourceTitle ? `｜${esc(sourceTitle)}` : ""}${sourceAuthor ? `｜作者：${esc(sourceAuthor)}` : ""}<br>生成时间：${esc(generatedAt)}｜AI：${esc(provider)}${sourceUrl ? `<br><a href="${esc(sourceUrl)}" target="_blank" rel="noopener">查看原始${label}</a>` : ""}</div>
<h2>内容总结</h2><div class="card content-box">${renderMarkdownToHtml(summaryPart)}</div>
${analysisPart ? `<h2>AI 深度分析</h2><div class="card content-box">${renderMarkdownToHtml(analysisPart)}</div>` : ""}
<div class="footer">由十方斋｜内容总结分析工具自动生成 · ${esc(provider)} 提供 AI 分析 · 仅供学习参考，不构成任何建议</div>
</main></body></html>`;
}

async function handleVideoArticle(req, res) {
  const mode = String(req.body?.mode || "video").trim();
  const note = String(req.body?.note || "").trim();
  let sourceTitle = "", sourceAuthor = "", sourceUrl = "", sourceText = "", platform = "";

  if (mode === "article") {
    const articleUrl = String(req.body?.articleUrl || req.body?.videoUrl || "").trim();
    const articleText = String(req.body?.articleText || "").trim();
    if (!articleUrl && !articleText) return res.status(400).json({ ok: false, message: "请输入文章链接或粘贴文字内容" });
    if (articleText) { sourceText = articleText; sourceTitle = "用户粘贴文字"; platform = "手动输入"; }
    else {
      try { const article = await extractArticleFromUrl(articleUrl); sourceTitle = article.title; sourceText = article.text; sourceUrl = articleUrl; platform = detectPlatform(articleUrl) === "wechat" ? "微信公众号" : "网页文章"; }
      catch (e) { return res.status(400).json({ ok: false, message: `文章获取失败：${e.message}` }); }
    }
  } else {
    const videoUrl = String(req.body?.videoUrl || req.body?.symbol || "").trim();
    if (!videoUrl) return res.status(400).json({ ok: false, message: "请输入视频链接" });
    sourceUrl = videoUrl; platform = detectPlatform(videoUrl);
    if (platform === "youtube") {
      const videoId = extractYoutubeId(videoUrl);
      if (!videoId) return res.status(400).json({ ok: false, message: "无法解析 YouTube 视频 ID" });
      const info = await getYoutubeVideoInfo(videoId);
      sourceTitle = info.title; sourceAuthor = info.author;
      sourceText = await getYoutubeTranscript(videoId);
      if (!sourceText) return res.status(400).json({ ok: false, message: "该 YouTube 视频没有可用的字幕/文字稿" });
      platform = "YouTube";
    } else if (platform === "bilibili") {
      const vid = extractBilibiliId(videoUrl);
      if (!vid) return res.status(400).json({ ok: false, message: "无法解析 B站视频 ID" });
      const info = await getBilibiliVideoInfo(vid);
      sourceTitle = info.title; sourceAuthor = info.author;
      sourceText = await getBilibiliSubtitle(vid, info.cid);
      if (!sourceText) return res.status(400).json({ ok: false, message: "该 B站视频没有可用字幕" });
      platform = "B站";
    } else if (platform === "wechat") {
      return res.status(400).json({ ok: false, message: "微信视频号暂不支持", suggestMode: "article" });
    } else {
      return res.status(400).json({ ok: false, message: `暂不支持（${platform}）。目前支持：YouTube、B站` });
    }
  }

  const noteText = note ? `\n\n用户额外说明：${note}` : "";
  const maxLen = 15000;
  const trimmedText = sourceText.length > maxLen ? sourceText.substring(0, maxLen) + "\n\n[已截断，原长度 " + sourceText.length + " 字符]" : sourceText;
  const contentType = mode === "article" ? "文章内容" : "视频内容";
  const aiPrompt = `请对以下${contentType}进行总结和深度分析。用中文回复，严格按以下结构：
## 内容概览
简要说明该${mode === "article" ? "文章" : "视频"}的主题和核心内容。
## 📋 核心要点
列出 3-8 个核心观点，每条以"**要点：**"开头。
## 💡 关键结论
总结最终的结论、立场或建议。
## 📊 补充观察
值得关注的细节、数据或案例。
## 🔍 AI 深度分析
从以下角度进行独立分析：
- ✅ 机会信号：正面信号、增长机会、有利因素
- ⚠️ 风险提示：风险、隐患
- 📈 背景补充：背景知识、行业趋势
- 🔗 延伸思考：进一步思考或需要关注的问题
- 🧠 独特见解：你独有的洞察或评价

标题：${escMd(sourceTitle || "未知")}${sourceAuthor ? "\n作者：" + escMd(sourceAuthor) : ""}
原始内容：${trimmedText}${noteText}`;

  const generatedAt = new Date().toISOString();
  const generatedAtLocal = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  let aiResult;
  try { aiResult = await callAI(aiPrompt); }
  catch (e) { return res.status(500).json({ ok: false, message: `AI 调用失败：${e.message}` }); }
  const reportTitle = mode === "article" ? "文章总结分析报告" : "视频总结分析报告";
  const html = buildSummaryHtml({ title: reportTitle, mode, platform, sourceTitle, sourceAuthor, sourceUrl, summary: aiResult.text, generatedAt: generatedAtLocal, provider: aiResult.provider });
  const markdown = `# ${reportTitle}\n\n**平台**：${platform}\n**${mode === "article" ? "文章" : "视频"}**：${sourceTitle}\n**作者**：${sourceAuthor}\n**链接**：${sourceUrl}\n**AI**：${aiResult.provider}\n**生成时间**：${generatedAtLocal}\n\n---\n\n${aiResult.text}`;
  return res.status(200).json({ ok: true, provider: aiResult.provider, status: "已生成", message: `已对"${sourceTitle}"生成总结`, generatedAt, filename: "summary-report.html", html, markdown, summaryText: markdown.replace(/^#{1,6}\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").trim(), meta: { mode, platform, sourceTitle, sourceAuthor, sourceUrl } });
}

/* ═══════════════════ 主处理 ═══════════════════ */

export default async function handler(req, res) {
  if (!securityCheck(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  try {
    const provider = String(req.body?.provider || "deepseek").toLowerCase() === "openai" ? "openai" : "deepseek";
    const mode = String(req.body?.mode || "news-summary");

    // 视频/文章摘要
    if (mode === "video" || mode === "article") return handleVideoArticle(req, res);

    // 日报生成
    if (mode === "daily-report") {
      const prompt = String(req.body?.prompt || "").trim();
      if (!prompt) throw new Error("日报生成缺少 prompt");
      const payload = { reportType: req.body?.reportType || "morning", rawNews: Array.isArray(req.body?.rawNews) ? req.body.rawNews : [], marketSnapshot: req.body?.marketSnapshot || {}, generatedAt: new Date().toISOString() };
      const instructions = "你负责生成卖Put投资者使用的《市场结构日报》。必须严格遵守用户传入的固定模板与章节顺序，不得虚构价格、事件、期权数据或来源。";
      const rawMarkdown = provider === "openai" ? await callOpenAI({ prompt, ...payload }, instructions) : await callDeepSeek({ prompt, ...payload }, instructions);
      const markdown = String(rawMarkdown || "").trim();
      if (!markdown) throw new Error("AI返回内容为空");
      return res.status(200).json({ ok: true, report: { id: "market-daily-" + Date.now(), title: payload.reportType === "evening" ? "每日市场晚报" : "每日市场早报", provider: provider === "openai" ? "GPT" : "DeepSeek", generatedAt: new Date().toISOString(), markdown } });
    }

    // 新闻摘要（默认）
    const news = await loadRecentMarketNews();
    const selected = selectForAI(news.items);
    const payload = { window: "最近24小时", generatedAt: new Date().toISOString(), source: news.sourceLabel || news.source, totalItems: news.items.length, analyzedItems: selected.length, categoryStats: news.categoryStats || {}, items: compactItems(selected) };
    const rawMarkdown = provider === "openai" ? await callOpenAI(payload, newsSystemPrompt()) : await callDeepSeek(payload, newsSystemPrompt());
    const markdown = normalizeReportMarkdown(rawMarkdown);
    if (!markdown.trim()) throw new Error("AI返回内容为空");
    return res.status(200).json({ ok: true, report: { id: "jin10-24h-" + Date.now(), title: "最近24小时市场要闻整理", fileName: fileTimestamp() + "-最近24小时市场要闻整理.md", provider: provider === "openai" ? "GPT" : "DeepSeek", generatedAt: new Date().toISOString(), sourceUpdatedAt: news.updatedAt, sourceLabel: news.sourceLabel || news.source, totalItems: news.items.length, analyzedItems: selected.length, categoryStats: news.categoryStats || {}, markdown } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.name === "AbortError" ? "AI调用超时，请重试" : (error.message || String(error)) });
  }
}
