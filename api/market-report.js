import fs from 'fs';
import path from 'path';
import {
  buildMarketReportPrompt,
  loadStrategyBaseline,
  reportMetadata,
  validateCriticalRequirements,
} from '../lib/market-report-core.mjs';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

function sendJson(res, status, data) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  return res.status(status).json(data);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function recentNews(root) {
  const file = path.join(root, 'jin10news/data/latest-24h.json');
  const payload = readJson(file, { items: [] });
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  return (payload.items || [])
    .filter(item => !item.time || Date.parse(item.time) >= cutoff)
    .map(item => ({ time: item.time, categories: item.categories || [], content: item.content }))
    .slice(0, 250);
}

function marketSnapshot(root) {
  return readJson(path.join(root, 'stockprice/data/latest-price.json'), {});
}

async function callNewsSummary({ reportType, news, snapshot, prompt, strategySource }) {
  const endpoint = process.env.NEWS_SUMMARY_API || 'https://donew-beta.vercel.app/api/news-summary';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'daily-report',
      reportType,
      provider: 'deepseek',
      rawNews: news,
      prompt,
      marketSnapshot: snapshot,
      strategySource,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message || `AI failed: ${response.status}`);
  return String(data.report?.markdown || '').trim();
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, message: 'Method not allowed' });

  try {
    const root = process.cwd();
    const kind = String(req.query.kind || 'daily').toLowerCase() === 'weekly' ? 'weekly' : 'daily';
    const { strategy, strategySource } = loadStrategyBaseline(root);
    const news = recentNews(root);
    const snapshot = marketSnapshot(root);
    const prompt = buildMarketReportPrompt({ strategy, reportType: kind, news, marketSnapshot: snapshot });
    const markdown = await callNewsSummary({ reportType: kind, news, snapshot, prompt, strategySource });
    validateCriticalRequirements(markdown);
    const report = reportMetadata({ reportType: kind, markdown, provider: 'DeepSeek' });
    report.strategySource = strategySource;
    report.targets = ['QLD', 'MSTR', 'INTC'].map(symbol => ({ symbol, action: '以报告正文为准' }));
    return sendJson(res, 200, { ok: true, report });
  } catch (error) {
    return sendJson(res, 500, { ok: false, message: error.message || String(error) });
  }
}
