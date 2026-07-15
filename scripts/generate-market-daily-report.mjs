import fs from 'fs';
import path from 'path';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning', 'evening'].includes(reportType)) throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');

const root = process.cwd();
const outputDir = path.join(root, 'docs/市场');
const statusDir = path.join(outputDir, 'data');
const priceFile = path.join(root, 'stockprice/data/latest-price.json');
const now = new Date();

function hkParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
}

const date = hkParts();
const reportDate = `${date.year}-${date.month}-${date.day}`;
const label = reportType === 'morning' ? '早报' : '晚报';
const latestName = reportType === 'morning' ? '每日市场早报.md' : '每日市场晚报.md';
const archiveName = `${reportDate}市场结构日报(${reportType === 'morning' ? '早8点':'晚8点'}).md`;

const price = fs.existsSync(priceFile) ? JSON.parse(fs.readFileSync(priceFile,'utf8')) : {};

async function callExistingNewsAI() {
  const endpoint = process.env.NEWS_SUMMARY_API || 'https://donew-beta.vercel.app/api/news-summary';
  const r = await fetch(endpoint, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({provider:'deepseek'})
  });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.message || 'news summary api failed');
  return data.report.markdown;
}

function buildPromptSource(newsMarkdown){
 return `请基于以下最近市场新闻整理，生成${label}。\n要求：结论置顶；结合QQQ/QLD、BTC/MSTR、黄金、美元、美债10Y、VIX、半导体、EEM和卖Put风险。不要虚构行情。\n\n新闻整理：\n${newsMarkdown}\n\n行情快照：\n${JSON.stringify(price).slice(0,4000)}`;
}

async function callReportAI(newsMarkdown){
 const endpoint = process.env.NEWS_SUMMARY_API || 'https://donew-beta.vercel.app/api/news-summary';
 const r = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'deepseek',mode:'market-report',prompt:buildPromptSource(newsMarkdown),reportType})});
 const data=await r.json();
 if(!r.ok || !data.ok) throw new Error(data.message || 'report api failed');
 return data.report.markdown;
}

const news = await callExistingNewsAI();
const markdown = await callReportAI(news);
if (!markdown || markdown.length < 500) throw new Error('AI report empty');

fs.mkdirSync(outputDir,{recursive:true});
fs.mkdirSync(statusDir,{recursive:true});
fs.writeFileSync(path.join(outputDir,latestName),markdown+'\n');
fs.writeFileSync(path.join(outputDir,archiveName),markdown+'\n');
fs.writeFileSync(path.join(statusDir,`latest-${reportType}.json`),JSON.stringify({status:'success',reportType,generatedAt:new Date().toISOString()},null,2));
console.log('Generated '+label);
