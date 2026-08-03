import express from 'express';
import cors from 'cors';
import config from './config.js';
import stockRoutes from './routes/stock.js';
import newsRoutes from './routes/news.js';
import healthRoutes from './routes/health.js';
import aiRoutes from './routes/ai.js';
import { startCronJobs } from './cron.js';

const app = express();

app.use(express.json({ limit: '10mb' }));

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || config.allowedOrigins.includes('*') || config.allowedOrigins.some(o => origin.startsWith(o.replace('*', '')))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
});

app.use('/api/health', corsMiddleware);
app.use('/api/stats', corsMiddleware);
app.use('/api/stock', corsMiddleware);
app.use('/api/news', corsMiddleware);
app.use(healthRoutes);
app.use(stockRoutes);
app.use(newsRoutes);

app.use(aiRoutes);

app.get('/', corsMiddleware, (req, res) => {
  res.json({
    ok: true,
    name: 'donew-vps-backend',
    version: '1.0.0',
    endpoints: [
      'GET  /api/health',
      'GET  /api/stats',
      'GET  /api/stock/prices',
      'GET  /api/stock/prices?symbols=QQQ,SPY',
      'GET  /api/stock/fetch-log',
      'GET  /api/news/latest',
      'GET  /api/news/latest?limit=50',
      'GET  /api/news/category/:category',
      'GET  /api/news/stats',
      'GET  /api/news/fetch-log',
      'POST /api/ai/report                 — K线相识度分析',
      'POST /api/ai/sell-put-decision      — 综合卖Put决策',
      'GET  /api/ai/market-report          — 市场报告',
      'POST /api/ai/news-summary            — 新闻摘要/日报',
      'POST /api/ai/bazi-analysis           — 八字命理分析',
      'POST /api/ai/put-rating              — 卖Put温度判断',
    ]
  });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down');
  process.exit(0);
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`donew-vps-backend running on http://0.0.0.0:${config.port}`);
  startCronJobs();
});
