import { Router } from 'express';
import { getLatestNews, getNewsByCategory } from '../services/jin10News.js';
import db from '../db.js';

const router = Router();

router.get('/api/news/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const items = await getLatestNews(limit);
    const lastFetch = db.prepare("SELECT created_at FROM fetch_log WHERE type='news' ORDER BY created_at DESC LIMIT 1").get();
    const sourceLog = db.prepare("SELECT message FROM fetch_log WHERE type='news' AND status='ok' ORDER BY created_at DESC LIMIT 1").get();
    const sourceMode = String(sourceLog?.message || '').match(/source=([^,\s]+)/)?.[1] || 'vps-cache';
    const catStats = {};
    for (const item of items) {
      try { const cats = JSON.parse(item.categories || '[]'); for (const c of cats) catStats[c] = (catStats[c] || 0) + 1; } catch {}
    }
    res.json({
      ok: true,
      count: items.length,
      source: 'Jin10',
      sourceMode,
      sourceLabel: '金十数据（VPS统一缓存）',
      windowHours: 48,
      updatedAt: lastFetch?.created_at || new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      categoryStats: catStats,
      items: items.map(i => ({ ...i, categories: JSON.parse(i.categories || '[]') })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/api/news/category/:category', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const news = await getNewsByCategory(req.params.category, limit);
    res.json({ ok: true, count: news.length, data: news });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/api/news/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT categories, COUNT(*) as count FROM jin10_news
    GROUP BY categories
  `).all();
  const total = db.prepare('SELECT COUNT(*) as count FROM jin10_news').get().count;
  res.json({ ok: true, total, categories: stats });
});

router.get('/api/news/fetch-log', (req, res) => {
  const logs = db.prepare("SELECT * FROM fetch_log WHERE type='news' ORDER BY created_at DESC LIMIT 20").all();
  res.json({ ok: true, data: logs });
});

export default router;
