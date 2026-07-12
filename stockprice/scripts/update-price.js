// Stock Price Center updater
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const symbolsFile = path.join(ROOT, 'config', 'symbols.json');
const outputFile = path.join(ROOT, 'data', 'latest-price.json');

async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function fetchPrice(item,retry=2){
 const symbol=typeof item==='string'?item:item.symbol;
 const category=typeof item==='string'?'Unknown':item.category;
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
 try{
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 donew-stockprice'}});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json=await res.json();
  const meta=json.chart.result[0].meta||{};
  return {symbol,category,price:meta.regularMarketPrice??null,previousClose:meta.chartPreviousClose??null,changePercent:meta.chartPreviousClose&&meta.regularMarketPrice?((meta.regularMarketPrice-meta.chartPreviousClose)/meta.chartPreviousClose*100).toFixed(2):null,marketTime:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString():null,currency:meta.currency??null,exchange:meta.exchangeName??null};
 }catch(e){
  if(retry>0){await sleep(2000);return fetchPrice(item,retry-1);}
  return {symbol,category,error:e.message};
 }
}

async function main(){
 const config=JSON.parse(fs.readFileSync(symbolsFile,'utf8'));
 const old=fs.existsSync(outputFile)?JSON.parse(fs.readFileSync(outputFile,'utf8')):{};
 const data=[];
 for(const item of config.symbols){data.push(await fetchPrice(item));await sleep(1000);}
 const successCount=data.filter(x=>!x.error).length;
 const failCount=data.length-successCount;
 const now=new Date().toISOString();
 const oldData=JSON.stringify(old.data||[]);
 const newData=JSON.stringify(data);
 const updatedAt=oldData===newData&&old.updatedAt?old.updatedAt:now;
 fs.mkdirSync(path.dirname(outputFile),{recursive:true});
 fs.writeFileSync(outputFile,JSON.stringify({updatedAt,checkedAt:now,successCount,failCount,data},null,2));
 console.log(`Saved ${data.length} symbols success=${successCount} fail=${failCount}`);
}
main();