import cron from 'node-cron';
import { exec, execFile } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAllPrices } from './services/stockPrice.js';
import { fetchAllNews } from './services/jin10News.js';
import config from './config.js';
import { isSellPutMarketWindow } from './lib/marketHours.js';

export { isSellPutMarketWindow } from './lib/marketHours.js';

let tasks = [];
let sellPutRunning = false;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SELL_PUT_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sell-put-agent.mjs');

function runReport(type) {
  const label = { morning: '早报', evening: '晚报', weekly: '周报' }[type] || type;
  const cmd = `node scripts/generate-market-daily-report.mjs ${type}`;
  console.log(`[cron] report ${label} start`);
  exec(cmd, (err, stdout, stderr) => {
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    if (err) {
      console.error(`[cron] report ${label} error:`, err.message);
    } else {
      console.log(`[cron] report ${label} done`);
    }
  });
}

function runSellPutAgent() {
  if (sellPutRunning) {
    console.log('[cron] sellput agent skipped: previous run is still active');
    return;
  }
  sellPutRunning = true;
  console.log('[cron] sellput agent start');
  execFile(process.execPath, [SELL_PUT_SCRIPT, 'daily'], { cwd: REPO_ROOT, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    if (err) {
      console.error('[cron] sellput agent error:', err.message);
    } else {
      console.log('[cron] sellput agent done');
    }
    sellPutRunning = false;
  });
}

export function startCronJobs() {
  stopCronJobs();

  const stockTask = cron.schedule(`*/${config.stockIntervalMinutes} * * * *`, async () => {
    console.log(`[cron] stock fetch start (every ${config.stockIntervalMinutes}min)`);
    try {
      await fetchAllPrices();
    } catch (error) {
      console.error('[cron] stock fetch error:', error.message);
    }
  });
  tasks.push(stockTask);

  const newsTask = cron.schedule(`*/${config.newsIntervalMinutes} * * * *`, async () => {
    console.log(`[cron] news fetch start (every ${config.newsIntervalMinutes}min)`);
    try {
      await fetchAllNews();
    } catch (error) {
      console.error('[cron] news fetch error:', error.message);
    }
  });
  tasks.push(newsTask);

  const morningTask = cron.schedule('28 8 * * 1-5', () => runReport('morning'));
  tasks.push(morningTask);

  const eveningTask = cron.schedule('28 20 * * 1-5', () => runReport('evening'));
  tasks.push(eveningTask);

  const weeklyTask = cron.schedule('0 9 * * 6', () => runReport('weekly'));
  tasks.push(weeklyTask);

  // Trigger every 15 minutes, then gate by New York time. This handles DST and
  // the Hong Kong Saturday morning portion of the US Friday session correctly.
  const sellputTask = cron.schedule('*/15 * * * *', () => {
    if (isSellPutMarketWindow()) runSellPutAgent();
  }, { timezone: 'America/New_York' });
  tasks.push(sellputTask);

  console.log(`Cron started: stock every ${config.stockIntervalMinutes}min, news every ${config.newsIntervalMinutes}min, reports morning/evening/weekly, sellput agent every 15min market hours`);

  fetchAllPrices().catch(e => console.error('Initial stock fetch error:', e.message));
  fetchAllNews().catch(e => console.error('Initial news fetch error:', e.message));
}

export function stopCronJobs() {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
}
