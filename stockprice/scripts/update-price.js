// Stock Price Center updater
// Reads symbols from stockprice/config/symbols.json
// Fetches latest market data and writes stockprice/data/latest-price.json

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const symbolsFile = path.join(ROOT, 'config', 'symbols.json');
const outputFile = path.join(ROOT, 'data', 'latest-price.json');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const result = json.chart.result[0];
  const meta = result.meta || {};

  return {
    symbol,
    price: meta.regularMarketPrice ?? null,
    previousClose: meta.chartPreviousClose ?? null,
    marketTime: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : null,
    currency: meta.currency ?? null,
    exchange: meta.exchangeName ?? null
  };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(symbolsFile, 'utf8'));
  const data = [];

  for (const symbol of config.symbols) {
    try {
      data.push(await fetchPrice(symbol));
    } catch (e) {
      data.push({ symbol, error: e.message });
    }
    await sleep(1000);
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify({
    updatedAt: new Date().toISOString(),
    data
  }, null, 2));
}

main();
