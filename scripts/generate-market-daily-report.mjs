import fs from 'fs';
import path from 'path';

const reportType = String(process.argv[2] || '').toLowerCase();
if (!['morning','evening'].includes(reportType)) throw new Error('Usage: node scripts/generate-market-daily-report.mjs morning|evening');

const root = process.cwd();
const newsFile = path.join(root,'jin10news/data/latest-24h.json');
const priceFile = path.join(root,'stockprice/data/latest-price.json');
const strategyFile = path.join(root,'docs/SellPut/日报周报/策略_每日市场判断怎么看GPT