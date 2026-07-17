// 行情更新程序
// 由 GitHub Actions 定时调用

const SYMBOLS = [
  "QQQ", "SPY", "IWM", "QLD", "TQQQ",
  "SMH", "SOXX", "MAGS",
  "EEM", "FXI", "KWEB",
  "^VIX", "VIXY",
  "IBIT", "BTC-USD", "MSTR",
  "DX-Y.NYB", "^TNX", "JPY=X",
  "CL=F", "GC=F",
  "INTC", "HOOD"
];

const fs = require("fs/promises");

async function sleep(ms){
  return new Promise(r=>setTimeout(r,ms));
}

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

async function fetchQuote(symbol){
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&events=history&includePrePost=false`;

  const res = await fetch(url, {
    headers:{"User-Agent":"Mozilla/5.0"}
  });

  if(!res.ok) throw new Error(`${symbol}: ${res.status}`);

  const json = await res.json();
  const result=json?.chart?.result?.[0];
  const meta=result?.meta||{};
  if(!result) throw new Error(`${symbol}: no chart data`);
  const price=numberOrNull(meta.regularMarketPrice) ?? latestClose(result);
  const previousClose=numberOrNull(meta.chartPreviousClose) ?? numberOrNull(meta.previousClose) ?? numberOrNull(meta.regularMarketPreviousClose);
  const change=resolveChangePercent(meta,price,previousClose);

  return {
    symbol,
    price,
    change: null,
    changePercent: change.value==null ? null : Number(change.value),
    previousClose: previousClose ?? null,
    currency:meta.currency||null,
    exchange:meta.fullExchangeName||meta.exchangeName||null,
    marketTime:meta.regularMarketTime ? new Date(meta.regularMarketTime*1000).toISOString():null,
    marketState:meta.marketState||null,
    quoteSource:'yahoo-chart',
    changePercentSource:change.source
  };
}

async function main(){
  const data={};

  for(const symbol of SYMBOLS){
    try{
      data[symbol]=await fetchQuote(symbol);
    }catch(e){
      data[symbol]={symbol,error:e.message};
    }
    await sleep(1000);
  }

  const output={
    cacheUpdatedAt:new Date().toISOString(),
    data
  };

  await fs.writeFile(
    "kline_robot_vercel/data/latest-price.json",
    JSON.stringify(output,null,2)
  );

  console.log("price updated",output.cacheUpdatedAt);
}

main();
