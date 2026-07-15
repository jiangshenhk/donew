import fs from 'fs';
import path from 'path';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning','evening'].includes(reportType)) throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');

const root = process.cwd();
const newsFile = path.join(root,'jin10news/data/latest-24h.json');
const priceFile = path.join(root,'stockprice/data/latest-price.json');
const outputDir = path.join(root,'docs/市场');
const statusDir = path.join(outputDir,'data');

const newsPayload = JSON.parse(fs.readFileSync(newsFile,'utf8'));
const pricePayload = fs.existsSync(priceFile) ? JSON.parse(fs.readFileSync(priceFile,'utf8')) : {};
const now = new Date();

const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
const news = (newsPayload.items || [])
  .filter(x => Date.parse(x.time) >= cutoff)
  .map(x => ({time:x.time,categories:x.categories || [],content:x.content}))
  .slice(0,250);

if (!news.length) throw new Error('No valid 48h news');

const hk = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const label = reportType === 'morning' ? '早报' : '晚报';

const sessionInstruction = reportType === 'morning'
 ? '重点分析隔夜美股收盘、盘前风险，以及今天交易准备。'
 : '重点分析亚洲欧洲交易变化、当天新增风险，以及今晚美股盘前准备。';

const prompt = `你是服务卖Put投资者的跨资产市场分析师。
请严格按照历史《市场结构日报》格式生成${label}，不要创造新的章节。
${sessionInstruction}

必须保持以下固定结构：
# 📊 市场结构日报
日期时间窗口
一句话结论
市场阶段/资金流向/风险评分表
## 1. 资金流向异动｜今日最重要变化
## 2. 策略矩阵
## 3. 资金联动｜谁在说真话
## 4. 宏观资产观察
## 5. 风险资产表现
## 6. 驱动拆解
## 7. 卖Put策略
### QLD
### MSTR
### INTC
## 8. 今日动作
## 最后的话
## 数据来源

逻辑要求：
1. 不复述新闻，要判断市场正在交易什么。
2. 结论必须置顶。
3. 必须分析QQQ/QLD、BTC/MSTR、黄金、美元、美债10Y、VIX、半导体、EEM。
4. 卖Put判断必须延续人工日报逻辑：风险评分高则等待，不追strike，不虚构期权数据。
5. 不允许虚构价格和数据。
6. 输出Markdown。

原始48小时新闻：
${JSON.stringify(news)}

行情快照：
${JSON.stringify(pricePayload).slice(0,8000)}`;

async function callAI(){
  const endpoint = process.env.MARKET_REPORT_API || 'https://donew-beta.vercel.app/api/market-report';
  const r = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reportType,provider:'deepseek',rawNews:news,prompt,marketSnapshot:pricePayload})});
  const data = await r.json();
  if(!r.ok || !data.ok) throw new Error(data.message || 'AI report failed');
  return data.report.markdown;
}

const markdown = await callAI();
if (!markdown || markdown.length < 1000) throw new Error('Invalid report');

fs.mkdirSync(outputDir,{recursive:true});
fs.mkdirSync(statusDir,{recursive:true});
const latest = reportType==='morning'?'每日市场早报.md':'每日市场晚报.md';
const archive = `${hk}市场结构日报(${label}).md`;
fs.writeFileSync(path.join(outputDir,latest),markdown+'\n');
fs.writeFileSync(path.join(outputDir,archive),markdown+'\n');
fs.writeFileSync(path.join(statusDir,`latest-${reportType}.json`),JSON.stringify({status:'success',reportType,generatedAt:new Date().toISOString(),newsCount:news.length},null,2));
console.log('Generated '+label);
