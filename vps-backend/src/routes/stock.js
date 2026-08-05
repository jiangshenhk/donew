import { Router } from 'express';
import { getLatestStockPrices } from '../services/stockPrice.js';
import db from '../db.js';

const router = Router();

router.get('/api/stock/prices', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',').map(s => s.trim().toUpperCase()) : null;
    const prices = await getLatestStockPrices(symbols);
    const lastDataUpdate = db.prepare("SELECT MAX(updated_at) as d FROM stock_prices WHERE error IS NULL").get();
    const now = new Date().toISOString();
    res.json({
      ok: true,
      count: prices.length,
      updatedAt: lastDataUpdate?.d || now,
      checkedAt: now,
      successCount: prices.length,
      failCount: 0,
      data: prices.map(p => ({
        symbol: p.symbol,
        category: p.category,
        name: p.name,
        price: p.price,
        previousClose: p.previous_close,
        changePercent: p.change_percent,
        marketTime: p.market_time,
        currency: p.currency,
        exchange: p.exchange,
        marketState: p.market_state,
        sma5: p.sma5,
        sma10: p.sma10,
        vs5Pct: p.vs5_pct,
        vs10Pct: p.vs10_pct,
        barCount: p.bar_count,
        quoteSource: p.quote_source,
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

router.get('/api/stock/stats', (req, res) => {
  const totalRecords = db.prepare('SELECT COUNT(*) as c FROM stock_prices').get().c;
  const uniqueDates = db.prepare("SELECT COUNT(DISTINCT DATE(updated_at)) as c FROM stock_prices").get().c;
  const uniqueSymbols = db.prepare("SELECT COUNT(DISTINCT symbol) as c FROM stock_prices WHERE error IS NULL").get().c;
  const firstDate = db.prepare("SELECT MIN(updated_at) as d FROM stock_prices").get().d;
  const lastDate = db.prepare("SELECT MAX(updated_at) as d FROM stock_prices").get().d;
  res.json({ ok: true, totalRecords, uniqueDates, uniqueSymbols, firstDate, lastDate });
});

export default router;
