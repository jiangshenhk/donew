import { Router } from 'express';
import { getLatestStockPrices } from '../services/stockPrice.js';
import db from '../db.js';

const router = Router();

router.get('/api/stock/prices', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',').map(s => s.trim().toUpperCase()) : null;
    const prices = await getLatestStockPrices(symbols);
    const lastFetch = db.prepare("SELECT created_at, message FROM fetch_log WHERE type='stock' ORDER BY created_at DESC LIMIT 1").get();
    const now = new Date().toISOString();
    res.json({
      ok: true,
      count: prices.length,
      updatedAt: lastFetch?.created_at || now,
      checkedAt: now,
      successCount: prices.length,
      failCount: 0,
      data: prices.map(p => ({
        ...p,
        dailyAtr: null,
        weeklyAtr: null,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/api/stock/fetch-log', (req, res) => {
  const logs = db.prepare("SELECT * FROM fetch_log WHERE type='stock' ORDER BY created_at DESC LIMIT 20").all();
  res.json({ ok: true, data: logs });
});

export default router;
