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

async function fetchQuote(symbol){
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

  const res = await fetch(url, {
    headers:{"User-Agent":"Mozilla/5.0"}
  });

  if(!res.ok) throw new Error(`${symbol}: ${res.status}`);

  const json = await res.json();
  const quote=(json.quoteResponse?.result||[])[0];
  if(!quote) throw new Error(`${symbol}: no quote data`);
  const phase=pickQuotePhase(quote);
  const price=latestPriceFromQuote(quote,phase);
  const dayChangePercent=dayChangePercentFromQuote(quote);

  return {
    symbol,
    price,
    change: null,
    changePercent: dayChangePercent==null ? null : Number(dayChangePercent),
    previousClose: quote.regularMarketPreviousClose ?? quote.regularMarketOpen ?? null,
    currency:quote.currency||null,
    exchange:quote.fullExchangeName||quote.exchange||quote.exchangeName||null,
    marketTime:latestMarketTimeFromQuote(quote,phase),
    marketState:quote.marketState||null,
    quoteSource:'yahoo-quote',
    pricePhase:phase
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
