import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const configFile = path.join(ROOT, 'config', 'news-config.json');
const jsonFile = path.join(ROOT, 'data', 'latest-24h.json');
const mdFile = path.join(ROOT, 'data', 'latest-24h.md');
const SEARCH_API = 'https://search-open-api.jin10.com/offset/search';
const HOMEPAGE_URL = 'https://www.jin10.com/index.html';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

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
  const id = idValue ? String(idValue) : crypto
    .createHash('sha1').update(time.toISOString() + '|' + content).digest('hex');
  const url = clean(raw?.url ?? raw?.link ?? nested?.url ?? nested?.link);
  return { id, time: time.toISOString(), content, ...(url ? { url } : {}) };
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

async function fetchPage(config, page) {
  const offset = (page - 1) * config.pageSize;
  const params = new URLSearchParams({
    order: '1',
    type: 'flash',
    keyword: config.keyword,
    offset: String(offset),
    rewrite: '1',
    rank: 'hot'
  });
  const payload = await requestJson(SEARCH_API + '?' + params);
  return findArray(payload).map(normalize).filter(Boolean);
}


function decodeHtml(value) {
  return String(value || '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function homepageTime(value, now = new Date()) {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute, second] = value.split(':').map(Number);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
    return out;
  }, {});
  let date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 8, minute, second));
  if (date.getTime() > now.getTime() + 5 * 60 * 1000) {
    date = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  }
  return date;
}

async function fetchHomepageItems(config) {
  const response = await fetch(HOMEPAGE_URL, {
    headers: {
      'accept': 'text/html,application/xhtml+xml',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.7',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133 Safari/537.36 donew-jin10news/1.1'
    },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error('Jin10 homepage HTTP ' + response.status);
  const html = await response.text();
  const start = html.indexOf('id="JinFlashList"');
  if (start < 0) throw new Error('Jin10 homepage flash section not found');
  const endCandidates = [
    html.indexOf('登录后查看更多快讯', start),
    html.indexOf('金十旗下', start),
    html.indexOf('</body>', start)
  ].filter(index => index > start);
  const section = html.slice(start, endCandidates.length ? Math.min(...endCandidates) : html.length);
  const matches = [...section.matchAll(/<div[^>]+id="flash(\d+)"[^>]*class="jin-flash-item-container[^"]*"[^>]*>/g)];
  const items = [];
  for (let index = 0; index < matches.length; index += 1) {
    const block = section.slice(matches[index].index, matches[index + 1]?.index ?? section.length);
    const texts = [...block.matchAll(/class="flash-text">([\s\S]*?)<\/div>/g)]
      .map(match => decodeHtml(match[1])).filter(Boolean);
    const content = [...new Set(texts)].join(' ');
    if (!content || (config.keyword && !content.includes(config.keyword))) continue;
    const rawTime = block.match(/class="item-time">([^<]+)</)?.[1]?.trim() || '';
    const time = homepageTime(rawTime);
    if (!time) continue;
    const link = block.match(/href="(https:\/\/flash\.jin10\.com\/detail\/\d+)"/)?.[1];
    items.push({
      id: String(matches[index][1]),
      time: time.toISOString(),
      content,
      ...(link ? { url: link } : {})
    });
  }
  if (!items.length) {
    throw new Error('Jin10 homepage returned no matching "' + config.keyword + '" items');
  }
  console.log('homepage fallback parsed=' + items.length);
  return items;
}

function loadOldItems() {
  try {
    const parsed = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    return Array.isArray(parsed.items) ? parsed.items.map(normalize).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function escapeMarkdown(text) {
  return text.replace(/([\\|])/g, '\\$1');
}

function renderMarkdown(result, timezone) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone, month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const lines = [
    '# 金十市场要闻｜最近24小时',
    '',
    '> 自动更新：' + new Date(result.checkedAt).toLocaleString('zh-CN', { timeZone: timezone }) +
      '｜新闻 ' + result.count + ' 条｜关键词：' + result.keyword,
    ''
  ];
  if (!result.items.length) {
    lines.push('最近24小时没有匹配新闻。', '');
    return lines.join('\n');
  }
  for (const item of result.items) {
    const time = formatter.format(new Date(item.time));
    const body = escapeMarkdown(item.content);
    lines.push('- **' + time + '** ' + (item.url ? '[' + body + '](' + item.url + ')' : body));
  }
  lines.push('', '> 来源：[金十搜索](https://search.jin10.com/)，内容版权归原发布方所有。', '');
  return lines.join('\n');
}

async function main() {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (!config.enabled) {
    console.log('Jin10 news updater disabled');
    return;
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - config.hours * 60 * 60 * 1000);
  const fetched = [];
  let successfulPages = 0;

  for (let page = 1; page <= config.maxPages; page += 1) {
    try {
      const items = await fetchPage(config, page);
      successfulPages += 1;
      fetched.push(...items);
      console.log('page=' + page + ' parsed=' + items.length);
      if (!items.length) break;
      const oldest = Math.min(...items.map(item => new Date(item.time).getTime()));
      if (oldest < cutoff.getTime()) break;
    } catch (error) {
      console.warn('page=' + page + ' failed: ' + error.message);
      if (page === 1) {
        console.warn('Search API unavailable; switching to Jin10 homepage fallback');
        const fallbackItems = await fetchHomepageItems(config);
        fetched.push(...fallbackItems);
        successfulPages += 1;
      }
      break;
    }
    await sleep(config.requestDelayMs);
  }

  if (!successfulPages || !fetched.length) {
    throw new Error('Jin10 returned no parseable news; old cache preserved');
  }

  const combined = [...fetched, ...loadOldItems()];
  const unique = new Map();
  for (const item of combined) {
    const time = new Date(item.time);
    if (time >= cutoff && time <= new Date(now.getTime() + 5 * 60 * 1000)) unique.set(item.id, item);
  }
  const items = [...unique.values()].sort((a, b) => new Date(b.time) - new Date(a.time));
  const result = {
    source: 'Jin10',
    sourceUrl: 'https://search.jin10.com/',
    keyword: config.keyword,
    windowHours: config.hours,
    updatedAt: now.toISOString(),
    checkedAt: now.toISOString(),
    count: items.length,
    items
  };

  fs.mkdirSync(path.dirname(jsonFile), { recursive: true });
  fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(mdFile, renderMarkdown(result, config.timezone));
  console.log('Saved ' + items.length + ' news items');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
