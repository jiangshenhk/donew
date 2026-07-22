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
  const previous=resolvePreviousClose(result,meta);
  const previousClose=previous.value;
  const change=resolveChangePercent(price,previousClose);

  return {
    symbol,
    name: meta.shortName ?? meta.longName ?? null,
    price,
    change: null,
    changePercent: change.value==null ? null : Number(change.value),
    previousClose: previousClose ?? null,
    currency:meta.currency||null,
    exchange:meta.fullExchangeName||meta.exchangeName||null,
    marketTime:meta.regularMarketTime ? new Date(meta.regularMarketTime*1000).toISOString():null,
    marketState:meta.marketState||null,
    quoteSource:'yahoo-chart',
    changePercentSource:change.source,
    previousCloseSource:previous.source,
    previousCloseDate:previous.previousCloseDate,
    latestBarDate:previous.latestBarDate,
    marketDate:previous.marketDate
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
