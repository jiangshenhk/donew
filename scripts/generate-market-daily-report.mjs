import fs from 'fs';
import path from 'path';
import {
  buildMarketReportPrompt,
  loadStrategyBaseline,
  validateCriticalRequirements,
} from '../lib/market-report-core.mjs';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning', 'evening'].includes(reportType)) {
  throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');
}

const root = process.cwd();
const newsFile = path.join(root, 'jin10news/data/latest-24h.json');
const priceFile = path.join(root, 'stockprice/data/latest-price.json');
const outputDir = path.join(root, 'docs/市场');
const statusDir = path.join(outputDir, 'data');
const historyFile = path.join(outputDir, '历史.md');
const todayFile = path.join(outputDir, '今日.md');
const aiEndpoint = process.env.NEWS_SUMMARY_API || 'https://donew-beta.vercel.app/api/news-summary';

if (!fs.existsSync(newsFile)) throw new Error(`Required file missing: ${path.relative(root, newsFile)}`);
const { strategy, strategySource } = loadStrategyBaseline(root);
const newsPayload = JSON.parse(fs.readFileSync(newsFile, 'utf8'));
const pricePayload = fs.existsSync(priceFile) ? JSON.parse(fs.readFileSync(priceFile, 'utf8')) : {};

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
const prompt = buildMarketReportPrompt({ strategy, reportType, news, marketSnapshot: pricePayload });

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
      strategySource,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message || 'AI failed');
  return String(data.report?.markdown || '').trim();
}

function extractSection(text, names) {
  for (const name of names) {
    const boldMatch = text.match(new RegExp(`\\*\\*${name}[：:]\\s*(.+?)\\*\\*`));
    if (boldMatch) return boldMatch[1].replace(/\|/g, '｜').trim().slice(0, 180);

    const headingMatch = text.match(new RegExp(`##?\\s*\\d*[）.)]?\\s*${name}\\s*\\n([^\\n#|]+)`));
    if (headingMatch) return headingMatch[1].replace(/\|/g, '｜').trim().slice(0, 180);

    const paraMatch = text.match(new RegExp(`##?\\s*\\d*[）.)]?\\s*${name}[\\s\\S]*?\\n\\s*\\n`));
    if (paraMatch) return paraMatch[0].replace(/[#\n]/g, ' ').replace(/\|/g, '｜').trim().slice(0, 120);
  }
  return '';
}

function updateHistory(markdown) {
  if (!fs.existsSync(historyFile)) return;
  let text = fs.readFileSync(historyFile, 'utf8');
  const month = `## 📅 ${hkDate.slice(0, 4)}年${Number(hkDate.slice(5, 7))}月`;
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(now).getDay()];
  const core = (extractSection(markdown, ['一句话结论', '本期市场在交易什么']) || '市场结构分析完成').replace(/\|/g, '｜').replace(/\n/g, ' ').slice(0, 120);
  const action = (extractSection(markdown, ['今日动作', '落到我的卖 put 策略', '卖Put策略']) || '按策略规则执行').replace(/\|/g, '｜').replace(/\n/g, ' ').slice(0, 120);
  const link = `[📊 ${label}](/docs/市场/${hkDate}市场结构日报(${label}).md)`;
  const header = '| 日期 | 星期 | 类型 | 报告 | 核心判断 | 策略倾向 |\n|:---|:---|:---|:---|:---|:---|';
  const row = `| **${displayDate}** | ${weekday} | 日报 | ${link} | ${core} | ${action} |`;
  if (text.includes(link)) return;
  if (text.includes(month)) {
    text = text.replace(month, `${month}\n\n${header}\n${row}`);
  } else {
    text += `\n\n---\n\n${month}\n\n${header}\n${row}`;
  }
  fs.writeFileSync(historyFile, text);
}

function updateToday(markdown) {
  const core = extractSection(markdown, ['一句话结论', '本期市场在交易什么']) || '市场结构分析完成';
  const action = extractSection(markdown, ['今日动作', '落到我的卖 put 策略', '卖Put策略']) || '按策略规则执行';
  const link = `[📊 ${hkDate}市场结构日报（${label}）](/docs/市场/${hkDate}市场结构日报(${label}).md)`;
  let text = fs.existsSync(todayFile) ? fs.readFileSync(todayFile, 'utf8') : '# 今日市场结构日报\n';
  const reportKey = `## ${displayDate} ${label}`;
  if (!text.includes(reportKey)) {
    text += `\n## ${displayDate} ${label}\n\n- 核心判断：${core}\n- 策略倾向：${action}\n`;
  }
  const latestSection = text.match(/## 最新报告[\s\S]*?(?=\n## |\n$|$)/);
  if (latestSection) {
    if (!latestSection[0].includes(hkDate + label)) {
      const newLinks = latestSection[0] + `\n${link}\n`;
      text = text.replace(latestSection[0], newLinks);
    }
  } else {
    text = text.replace(/\n---/, `\n## 最新报告\n\n${link}\n\n---`);
  }
  fs.writeFileSync(todayFile, text);
}

const markdown = await callAI();
validateCriticalRequirements(markdown);
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(statusDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, reportType === 'morning' ? '每日市场早报.md' : '每日市场晚报.md'), `${markdown}\n`);
fs.writeFileSync(path.join(outputDir, `${hkDate}市场结构日报(${label}).md`), `${markdown}\n`);
updateHistory(markdown);
updateToday(markdown);
fs.writeFileSync(
  path.join(statusDir, `latest-${reportType}.json`),
  JSON.stringify({ status: 'success', reportType, generatedAt: new Date().toISOString(), strategySource }, null, 2),
);
console.log(`Generated ${label} with shared core: ${strategySource}`);
