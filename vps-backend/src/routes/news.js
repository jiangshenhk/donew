import { Router } from 'express';
import { getLatestNews, getNewsByCategory } from '../services/jin10News.js';
import db from '../db.js';

const router = Router();

router.get('/api/news/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const news = await getLatestNews(limit);
    res.json({ ok: true, count: news.length, data: news });
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
