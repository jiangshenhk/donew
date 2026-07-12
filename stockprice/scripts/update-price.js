// Stock Price Center updater
// Reads symbols from stockprice/config/symbols.json
// Fetches latest market data and writes stockprice/data/latest-price.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const symbolsFile = path.join(ROOT, 'config', 'symbols.json');
const outputFile = path.join(ROOT, 'data', 'latest-price.json');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPrice(item, retry = 2) {
  const symbol = typeof item === 'string' ? item : item.symbol;
  const category = typeof item === 'string' ? 'Unknown' : item.category;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 donew-stockprice'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const result = json.chart.result[0];
    const meta = result.meta || {};

    console.log(`[OK] ${symbol} ${meta.regularMarketPrice}`);

    return {
      symbol,
      category,
      price: meta.regularMarketPrice ?? null,
      previousClose: meta.chartPreviousClose ?? null,
      changePercent: meta.chartPreviousClose && meta.regularMarketPrice
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100).toFixed(2)
        : null,
      marketTime: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
      currency: meta.currency ?? null,
      exchange: meta.exchangeName ?? null
    };
  } catch (e) {
    if (retry > 0) {
      console.log(`[RETRY] ${symbol} ${e.message}`);
      await sleep(2000);
      return fetchPrice(item, retry - 1);
    }

    console.log(`[FAIL] ${symbol} ${e.message}`);
    return {
      symbol,
      category,
      error: e.message
    };
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(symbolsFile, 'utf8'));
  const data = [];

  for (const item of config.symbols) {
    data.push(await fetchPrice(item));
    await sleep(1000);
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  fs.writeFileSync(outputFile, JSON.stringify({
    updatedAt: new Date().toISOString(),
    data
  }, null, 2));

  console.log(`Saved ${data.length} symbols`);
}

main();