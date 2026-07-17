import fs from 'fs';
import path from 'path';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning', 'evening'].includes(reportType)) {
  throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');
}

const root = process.cwd();
const newsFile = path.join(root, 'jin10news/data/latest-24h.json');
const priceFile = path.join(root, 'stockprice/data/latest-price.json');
const strategyFile = path.join(root, 'docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md');
const outputDir = path.join(root, 'docs/市场');
const statusDir = path.join(outputDir, 'data');
const historyFile = path.join(outputDir, '历史.md');
const todayFile = path.join(outputDir, '今日.md');
const aiEndpoint = process.env.NEWS_SUMMARY_API || 'https://donew-beta.vercel.app/api/news-summary';

for (const requiredFile of [newsFile, strategyFile]) {
  if (!fs.existsSync(requiredFile)) throw new Error(`Required file missing: ${path.relative(root, requiredFile)}`);
}

const newsPayload = JSON.parse(fs.readFileSync(newsFile, 'utf8'));
const pricePayload = fs.existsSync(priceFile) ? JSON.parse(fs.readFileSync(priceFile, 'utf8')) : {};
const strategyPrompt = fs.readFileSync(strategyFile, 'utf8').trim();
if (strategyPrompt.length < 1000) throw new Error(`Strategy prompt too short: ${strategyPrompt.length}`);

const now = new Date();
const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
const news = (newsPayload.items || [])
  .filter(item => Date.parse(item.time) >= cutoff)
  .map(item => ({ time: item.time, categories: item.categories || [], content: item.content }))
  .slice(0, 250);
if (!news.length) throw new Error('No valid 48h news');

const hkDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);
const displayDate = `${hkDate.slice(5, 7)}月${Number(hkDate.slice(8, 10))}日`;
const label = reportType === 'morning' ? '早报' : '晚报';
const sessionInstruction = reportType === 'morning'
  ? '重点分析隔夜美股收盘、盘后变化和今日交易准备。'
  : '重点分析亚洲与欧洲交易时段变化，以及今晚美股开盘前的交易准备。';

const prompt = `${strategyPrompt}

---

# 本次执行要求

- 报告类型：${label}
- ${sessionInstruction}
- 必须明确覆盖 QLD、MSTR、INTC；即使没有交易机会，也必须写明“观察、暂停或不适合”。
- 核心市场维度必须覆盖：大盘、10Y、VIX、BTC。
- 不得编造期权链、Strike、Delta、IV、OI 或成交数据。
- 输出完整 Markdown 正文，不要解释提示词，也不要输出代码围栏。

新闻：${JSON.stringify(news)}
行情：${JSON.stringify(pricePayload).slice(0, 12000)}`;

async function callAI() {
  const response = await fetch(aiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'daily-report',
      reportType,
      provider: 'deepseek',
      rawNews: news,
      prompt,
      marketSnapshot: pricePayload,
      strategySource: path.relative(root, strategyFile),
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message || 'AI failed');
  return String(data.report?.markdown || '').trim();
}

function extractSection(text, names) {
  for (const name of names) {
    const match = text.match(new RegExp(`##?\\s*${name}[\\s\\S]*?(?=\\n##|$)`));
    if (match) return match[0].replace(/[#\n]/g, ' ').trim().slice(0, 180);
  }
  return '';
}

function updateHistory(markdown) {
  if (!fs.existsSync(historyFile)) return;
  let text = fs.readFileSync(historyFile, 'utf8');
  const month = `## 📅 ${hkDate.slice(0, 4)}年${Number(hkDate.slice(5, 7))}月`;
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(now).getDay()];
  const core = extractSection(markdown, ['一句话结论', '本期市场在交易什么']) || '市场结构分析完成';
  const action = extractSection(markdown, ['今日动作', '落到我的卖 put 策略', '卖Put策略']) || '按策略规则执行';
  const link = `[📊 ${label}](/docs/市场/${hkDate}市场结构日报(${label}).md)`;
  const row = `| **${displayDate}** | ${weekday} | 日报 | ${link} | ${core} | ${action} |`;
  if (text.includes(link)) return;
  if (text.includes(month)) text = text.replace(month, `${month}\n\n${row}`);
  else text += `\n\n---\n\n${month}\n\n${row}`;
  fs.writeFileSync(historyFile, text);
}

function updateToday(markdown) {
  const core = extractSection(markdown, ['一句话结论', '本期市场在交易什么']) || '市场结构分析完成';
  const action = extractSection(markdown, ['今日动作', '落到我的卖 put 策略', '卖Put策略']) || '按策略规则执行';
  const section = `\n## ${displayDate} ${label}\n\n- 核心判断：${core}\n- 策略倾向：${action}\n`;
  let text = fs.existsSync(todayFile) ? fs.readFileSync(todayFile, 'utf8') : '# 今日市场记录\n';
  const key = `## ${displayDate} ${label}`;
  if (!text.includes(key)) text += section;
  fs.writeFileSync(todayFile, text);
}

const markdown = await callAI();
if (!markdown || markdown.length < 1000) throw new Error(`Invalid report: ${markdown.length}`);
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(statusDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, reportType === 'morning' ? '每日市场早报.md' : '每日市场晚报.md'), `${markdown}\n`);
fs.writeFileSync(path.join(outputDir, `${hkDate}市场结构日报(${label}).md`), `${markdown}\n`);
updateHistory(markdown);
updateToday(markdown);
fs.writeFileSync(
  path.join(statusDir, `latest-${reportType}.json`),
  JSON.stringify({
    status: 'success',
    reportType,
    generatedAt: new Date().toISOString(),
    strategySource: path.relative(root, strategyFile),
  }, null, 2),
);
console.log(`Generated ${label} with strategy: ${path.relative(root, strategyFile)}`);
