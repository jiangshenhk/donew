import fs from 'fs';
import path from 'path';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning', 'evening'].includes(reportType)) {
  throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');
}
if (!process.env.DEEPSEEK_API_KEY) throw new Error('Missing DEEPSEEK_API_KEY');

const root = process.cwd();
const newsFile = path.join(root, 'jin10news/data/latest-24h.json');
const priceFile = path.join(root, 'stockprice/data/latest-price.json');
const outputDir = path.join(root, 'docs/市场');
const statusDir = path.join(outputDir, 'data');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const newsPayload = readJson(newsFile);
const pricePayload = fs.existsSync(priceFile) ? readJson(priceFile) : { data: [] };
const now = new Date();

function zonedParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

const hk = zonedParts(now);
const reportDate = `${hk.year}-${hk.month}-${hk.day}`;
const isWeekend = hk.weekday === 'Sat' || hk.weekday === 'Sun';
if (isWeekend && process.env.FORCE_RUN !== 'true') {
  console.log('Weekend in Hong Kong, skip daily report.');
  process.exit(0);
}

const label = reportType === 'morning' ? '早报' : '晚报';
const fileSuffix = reportType === 'morning' ? '早8点' : '晚8点';
const latestFileName = reportType === 'morning' ? '每日市场早报.md' : '每日市场晚报.md';
const archiveFileName = `${reportDate}市场结构日报(${fileSuffix}).md`;
const latestFile = path.join(outputDir, latestFileName);
const archiveFile = path.join(outputDir, archiveFileName);
const statusFile = path.join(statusDir, `latest-${reportType}.json`);

const cutoff48h = now.getTime() - 48 * 60 * 60 * 1000;
const allNews = (Array.isArray(newsPayload.items) ? newsPayload.items : [])
  .filter(item => Date.parse(item.time) >= cutoff48h)
  .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
if (!allNews.length) throw new Error('48-hour news cache is empty; refuse to overwrite report.');

const focusHours = reportType === 'morning' ? 16 : 14;
const importantPattern = /美联储|央行|利率|收益率|通胀|CPI|PCE|非农|就业|关税|特朗普|战争|制裁|原油|黄金|比特币|BTC|纳指|标普|财报|芯片|半导体|AI|暴跌|暴涨|熔断|违约/u;
const selectedNews = [];
const used = new Set();
const add = item => {
  const key = item.id || `${item.time}|${item.content}`;
  if (!used.has(key) && selectedNews.length < 320) {
    used.add(key);
    selectedNews.push(item);
  }
};
allNews.filter(item => now.getTime() - Date.parse(item.time) <= focusHours * 3600000).slice(0, 180).forEach(add);
allNews.filter(item => importantPattern.test(item.content || '')).slice(0, 180).forEach(add);
allNews.forEach(add);
selectedNews.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

const marketRows = (Array.isArray(pricePayload.data) ? pricePayload.data : []).map(item => ({
  symbol: item.symbol,
  price: item.price,
  previousClose: item.previousClose,
  changePercent: item.changePercent,
  marketTime: item.marketTime,
  currency: item.currency,
  exchange: item.exchange
}));

const systemPrompt = `你是一名为卖Put交易者服务的中文跨资产市场分析师。请生成${label}，严格只使用输入的48小时新闻和行情快照，不得虚构价格、事件、均线、期权Delta、IV或成交量。\n\n报告要求：\n1. 结论置顶，先写一句话结论，并给出市场阶段、资金流向、风险评分（0-10，越高越危险）。\n2. 新闻必须合并同类事件，不逐条复述；区分事实、推断和待确认事项。\n3. 重点分析 QQQ/QLD、BTC/MSTR、黄金、美元、美债10Y、VIX、半导体、EEM，以及卖Put环境。\n4. 早报重点复盘隔夜美股并给出当日准备；晚报重点分析亚洲/欧洲时段变化与美股盘前风险。\n5. 若行情数据缺失或较旧，必须明确标注，禁止补猜。\n6. 输出Markdown，采用以下固定结构：\n# 📊 市场结构日报\n日期与香港时间${label}说明\n> 数据口径与风险提示\n## 1）本期市场在交易什么？\n## 2）资金流向异动｜最重要变化\n## 3）策略矩阵\n## 4）资金流向与资产联动\n## 5）宏观资产数据\n## 6）风险资产表现\n## 7）新闻驱动拆解\n## 8）卖Put执行条件\n## 9）未来24小时观察清单\n最后注明：本内容为市场研究记录，不构成投资建议。\n\n策略矩阵至少包含 QQQ/QLD、MSTR/BTC、EEM、INTC、黄金；卖Put判断只能使用“可观察、等待确认、远OTM小仓、暂不参与”等风险语言，不得虚构具体期权报价。`;

const userPayload = {
  reportType,
  reportDate,
  generatedAt: now.toISOString(),
  timezone: 'Asia/Hong_Kong',
  newsWindowHours: 48,
  sourceUpdatedAt: newsPayload.updatedAt || newsPayload.checkedAt || '',
  totalNewsCount: allNews.length,
  analyzedNewsCount: selectedNews.length,
  news: selectedNews.map(item => ({
    time: item.time,
    categories: item.categories || [],
    content: String(item.content || '').slice(0, 420)
  })),
  marketSnapshot: {
    updatedAt: pricePayload.updatedAt || '',
    checkedAt: pricePayload.checkedAt || '',
    successCount: pricePayload.successCount,
    failCount: pricePayload.failCount,
    data: marketRows
  }
};

async function callDeepSeek() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ],
        temperature: 0.2,
        max_tokens: 7000
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${data.error?.message || 'request failed'}`);
    return String(data.choices?.[0]?.message?.content || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

function validate(markdown) {
  const required = ['# 📊 市场结构日报', '## 1）', '## 3）策略矩阵', '## 8）卖Put执行条件', '## 9）未来24小时观察清单'];
  if (markdown.length < 1800) throw new Error(`Report too short: ${markdown.length}`);
  for (const section of required) {
    if (!markdown.includes(section)) throw new Error(`Missing required section: ${section}`);
  }
}

const markdown = await callDeepSeek();
validate(markdown);
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(statusDir, { recursive: true });
fs.writeFileSync(latestFile, markdown + '\n', 'utf8');
fs.writeFileSync(archiveFile, markdown + '\n', 'utf8');
fs.writeFileSync(statusFile, JSON.stringify({
  reportType,
  label,
  reportDate,
  generatedAt: now.toISOString(),
  sourceUpdatedAt: newsPayload.updatedAt || newsPayload.checkedAt || '',
  marketUpdatedAt: pricePayload.updatedAt || '',
  totalNewsCount: allNews.length,
  analyzedNewsCount: selectedNews.length,
  archiveFile: `docs/市场/${archiveFileName}`,
  latestFile: `docs/市场/${latestFileName}`,
  status: 'success'
}, null, 2) + '\n', 'utf8');

console.log(`Generated ${label}: ${archiveFileName}`);
