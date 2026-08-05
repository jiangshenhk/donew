import db from '../db.js';
import config from '../config.js';
import crypto from 'crypto';

// Jin10 blocks some VPS ranges. This producer cache is an upstream data source,
// while all browser and application traffic still goes through sellput.top.
const GITHUB_RAW = 'https://raw.githubusercontent.com/jiangshenhk/donew/main/jin10news/data/latest-24h.json';
const SEARCH_API = 'https://search-open-api.jin10.com/offset/search';
const HOMEPAGE_URL = 'https://www.jin10.com/index.html';
const CATEGORY_KEYWORD = '金十数据整理';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function clean(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
    const n = Number(value);
    const date = new Date(n < 1e12 ? n * 1000 : n);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = String(value).trim();
  const normalized = raw.includes('T') || /[zZ]|[+-]\d\d:?\d\d$/.test(raw)
    ? raw
    : raw.replace(/-/g, '/') + ' +08:00';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findArray(payload) {
  const candidates = [
    payload?.data?.list, payload?.data?.items, payload?.data?.data,
    payload?.data, payload?.list, payload?.items, payload?.result?.list,
    payload?.result?.data, payload?.result
  ];
  return candidates.find(Array.isArray) || [];
}

function normalize(raw) {
  const nested = raw?.data && !Array.isArray(raw.data) ? raw.data : {};
  const content = clean(
    raw?.content ?? raw?.text ?? raw?.title ?? raw?.description ??
    nested?.content ?? nested?.text ?? nested?.title ?? nested?.description
  );
  const time = parseTime(
    raw?.time ?? raw?.datetime ?? raw?.published_at ?? raw?.publish_time ??
    raw?.created_at ?? raw?.createdAt ?? nested?.time ?? nested?.datetime ??
    nested?.published_at ?? nested?.publish_time
  );
  if (!content || !time) return null;
  const idValue = raw?.id ?? raw?._id ?? raw?.news_id ?? nested?.id ?? nested?.news_id;
  const id = idValue ? String(idValue) : crypto.createHash('sha1').update(time.toISOString() + '|' + content).digest('hex');
  const url = clean(raw?.url ?? raw?.link ?? nested?.url ?? nested?.link);
  return { id, time: time.toISOString(), content, url: url || null };
}

async function requestJson(url, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.7',
          'origin': 'https://search.jin10.com',
          'referer': 'https://search.jin10.com/',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) donew-jin10news/1.0'
        },
        signal: AbortSignal.timeout(20000)
      });
      const body = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + body.slice(0, 180));
      return JSON.parse(body);
    } catch (error) {
      lastError = error;
      if (i < attempts) await sleep(i * 2500);
    }
  }
  throw lastError;
}

async function fetchPage(page) {
  const offset = (page - 1) * 10;
  const params = new URLSearchParams({
    order: '1', type: 'flash', keyword: CATEGORY_KEYWORD,
    offset: String(offset), rewrite: '1', rank: 'hot'
  });
  const payload = await requestJson(SEARCH_API + '?' + params);
  return findArray(payload).map(normalize).filter(Boolean);
}

const CATEGORY_RULES = [
  ['宏观', /GDP|经济|衰退|增长|财政|贸易|关税|美元|汇率|就业|非农|消费|制造业|PMI|房地产|债务|赤字/u],
  ['利率', /美联储|央行|利率|降息|加息|收益率|国债|通胀|CPI|PCE|鲍威尔|沃什|货币政策/u],
  ['地缘', /伊朗|以色列|俄乌|乌克兰|俄罗斯|战争|导弹|袭击|空袭|制裁|霍尔木兹|北约|停火|军事/u],
  ['科技', /AI|人工智能|芯片|半导体|英伟达|科技|大模型|数据中心|机器人|算力|软件|苹果|微软|谷歌|OpenAI/u],
  ['黄金', /黄金|金价|白银|银价|铂金|钯金|贵金属/u],
  ['原油', /原油|油价|石油|欧佩克|OPEC|天然气|LNG|炼油|能源供应/u],
  ['美股', /美股|标普|纳指|道指|股票|财报|公司|市值|期货指数/u],
  ['加密', /比特币|BTC|以太坊|ETH|加密货币|稳定币|区块链/u],
  ['中国', /中国|人民币|A股|港股|香港|央行|商务部|国务院|沪指|深成指/u]
];

