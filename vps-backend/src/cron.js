import cron from 'node-cron';
import { exec } from 'child_process';
import { fetchAllPrices } from './services/stockPrice.js';
import { fetchAllNews } from './services/jin10News.js';
import config from './config.js';

let tasks = [];

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

  console.log(`Cron started: stock every ${config.stockIntervalMinutes}min, news every ${config.newsIntervalMinutes}min, reports morning/evening/weekly`);

  fetchAllPrices().catch(e => console.error('Initial stock fetch error:', e.message));
  fetchAllNews().catch(e => console.error('Initial news fetch error:', e.message));
}

export function stopCronJobs() {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
}
