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

function numberOrNull(value){
 if(value===null||value===undefined||value==='') return null;
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}

function latestClose(result){
 const closes=result?.indicators?.quote?.[0]?.close||[];
 for(let i=closes.length-1;i>=0;i-=1){
  const value=numberOrNull(closes[i]);
  if(value!==null) return value;
 }
 return null;
}

function resolveChangePercent(meta,price,previousClose){
 const direct=numberOrNull(meta?.regularMarketChangePercent);
 if(direct!==null) return {value:direct,source:'yahoo-chart-direct'};
 if(price!==null&&previousClose!==null&&previousClose!==0){
  return {value:((price-previousClose)/previousClose)*100,source:'yahoo-chart-fallback'};
 }
 return {value:null,source:'missing'};
}

async function fetchPrice(item,retry=2){
 const symbol=typeof item==='string'?item:item.symbol;
 const category=typeof item==='string'?'Unknown':item.category;
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&events=history&includePrePost=false`;
 try{
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 donew-stockprice'}});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json=await res.json();
  const result=json?.chart?.result?.[0];
  const meta=result?.meta||{};
  if(!result) throw new Error('No chart data');
  const price=numberOrNull(meta.regularMarketPrice) ?? latestClose(result);
  const previousClose=numberOrNull(meta.chartPreviousClose) ?? numberOrNull(meta.previousClose) ?? numberOrNull(meta.regularMarketPreviousClose);
  const change=resolveChangePercent(meta,price,previousClose);
  return {
   symbol,
   category,
   price:price??null,
   previousClose:previousClose??null,
   changePercent:change.value==null?null:Number(change.value).toFixed(2),
   marketTime:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString():null,
   currency:meta.currency??null,
   exchange:meta.fullExchangeName??meta.exchangeName??null,
   marketState:meta.marketState??null,
   quoteSource:'yahoo-chart',
   changePercentSource:change.source
  };
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
