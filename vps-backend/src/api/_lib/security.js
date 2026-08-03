const ALLOWED_ORIGINS = [
  'https://jiangshenhk.github.io',
  'https://donew-beta.vercel.app',
  'https://sellput.top',
];

const DAILY_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const rateLimitMap = new Map();

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket?.remoteAddress
      || 'unknown';
}

function extractRateRecord(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || (now - record.day) > DAY_MS) return { count: 0, day: now };
  return record;
}

export function securityCheck(req, res) {
  const origin = req.headers['origin'] || '';
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';

  const originOk = ALLOWED_ORIGINS.includes(origin);
  const refererOk = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

  const validOrigin = originOk || refererOk || isLocal;

  res.setHeader('Access-Control-Allow-Origin', originOk ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-RateLimit-Limit', DAILY_LIMIT);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return false;
  }

  if (!validOrigin) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: '禁止直接访问此 API' }));
    return false;
  }

  const ip = getClientIP(req);
  const record = extractRateRecord(ip);

  if (record.count >= DAILY_LIMIT) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-RateLimit-Remaining', 0);
    res.end(JSON.stringify({ ok: false, error: `请求超限，每天最多 ${DAILY_LIMIT} 次` }));
    return false;
  }

  record.count++;
  rateLimitMap.set(ip, record);
  res.setHeader('X-RateLimit-Remaining', DAILY_LIMIT - record.count);
  return true;
}
