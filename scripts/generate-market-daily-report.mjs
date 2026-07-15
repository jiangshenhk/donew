import fs from 'fs';
import path from 'path';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning','evening'].includes(reportType)) throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');

const root = process.cwd();
const newsFile = path.join(root,'jin10news/data/latest-24h.json');
const priceFile = path.join(root,'stockprice/data/latest-price.json');
const outputDir = path.join(root,'docs/市场');
const statusDir = path.join(outputDir,'data');
const historyFile = path.join(outputDir,'历史.md');
const todayFile = path.join(outputDir,'今日.md');
const aiEndpoint = process.env.NEWS_SUMMARY_API || 'https://donew-beta.vercel.app/api/news-summary';

const newsPayload = JSON.parse(fs.readFileSync(newsFile,'utf8'));
const pricePayload = fs.existsSync(priceFile) ? JSON.parse(fs.readFileSync(priceFile,'utf8')) : {};
const now = new Date();
const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
const news = (newsPayload.items || []).filter(x=>Date.parse(x.time)>=cutoff).map(x=>({time:x.time,categories:x.categories||[],content:x.content})).slice(0,250);
if (!news.length) throw new Error('No valid 48h news');

const hkDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const displayDate = `${hkDate.slice(5,7)}月${Number(hkDate.slice(8,10))}日`;
const label = reportType==='morning'?'早报':'晚报';

const prompt = `你是服务卖Put投资者的跨资产市场分析师。严格按照历史《市场结构日报》格式生成${label}。保持章节：# 📊 市场结构日报、一句话结论、策略矩阵、资金联动、宏观资产观察、风险资产表现、驱动拆解、卖Put策略、今日动作、最后的话。
${reportType==='morning'?'重点分析隔夜美股收盘和今日交易准备。':'重点分析亚洲欧洲交易变化和今晚美股准备。'}

新闻：${JSON.stringify(news)}
行情：${JSON.stringify(pricePayload).slice(0,8000)}`;

async function callAI(){
 const r=await fetch(aiEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'daily-report',reportType,provider:'deepseek',rawNews:news,prompt,marketSnapshot:pricePayload})});
 const data=await r.json();
 if(!r.ok||!data.ok) throw new Error(data.message||'AI failed');
 return String(data.report.markdown||'').trim();
}

function extractSection(text, names){
 for(const n of names){
  const m=text.match(new RegExp(`##?\\s*${n}[\\s\\S]*?(?=\\n##|$)`));
  if(m) return m[0].replace(/[#\n]/g,' ').trim().slice(0,180);
 }
 return '';
}

function updateHistory(markdown){
 if(!fs.existsSync(historyFile)) return;
 let text=fs.readFileSync(historyFile,'utf8');
 const month=`## 📅 ${hkDate.slice(0,4)}年${Number(hkDate.slice(5,7))}月`;
 const weekday=['日','一','二','三','四','五','六'][new Date(now).getDay()];
 const core=extractSection(markdown,['一句话结论']) || '市场结构分析完成';
 const action=extractSection(markdown,['今日动作','卖Put策略']) || '按策略规则执行';
 const link=`[📊 ${label}](/docs/市场/${hkDate}市场结构日报(${label}).md)`;
 const row=`| **${displayDate}** | ${weekday} | 日报 | ${link} | ${core} | ${action} |`;
 if(text.includes(link)) return;
 if(text.includes(month)) text=text.replace(month,month+'\n\n'+row);
 else text += `\n\n---\n\n${month}\n\n${row}`;
 fs.writeFileSync(historyFile,text);
}

function updateToday(markdown){
 const core=extractSection(markdown,['一句话结论']) || '市场结构分析完成';
 const action=extractSection(markdown,['今日动作','卖Put策略']) || '按策略规则执行';
 const section=`\n## ${displayDate} ${label}\n\n- 核心判断：${core}\n- 策略倾向：${action}\n`;
 let text=fs.existsSync(todayFile)?fs.readFileSync(todayFile,'utf8'): '# 今日市场记录\n';
 const key=`## ${displayDate} ${label}`;
 if(!text.includes(key)) text += section;
 fs.writeFileSync(todayFile,text);
}

const markdown=await callAI();
if(!markdown||markdown.length<1000) throw new Error('Invalid report');
fs.mkdirSync(outputDir,{recursive:true});
fs.mkdirSync(statusDir,{recursive:true});
fs.writeFileSync(path.join(outputDir,reportType==='morning'?'每日市场早报.md':'每日市场晚报.md'),markdown+'\n');
fs.writeFileSync(path.join(outputDir,`${hkDate}市场结构日报(${label}).md`),markdown+'\n');
updateHistory(markdown);
updateToday(markdown);
fs.writeFileSync(path.join(statusDir,`latest-${reportType}.json`),JSON.stringify({status:'success',reportType,generatedAt:new Date().toISOString()},null,2));
console.log('Generated '+label);