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

function pickQuotePhase(quote){
 const state=String(quote?.marketState||'').toUpperCase();
 if(state.includes('POST') && quote?.postMarketPrice!=null) return 'post';
 if(state.includes('PRE') && quote?.preMarketPrice!=null) return 'pre';
 return 'regular';
}

function latestPriceFromQuote(quote,phase){
 if(!quote) return null;
 if(phase==='regular' && quote.regularMarketPrice!=null) return quote.regularMarketPrice;
 if(phase==='pre' && quote.preMarketPrice!=null) return quote.preMarketPrice;
 if(phase==='post' && quote.postMarketPrice!=null) return quote.postMarketPrice;
 return quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? null;
}

function latestChangePercentFromQuote(quote,phase){
 if(!quote) return null;
 if(phase==='regular' && quote.regularMarketChangePercent!=null) return quote.regularMarketChangePercent;
 if(phase==='pre' && quote.preMarketChangePercent!=null) return quote.preMarketChangePercent;
 if(phase==='post' && quote.postMarketChangePercent!=null) return quote.postMarketChangePercent;
 return quote.regularMarketChangePercent ?? quote.postMarketChangePercent ?? quote.preMarketChangePercent ?? null;
}

function dayChangePercentFromQuote(quote){
 if(!quote) return null;
 return quote.regularMarketChangePercent ?? null;
}

function latestMarketTimeFromQuote(quote,phase){
 const seconds=
  phase==='post' ? quote?.postMarketTime :
  phase==='pre' ? quote?.preMarketTime :
  quote?.regularMarketTime;
 return seconds ? new Date(seconds*1000).toISOString() : null;
}

async function fetchPrice(item,retry=2){
 const symbol=typeof item==='string'?item:item.symbol;
 const category=typeof item==='string'?'Unknown':item.category;
 const url=`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
 try{
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 donew-stockprice'}});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json=await res.json();
  const quote=(json.quoteResponse?.result||[])[0];
  if(!quote) throw new Error('No quote data');
  const phase=pickQuotePhase(quote);
  const price=latestPriceFromQuote(quote,phase);
  const dayChangePercent=dayChangePercentFromQuote(quote);
  return {
   symbol,
   category,
   price:price??null,
   previousClose:quote.regularMarketPreviousClose??quote.regularMarketOpen??null,
   changePercent:dayChangePercent==null?null:Number(dayChangePercent).toFixed(2),
   marketTime:latestMarketTimeFromQuote(quote,phase),
   currency:quote.currency??null,
   exchange:quote.fullExchangeName??quote.exchange??quote.exchangeName??null,
   marketState:quote.marketState??null,
   quoteSource:'yahoo-quote',
   pricePhase:phase
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
