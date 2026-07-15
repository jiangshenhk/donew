import fs from 'fs';
import path from 'path';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning','evening'].includes(reportType)) throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');

const root = process.cwd();
const newsFile = path.join(root,'jin10news/data/latest-24h.json');
const priceFile = path.join(root,'stockprice/data/latest-price.json');
const outputDir = path.join(root,'docs/市场');
const statusDir = path.join(outputDir,'data');
const now = new Date();

if (!fs.existsSync(newsFile)) throw new Error('Missing raw news file');
const newsPayload = JSON.parse(fs.readFileSync(newsFile,'utf8'));
const pricePayload = fs.existsSync(priceFile) ? JSON.parse(fs.readFileSync(priceFile,'utf8')) : {};

const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
const news = (newsPayload.items || [])
  .filter(x => Date.parse(x.time) >= cutoff)
  .map(x => ({time:x.time,categories:x.categories || [],content:x.content}))
  .slice(0,250);

if (!news.length) throw new Error('No valid 48h news');

const hk = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const label = reportType === 'morning' ? '早报' : '晚报';

const prompt = `你是服务卖Put投资者的跨资产市场分析师。
请根据以下48小时原始新闻和行情快照生成${label}。

要求：
1. 不要复述新闻，要判断市场正在交易什么。
2. 结论置顶。
3. 分析QQQ/QLD、BTC/MSTR、黄金、美元、美债10Y、VIX、半导体、EEM。
4. 结合卖Put环境：风险、等待条件、适合观察的方向。
5. 不允许虚构价格和数据。
6. 输出Markdown。

原始新闻：
${JSON.stringify(news)}

行情：
${JSON.stringify(pricePayload).slice(0,5000)}`;

async function callAI(){
  const endpoint = process.env.MARKET_REPORT_API || 'https://donew-beta.vercel.app/api/market-report';
  const r = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reportType,provider:'deepseek',rawNews:news,prompt})});
  const data = await r.json();
  if(!r.ok || !data.ok) throw new Error(data.message || 'AI report failed');
  return data.report.markdown;
}

const markdown = await callAI();
if (!markdown || markdown.length < 500) throw new Error('Empty report');

fs.mkdirSync(outputDir,{recursive:true});
fs.mkdirSync(statusDir,{recursive:true});
const latest = reportType==='morning'?'每日市场早报.md':'每日市场晚报.md';
const archive = `${hk}市场结构日报(${label}).md`;
fs.writeFileSync(path.join(outputDir,latest),markdown+'\n');
fs.writeFileSync(path.join(outputDir,archive),markdown+'\n');
fs.writeFileSync(path.join(statusDir,`latest-${reportType}.json`),JSON.stringify({status:'success',reportType,generatedAt:new Date().toISOString(),newsCount:news.length},null,2));
console.log('Generated '+label);
