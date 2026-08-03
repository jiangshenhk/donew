import cron from 'node-cron';
import { fetchAllPrices } from './services/stockPrice.js';
import { fetchAllNews } from './services/jin10News.js';
import config from './config.js';

let tasks = [];

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

  console.log(`Cron started: stock every ${config.stockIntervalMinutes}min, news every ${config.newsIntervalMinutes}min`);

  fetchAllPrices().catch(e => console.error('Initial stock fetch error:', e.message));
  fetchAllNews().catch(e => console.error('Initial news fetch error:', e.message));
}

export function stopCronJobs() {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
}