function classifyNews(content) {
  const text = String(content || '');
  const categories = CATEGORY_RULES.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  return categories.length ? [...new Set(categories)] : ['其他'];
}

async function fetchFromGitHub() {
  try {
    const res = await fetch(GITHUB_RAW + '?t=' + Date.now(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-vps/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = (json.items || []).map(item => ({
      id: item.id || crypto.createHash('sha1').update(item.time + '|' + item.content).digest('hex'),
      time: item.time,
      content: item.content,
      url: item.url || null,
      categories: classifyNews(item.content),
    }));
    return { items, sourceMode: 'github-' + (json.sourceMode || 'proxy') };
  } catch (error) {
    console.warn(`GitHub fetch failed: ${error.message}`);
    return null;
  }
}

export async function fetchAllNews() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.newsWindowHours * 60 * 60 * 1000);
  let sourceMode = 'search';

  // Prefer the producer cache because Jin10 blocks some VPS IP ranges.
  let fetched = [];

  const githubResult = await fetchFromGitHub();
  if (githubResult && githubResult.items.length > 0) {
    fetched = githubResult.items;
    sourceMode = githubResult.sourceMode;
    console.log(`Jin10 via GitHub: ${fetched.length} items`);
  } else {
    // Fall back to direct Jin10 search when the producer cache is unavailable.
    for (let page = 1; page <= 12; page += 1) {
      try {
        const items = await fetchPage(page);
        fetched.push(...items);
        console.log(`Jin10 page=${page} parsed=${items.length}`);
        if (!items.length) break;
        const oldest = Math.min(...items.map(item => new Date(item.time).getTime()));
        if (oldest < cutoff.getTime()) break;
      } catch (error) {
        console.warn(`Jin10 page=${page} failed: ${error.message}`);
        break;
      }
      await sleep(1200);
    }
    sourceMode = 'direct-search';
  }

  if (!fetched.length) {
    console.warn('Jin10 fetch returned no items');
    logFetch('news', 'fail', 'No items fetched');
    return [];
  }

  const categorized = fetched.map(item => ({
    ...item,
    categories: JSON.stringify(item.categories || classifyNews(item.content))
  }));

  const insert = db.prepare(`
    INSERT OR REPLACE INTO jin10_news (id, time, content, url, categories, fetched_at)
    VALUES (@id, @time, @content, @url, @categories, @fetchedAt)
  `);
  const deleteOld = db.prepare('DELETE FROM jin10_news WHERE time < ?');
  const tx = db.transaction(() => {
    for (const item of categorized) {
      insert.run({ ...item, fetchedAt: now.toISOString() });
    }
    deleteOld.run(cutoff.toISOString());
  });
  tx();

  const count = db.prepare('SELECT COUNT(*) as count FROM jin10_news').get().count;
  logFetch('news', 'ok', `fetched ${categorized.length} items, total=${count}, source=${sourceMode}`);
  console.log(`Jin10 fetch done: added=${categorized.length} total=${count} sourceMode=${sourceMode}`);
  return categorized;
}

export async function getLatestNews(limit = 100) {
  return db.prepare(
    'SELECT * FROM jin10_news ORDER BY time DESC LIMIT ?'
  ).all(limit);
}

export async function getNewsByCategory(category, limit = 100) {
  return db.prepare(
    "SELECT * FROM jin10_news WHERE categories LIKE ? ORDER BY time DESC LIMIT ?"
  ).all(`%${category}%`, limit);
}

function logFetch(type, status, message) {
  db.prepare('INSERT INTO fetch_log (type, status, message) VALUES (?, ?, ?)').run(type, status, message);
}
