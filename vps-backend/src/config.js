import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

export default {
  port: parseInt(process.env.PORT || '3000', 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://donew-beta.vercel.app').split(',').map(s => s.trim()),
  dbPath: path.resolve(process.env.DB_PATH || './data/donew.db'),
  stockIntervalMinutes: parseInt(process.env.STOCK_INTERVAL_MINUTES || '5', 10),
  newsIntervalMinutes: parseInt(process.env.NEWS_INTERVAL_MINUTES || '5', 10),
  newsWindowHours: parseInt(process.env.NEWS_WINDOW_HOURS || '48', 10),
};
