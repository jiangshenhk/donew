import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const CODES_MAIN = path.join(ROOT, 'config', 'tse-codes.txt');
const CODES_TEST = path.join(ROOT, 'config', 'tse-codes-test.txt');
const CODES_JSON = path.join(ROOT, 'config', 'tse-codes.json');
const OUTPUT_DIR = path.join(ROOT, 'data');

const CONCURRENCY = 8;
const BATCH_DELAY = 800;
const REQUEST_TIMEOUT = 15000;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function nowDateJST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function nowISO() {
  return new Date().toISOString();
}

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 donew-jp-stocks' },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStock(code, retry = 2) {
  const symbol = `${code}.T`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  try {
    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('No chart data');
    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    if (!quotes) throw new Error('No quote data');

    const closes = quotes.close || [];
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const volumes = quotes.volume || [];
    const len = closes.length;
    if (len === 0) throw new Error('No price data');

    const close = closes[len - 1];
    const open = opens[len - 1];
    const high = highs[len - 1];
    const low = lows[len - 1];
    const volume = volumes[len - 1];
    const prevClose = len >= 2 ? closes[len - 2] : null;
    const changePct = prevClose && prevClose !== 0
      ? ((close - prevClose) / prevClose * 100).toFixed(2)
      : '';

    return {
      code,
      name: (meta.shortName || meta.longName || '').replace(/,/g, ' '),
      date: nowDateJST(),
      open: open ?? '',
      high: high ?? '',
      low: low ?? '',
      close: close ?? '',
      volume: volume ?? 0,
      change_pct: changePct,
      error: '',
    };
  } catch (e) {
    if (retry > 0) {
      await sleep(2000);
      return fetchStock(code, retry - 1);
    }
    return {
      code, name: '', date: nowDateJST(),
      open: '', high: '', low: '', close: '', volume: 0, change_pct: '',
      error: e.message,
    };
  }
}

function formatETASeconds(totalSeconds) {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}秒`;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}分${s}秒`;
}

async function main() {
  const argFile = process.argv[2];
  let symbolsFile;
  if (argFile) {
    symbolsFile = path.resolve(argFile);
  } else if (fs.existsSync(CODES_MAIN)) {
    symbolsFile = CODES_MAIN;
  } else {
    symbolsFile = CODES_TEST;
  }

  const codes = fs.readFileSync(symbolsFile, 'utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !s.startsWith('#'));

  if (codes.length === 0) {
    console.error('No stock codes found in', symbolsFile);
    process.exit(1);
  }

  // load name info from JSON if available
  let nameMap = {};
  if (fs.existsSync(CODES_JSON)) {
    try {
      const entries = JSON.parse(fs.readFileSync(CODES_JSON, 'utf8'));
      for (const e of entries) {
        nameMap[e.code] = { name: e.name, market: e.market, sector: e.sector };
      }
    } catch {}
  }

  console.log(`\n=== 日本股票 EOD 收盘价下载 ===`);
  console.log(`代码文件: ${symbolsFile}`);
  console.log(`股票数量: ${codes.length}`);
  console.log(`并发数: ${CONCURRENCY}`);
  console.log(`开始时间: ${nowISO()}\n`);

  const startTime = Date.now();
  const results = [];
  const totalBatches = Math.ceil(codes.length / CONCURRENCY);

  for (let i = 0; i < codes.length; i += CONCURRENCY) {
    const batch = codes.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(code => fetchStock(code))
    );

    // enrich with name map
    for (const r of batchResults) {
      const info = nameMap[r.code];
      if (info && !r.name) r.name = info.name;
      results.push(r);
    }

    const done = Math.min(i + CONCURRENCY, codes.length);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done / elapsed;
    const remaining = (codes.length - done) / rate;
    const batchNum = Math.ceil(done / CONCURRENCY);
    const pct = ((done / codes.length) * 100).toFixed(1);

    process.stdout.write(`\r进度: ${done}/${codes.length} (${pct}%) | ETA: ${formatETASeconds(remaining)} | 批次: ${batchNum}/${totalBatches}`);

    if (i + CONCURRENCY < codes.length) {
      await sleep(BATCH_DELAY);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const success = results.filter(r => !r.error).length;
  const fail = results.length - success;

  const headers = ['code', 'name', 'date', 'open', 'high', 'low', 'close', 'volume', 'change_pct', 'error'];
  const csvLines = [headers.join(',')];
  for (const r of results) {
    csvLines.push(headers.map(h => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(','));
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const dateStr = nowDateJST().replace(/-/g, '');
  const outFile = path.join(OUTPUT_DIR, `jp-eod-${dateStr}.csv`);
  fs.writeFileSync(outFile, csvLines.join('\n') + '\n');

  console.log(`\n\n完成: ${outFile}`);
  console.log(`成功=${success} 失败=${fail} 耗时=${elapsed}s`);

  if (fail > 0) {
    console.log('\n失败列表:');
    for (const r of results.filter(r => r.error)) {
      console.log(`  ❌ ${r.code}: ${r.error}`);
    }
  }
}

main();
