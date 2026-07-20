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

function formatDateKey(timestampMs,timeZone){
 try{
  return new Intl.DateTimeFormat('en-CA',{timeZone:timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestampMs));
 }catch{
  return new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestampMs));
 }
}

function dailyBars(result,timeZone){
 const timestamps=result?.timestamp||[];
 const closes=result?.indicators?.quote?.[0]?.close||[];
 const bars=[];
 for(let i=0;i<Math.min(timestamps.length,closes.length);i+=1){
  const close=numberOrNull(closes[i]);
  const ts=numberOrNull(timestamps[i]);
  if(close===null||ts===null) continue;
  bars.push({
   timestamp:ts,
   close,
   dateKey:formatDateKey(ts*1000,timeZone),
  });
 }
 return bars;
}

function previousTradingClose(result,meta){
 const timeZone=meta?.exchangeTimezoneName || 'UTC';
 const bars=dailyBars(result,timeZone);
 if(!bars.length) return {value:null,source:'missing-bars',latestBarDate:'',marketDate:'',previousCloseDate:''};
 const marketTime=numberOrNull(meta?.regularMarketTime);
 const marketDate=marketTime ? formatDateKey(marketTime*1000,timeZone) : '';
 const latestBar=bars[bars.length-1];
 const previousBar=bars.length>=2 ? bars[bars.length-2] : null;
 if(marketDate && marketDate===latestBar.dateKey){
  return {
   value:previousBar?.close ?? latestBar.close ?? null,
   source:'previous-bar-before-market-date',
   latestBarDate:latestBar.dateKey,
   marketDate,
   previousCloseDate:previousBar?.dateKey ?? latestBar.dateKey,
  };
 }
 return {
  value:latestBar.close ?? null,
  source:'latest-bar-before-market-date',
  latestBarDate:latestBar.dateKey,
  marketDate,
  previousCloseDate:latestBar.dateKey,
  };
}

function resolvePreviousClose(result,meta){
 const barBased=previousTradingClose(result,meta);
 const directCandidates=[
  numberOrNull(meta?.chartPreviousClose),
  numberOrNull(meta?.previousClose),
  numberOrNull(meta?.regularMarketPreviousClose),
 ].filter((value)=>value!==null);
 const direct=directCandidates.length ? directCandidates[0] : null;
 if(direct===null){
  return barBased;
 }
 if(barBased.value===null){
  return {
   ...barBased,
   value:direct,
   source:'direct-previous-close-no-bar-check',
  };
 }
 const diff=Math.abs(direct-barBased.value);
 const tolerance=Math.max(0.02,Math.abs(barBased.value)*0.002);
 if(diff<=tolerance){
  return {
   ...barBased,
   value:direct,
   source:'direct-previous-close-validated',
  };
 }
 return {
  ...barBased,
  source:`bar-derived-override-direct(${direct})`,
 };
}

function resolveChangePercent(price,previousClose){
  if(price!==null&&previousClose!==null&&previousClose!==0){
   return {value:((price-previousClose)/previousClose)*100,source:'price-vs-previous-daily-close'};
  }
  return {value:null,source:'missing'};
}

function calcSMA(bars, n){
  if(!bars.length||n<1) return null;
  const closes=bars.slice(-n).map(b=>b.close).filter(c=>c!==null);
  if(closes.length<n) return null;
  return closes.reduce((a,b)=>a+b,0)/closes.length;
}

function calcVsPct(price, sma){
  if(price===null||sma===null||sma===0) return null;
  return ((price-sma)/sma)*100;
}

async function fetchPrice(item,retry=2){
 const symbol=typeof item==='string'?item:item.symbol;
 const category=typeof item==='string'?'Unknown':item.category;
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=21d&interval=1d&events=history&includePrePost=false`;
 try{
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 donew-stockprice'}});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json=await res.json();
  const result=json?.chart?.result?.[0];
  const meta=result?.meta||{};
  if(!result) throw new Error('No chart data');
   const price=numberOrNull(meta.regularMarketPrice) ?? latestClose(result);
   const bars=dailyBars(result,meta?.exchangeTimezoneName||'UTC');
   const sma5=calcSMA(bars,5);
   const sma10=calcSMA(bars,10);
   const vs5Pct=calcVsPct(price,sma5);
   const vs10Pct=calcVsPct(price,sma10);
   const previous=resolvePreviousClose(result,meta);
   const previousClose=previous.value;
   const change=resolveChangePercent(price,previousClose);
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
    changePercentSource:change.source,
    previousCloseSource:previous.source,
    previousCloseDate:previous.previousCloseDate,
    latestBarDate:previous.latestBarDate,
    marketDate:previous.marketDate,
    sma5:sma5??null,
    sma10:sma10??null,
    vs5Pct:vs5Pct!=null?Number(vs5Pct).toFixed(2):null,
    vs10Pct:vs10Pct!=null?Number(vs10Pct).toFixed(2):null,
    barCount:bars.length
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
  const keySymbols=['QQQ','SPY','IWM','QLD','SMH','SOXX','BTC-USD','^VIX','^TNX','^2YR','MSTR','INTC','CL=F','GC=F','EEM'];
  for(const item of data){
   if(keySymbols.includes(item.symbol)){
    console.log(`${item.symbol}: price=${item.price} sma5=${item.sma5} sma10=${item.sma10} vs5=${item.vs5Pct}% vs10=${item.vs10Pct}% bars=${item.barCount}`);
   }
  }
}
main();
