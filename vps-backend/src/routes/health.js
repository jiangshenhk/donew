import { Router } from 'express';
import db from '../db.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const router = Router();

router.get('/api/health', (req, res) => {
  try {
    const stockCount = db.prepare('SELECT COUNT(DISTINCT symbol) as count FROM stock_prices WHERE error IS NULL').get().count;
    const newsCount = db.prepare('SELECT COUNT(*) as count FROM jin10_news').get().count;
    const lastStock = db.prepare("SELECT created_at FROM fetch_log WHERE type='stock' ORDER BY created_at DESC LIMIT 1").get();
    const lastNews = db.prepare("SELECT created_at FROM fetch_log WHERE type='news' ORDER BY created_at DESC LIMIT 1").get();
    res.json({
      ok: true,
      status: 'running',
      uptime: process.uptime(),
      db: { stocks: stockCount, news: newsCount },
      lastFetch: {
        stock: lastStock?.created_at || null,
        news: lastNews?.created_at || null,
      },
      node: process.version,
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/api/stats', (req, res) => {
  const stats = {
    stockRecords: db.prepare('SELECT COUNT(*) as count FROM stock_prices').get().count,
    stockSymbols: db.prepare('SELECT COUNT(DISTINCT symbol) as count FROM stock_prices WHERE error IS NULL').get().count,
    newsCount: db.prepare('SELECT COUNT(*) as count FROM jin10_news').get().count,
    oldestNews: db.prepare('SELECT MIN(time) as time FROM jin10_news').get().time,
    newestNews: db.prepare('SELECT MAX(time) as time FROM jin10_news').get().time,
    fetchLogs: db.prepare('SELECT COUNT(*) as count FROM fetch_log').get().count,
  };
  res.json({ ok: true, data: stats });
});

router.get('/api/config', (req, res) => {
  function readConfig(dir) {
    try {
      const file = path.join(os.homedir(), dir, 'config.json');
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return null; }
  }
  res.json({
    ok: true,
    short: readConfig('.donew-trader'),
    long: readConfig('.donew-trader-long'),
  });
});

export default router;
