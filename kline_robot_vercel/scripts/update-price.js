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

async function fetchQuote(symbol){
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

  const res = await fetch(url, {
    headers:{"User-Agent":"Mozilla/5.0"}
  });

  if(!res.ok) throw new Error(`${symbol}: ${res.status}`);

  const json = await res.json();
  const result = json.chart?.result?.[0];
  if(!result) throw new Error(`${symbol}: no data`);

  const meta=result.meta||{};
  const price=meta.regularMarketPrice ?? null;
  const previous=meta.chartPreviousClose ?? null;

  return {
    symbol,
    price,
    change: price!==null&&previous!==null ? price-previous:null,
    changePercent: price!==null&&previous ? ((price-previous)/previous)*100:null,
    currency:meta.currency||null,
    exchange:meta.exchangeName||null,
    marketTime:meta.regularMarketTime ? new Date(meta.regularMarketTime*1000).toISOString():null
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
