#!/usr/bin/env node
// sell-put-agent.mjs — Sell Put Decision Agent v0.4.0
// 每日自动分析 QLD/MSTR/INTC 卖Put机会，记录纸面交易，跟踪胜率
// 数据存储于 ~/.donew-agent/ (独立于仓库，不 commit)
//
// Usage: node scripts/sell-put-agent.mjs [daily|stats|version]
// Env:   DEEPSEEK_API_KEY (必需)

import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

// ─── Constants ───────────────────────────────────────────────

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const BARCHART = 'https://www.barchart.com';
const STOCKPRICE_URL = 'https://raw.githubusercontent.com/jiangshenhk/donew/main/stockprice/data/latest-price.json';
const NEWS_URL = 'https://raw.githubusercontent.com/jiangshenhk/donew/main/jin10news/data/latest-24h.json';

const AGENT_DIR  = path.join(homedir(), '.donew-agent');
const JOURNAL_DIR = path.join(AGENT_DIR, 'journal');
const POSITIONS_FILE = path.join(AGENT_DIR, 'positions.json');
const STATS_FILE      = path.join(AGENT_DIR, 'stats.json');
const EXPERIENCE_FILE = path.join(AGENT_DIR, 'experience.json');
const ORDERS_FILE     = path.join(AGENT_DIR, 'orders.json');
const REPORTS_DIR     = path.join(AGENT_DIR, 'reports');
const ENV_FILE        = path.join(AGENT_DIR, '.env');
const SYMBOLS_FILE    = path.join(AGENT_DIR, 'symbols.json');
const SCAN_RESULT_FILE = path.join(AGENT_DIR, 'scan-result.json');
const KLINE_DIR       = path.join(AGENT_DIR, 'kline');

const DEFAULT_TARGETS = ['QLD', 'MSTR', 'INTC'];

function loadTargets() {
  try { return JSON.parse(fs.readFileSync(SYMBOLS_FILE, 'utf-8')); }
  catch { return [...DEFAULT_TARGETS]; }
}

function saveTargets(targets) { saveJson(SYMBOLS_FILE, targets); }

const TARGETS = loadTargets();

const CONFIG = {
  capital: 100000,
  targetMonthlyReturn: 0.025,
  maxDrawdown: 0.20,
  maxConsecutiveLosses: 3,
  maxOpenPositions: 3,
  maxSinglePositionPct: 0.50,
  targetDte: 10,
  targetDelta: 0.15,
  dteRange: [1, 20],
  deltaRange: [0.05, 0.25],
  minOtm: 0.04,
  minBid: 0.10,
  minOi: 50,
};

// ─── Helpers ──────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJson(fpath) {
  try { return JSON.parse(fs.readFileSync(fpath, 'utf-8')); }
  catch { return null; }
}

function saveJson(fpath, data) {
  ensureDir(path.dirname(fpath));
  fs.writeFileSync(fpath, JSON.stringify(data, null, 2), 'utf-8');
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function num(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(String(val).replace(/[,%+]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pctStr(value) {
  const n = num(value);
  if (n === null) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

// ─── Storage ──────────────────────────────────────────────────

function loadPositions() { return loadJson(POSITIONS_FILE) || []; }
function savePositions(data) { saveJson(POSITIONS_FILE, data); }

function loadStats() {
  return loadJson(STATS_FILE) || {
    totalDecisions: 0, totalPositions: 0, wins: 0, losses: 0,
    totalPremium: 0, totalLosses: 0, netPnL: 0,
    currentDrawdown: 0, maxDrawdown: 0, consecutiveLosses: 0,
    bySymbol: {}, byDeltaBucket: {}, monthlyPnL: {},
  };
}
function saveStats(data) { saveJson(STATS_FILE, data); }

function loadExperience() {
  return loadJson(EXPERIENCE_FILE) || { patterns: [], lastUpdated: null };
}
function saveExperience(data) { saveJson(EXPERIENCE_FILE, data); }

function saveJournal(entry) {
  ensureDir(JOURNAL_DIR);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `${entry.date}_${entry.symbol}_${ts}.json`;
  saveJson(path.join(JOURNAL_DIR, fname), entry);
}

function readApiKey() {
  const env = process.env.DEEPSEEK_API_KEY;
  if (env) return env;
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = content.match(/DEEPSEEK_API_KEY\s*=\s*(.+)/);
    return match ? match[1].trim().replace(/["']/g, '') : null;
  } catch { return null; }
}

function loadOrders() { return loadJson(ORDERS_FILE) || []; }
function saveOrders(data) { saveJson(ORDERS_FILE, data); }

// ─── Barchart Session ────────────────────────────────────────

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*[^;,\s]+=)/) : [];
}

async function barchartSession(symbol, timeoutMs = 15000) {
  const pageUrl = `${BARCHART}/stocks/quotes/${symbol}/overview`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(pageUrl, {
      signal: ctrl.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; donew-agent/1.0)',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.text(); // consume body

    const cookies = getSetCookies(res.headers).map(v => v.split(';', 1)[0]);
    const xsrf = cookies.find(v => v.startsWith('XSRF-TOKEN='));
    if (!cookies.length || !xsrf) throw new Error('Barchart session 建立失败');

    return {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookies.join('; '),
        'Referer': pageUrl,
        'User-Agent': 'Mozilla/5.0 (compatible; donew-agent/1.0)',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': decodeURIComponent(xsrf.slice('XSRF-TOKEN='.length)),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Options Chain Fetcher ────────────────────────────────────

async function fetchOptionsChain(symbol, opts = {}) {
  // TODO: 统一使用 _lib/barchart-options-chain.js 的 fetchOptionsChain。
  // 当前为 Agent 自有副本，字段名与共用模块不同（strike vs strikePrice 等），
  // 统一前需对齐字段名并确保所有调用方兼容。
  const timeoutMs = opts.timeoutMs || 20000;
  const dteMin = opts.dteMin ?? 5;
  const dteMax = opts.dteMax ?? 25;
  const session = await barchartSession(symbol, timeoutMs);

  const url = new URL(`${BARCHART}/proxies/core-api/v1/options/get`);
  const params = {
    fields: 'symbol,baseSymbol,expirationDate,daysToExpiration,symbolType,strikePrice,bidPrice,askPrice,volume,openInterest,volatility,vega,delta,tradeTime,baseLastPrice',
    orderBy: 'daysToExpiration',
    orderDir: 'asc',
    limit: '100',
    raw: '1',
    meta: 'field.shortName,field.type',
    'in(symbolType,(put))': '',
    'gt(bidPrice,0.01)': '',
    [`between(daysToExpiration,${dteMin},${dteMax})`]: '',
    'between(openInterest,10,)': '',
    'gt(baseLastPrice,1.00)': '',
    [`eq(baseSymbol,${symbol})`]: '',
  };
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: session.headers });
    if (!res.ok) throw new Error(`Barchart API HTTP ${res.status}`);

    const body = await res.json();
    const rows = (Array.isArray(body.data) ? body.data : []);

    const contracts = rows.map(item => {
      const raw = item?.raw || item;
      return {
        contractSymbol: String(raw.symbol || '').trim(),
        symbol: String(raw.baseSymbol || '').trim().toUpperCase(),
        optionType: String(raw.symbolType || ''),
        expireDate: raw.expirationDate || null,
        dte: num(raw.daysToExpiration),
        strike: num(raw.strikePrice),
        bid: num(raw.bidPrice) || 0,
        ask: num(raw.askPrice),
        iv: num(raw.volatility),
        delta: num(raw.delta),
        volume: num(raw.volume) || 0,
        oi: num(raw.openInterest) || 0,
        underlying: num(raw.baseLastPrice),
      };
    }).filter(c =>
      c.symbol === symbol.toUpperCase()
      && c.optionType.toLowerCase() === 'put'
      && c.strike && c.dte && c.dte >= dteMin && c.dte <= dteMax
      && c.delta != null && Math.abs(c.delta) >= CONFIG.deltaRange[0] && Math.abs(c.delta) <= CONFIG.deltaRange[1]
      && c.bid >= CONFIG.minBid
      && c.oi >= CONFIG.minOi
    );

    // Sort: closest delta to 0.15 first, then nearest expiration
    contracts.sort((a, b) => {
      const scoreA = Math.abs(Math.abs(a.delta) - 0.15) * 50 + a.dte;
      const scoreB = Math.abs(Math.abs(b.delta) - 0.15) * 50 + b.dte;
      return scoreA - scoreB;
    });

    return contracts;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Market Data ──────────────────────────────────────────────

async function fetchPrices() {
  const res = await fetch(STOCKPRICE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-agent/1.0)' },
  });
  if (!res.ok) throw new Error(`stockprice HTTP ${res.status}`);
  const json = await res.json();
  const map = {};
  for (const item of (json.data || [])) {
    map[String(item.symbol || '').toUpperCase()] = {
      price: num(item.price),
      prevClose: num(item.previousClose),
      changePct: num(item.changePercent),
      dailyAtr: num(item.dailyAtr),
      weeklyAtr: num(item.weeklyAtr),
      marketTime: item.marketTime || '',
    };
  }
  return map;
}

async function fetchKline(symbol, range = '3mo') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-agent/1.0)' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      bars.push({
        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        open: num(opens[i]), high: num(highs[i]),
        low: num(lows[i]), close: num(closes[i]),
        volume: num(volumes[i]) || 0,
      });
    }
    return bars;
  } catch {
    return null;
  }
}

function calcKlineStats(bars) {
  if (!bars || bars.length < 5) return null;
  const closes = bars.map(b => b.close);
  const n = closes.length;
  const latest = closes[n - 1];
  const previousClose = closes[n - 2] || closes[n - 1];
  const dailyChangePct = previousClose ? (latest / previousClose - 1) * 100 : null;

  const sma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, n);
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, n);

  // ATR (14-day)
  const trs = [];
  for (let i = 1; i < n; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const atr = trs.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trs.length);

  // 20-day high/low
  const recent20 = bars.slice(-20);
  const high20 = Math.max(...recent20.map(b => b.high));
  const low20 = Math.min(...recent20.map(b => b.low));

  return { latest, previousClose, dailyChangePct, sma5, sma10, sma20, atr, high20, low20, barCount: n };
}

async function fetchNews() {
  try {
    const res = await fetch(NEWS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-agent/1.0)' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).slice(0, 20).map(item => ({
      title: item.title || '',
      content: (item.content || item.summary || '').slice(0, 200),
      time: item.time || item.pubDate || '',
    }));
  } catch {
    return [];
  }
}

// ─── DeepSeek ─────────────────────────────────────────────────

async function callDeepSeek(systemPrompt, userMessage) {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY，请在环境变量或 ~/.donew-agent/.env 中设置');

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  };

  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回空内容');

  return JSON.parse(content);
}

// ─── Decision Engine ──────────────────────────────────────────

function buildJudgmentFactors(symbol, priceInfo, contract, market, decision) {
  const price = priceInfo?.price || null;
  const strike = contract?.strike || null;
  const otm = price && strike ? (1 - strike / price) * 100 : null;
  const atrSafe = market?.atrSafePrice || null;
  const strikeVsSafe = atrSafe && strike ? (strike <= atrSafe ? 'safe' : strike - atrSafe <= market?.atr * 2 ? 'marginal' : 'risky') : '--';
  const vsSma20 = market?.sma20 && price ? (price >= market.sma20 ? 'above' : ((market.sma20 - price) / market.sma20 * 100).toFixed(1) + '% below') : '--';
  const vixLevel = market?.vix == null ? '--' :
    market.vix < 15 ? 'very_low' : market.vix < 20 ? 'low' : market.vix < 25 ? 'moderate' : market.vix < 30 ? 'elevated' : 'high';
  const ivLevel = contract?.iv == null ? '--' :
    contract.iv < 0.25 ? 'low' : contract.iv < 0.50 ? 'moderate' : contract.iv < 0.75 ? 'high' : 'very_high';

  return {
    symbol,
    price,
    otmPct: otm ? Math.round(otm * 100) / 100 : null,
    strikeVsAtrSafe: strikeVsSafe,
    atrSafePrice: atrSafe ? Math.round(atrSafe * 100) / 100 : null,
    priceVsSma20: vsSma20,
    vixLevel,
    ivLevel,
    delta: contract?.delta ? Math.round(contract.delta * 1000) / 1000 : null,
    dte: contract?.dte || null,
    rtnAnnualized: otm && strike && contract?.bid ? parseFloat((contract.bid / strike * 365 / contract.dte * 100).toFixed(1)) : null,
    aiRiskScore: decision?.riskScore ?? null,
    aiStance: decision?.stance ?? '--',
    aiTemperature: decision?.temperature ?? '--',
    aiPutStance: decision?.putStance ?? '--',
    aiBlackSwan: decision?.blackSwan ?? '--',
    aiReasoning: decision?.reasoning ?? '',
    keyRisks: decision?.keyRisks || [],
  };
}

const SYMBOL_NOTES = {
  QLD: 'QLD 是 QQQ 的 2x 杠杆 ETF，其价格波动和 IV 天然是 QQQ 的约2倍。判断时以 OTM 安全垫 % 为主，不要用 SMA 偏离度或 IV 绝对值惩罚 QLD（它跌2倍是正常的）。',
  MSTR: 'MSTR 是 MicroStrategy，大量持有 BTC，波动极大。IV 高是常态，判断时以 ATR 安全行权价和 OTM% 为准，高 IV 不自动视为危险。',
};

function buildSystemPrompt() {
  return `你是一个专注美股卖Put决策的分析Agent。你的唯一职责是基于提供的市场数据、期权合约参数和历史经验，判断当前是否适合卖出 Put 期权。

铁律：
1. 绝不给股票买卖建议（买/卖/做多/做空）
2. 结论只三种：可卖Put / 谨慎卖Put / 暂不卖Put
3. 风险评分 1-10（1=极安全，10=极高风险）
4. 卖Put环境三档：有利 / 谨慎 / 不利
5. 期权温度三档：高温（恐慌溢价）/ 中温（正常）/ 低温（不利卖方）
6. 尾部风险灯号：绿灯（低） / 黄灯（中） / 红灯（高）

判断规则（务必记忆）：
- ATR安全行权价 = 现价 − ATR × √DTE
- ⚠️方向逻辑：行权价 > ATR安全价 = 不安全（行权价太高）。行权价 ≤ ATR安全价 = 安全。
- 行权价是数字，数字越大越危险（更接近现价）
- 推理时禁止说「行权价低于安全价」除非行权价数字确实更小。$84 > $79 是高于，不能说低于。
- VIX > 25 且日涨 > 8% → 至少谨慎
- 价格跌破 SMA20 → 倾向 谨慎/暂不卖
- IV Rank > 90% → 不单独视为卖方优势，需结合趋势

输出格式（JSON）：
{
  "stance": "可卖Put" | "谨慎卖Put" | "暂不卖Put",
  "riskScore": 3,
  "putStance": "有利" | "谨慎" | "不利",
  "temperature": "高温" | "中温" | "低温",
  "blackSwan": "绿灯" | "黄灯" | "红灯",
  "reasoning": "简要理由，2-3句",
  "suggestedStrike": null | 建议行权价数字,
  "suggestedDte": null | 建议DTE数字,
  "suggestedPriceZone": "建议行权价区间描述",
  "keyRisks": ["风险1", "风险2"],
  "monitorSignals": ["信号1", "信号2"]
}`;
}

function buildUserPrompt(symbol, contract, market, news, experience) {
  const symbolNote = SYMBOL_NOTES[symbol] ? `\n> ⚠️ ${SYMBOL_NOTES[symbol]}\n` : '';
  const expText = experience?.patterns?.length
    ? '\n## 历史经验\n' + experience.patterns.map(
        p => `- ${p.finding}（置信度: ${p.confidence}, 样本: ${p.count}）`
      ).join('\n')
    : '';

  const newsText = news.length
    ? news.slice(0, 10).map(n => `- [${n.time}] ${n.title}`).join('\n')
    : '（无新闻数据）';

  return `## 标的
- 代码: ${symbol}${symbolNote}
- 市场: US
- 当前价格: $${market.price?.toFixed(2) || '--'}
- 日变化: ${pctStr(market.changePct)}
- VIX: ${market.vix?.toFixed(1) || '--'}

## 期权合约（自动匹配）
- 行权价: $${contract.strike?.toFixed(2)}
- 到期日: ${contract.expireDate}（DTE: ${contract.dte}）
- Delta: ${contract.delta?.toFixed(3)}
- Bid: $${contract.bid?.toFixed(2)} / Ask: $${contract.ask?.toFixed(2)}
- Mid: $${((contract.bid + (contract.ask || contract.bid)) / 2).toFixed(2)}
- IV: ${contract.iv ? (contract.iv * 100).toFixed(1) + '%' : '--'}
- OTM安全垫: ${market.price ? ((1 - contract.strike / market.price) * 100).toFixed(2) + '%' : '--'}

## 技术指标
- SMA5: ${market.sma5?.toFixed(2) || '--'}
- SMA10: ${market.sma10?.toFixed(2) || '--'}
- SMA20: ${market.sma20?.toFixed(2) || '--'}
- ATR(14): ${market.atr?.toFixed(2) || '--'}
- ATR安全行权价: $${market.atrSafePrice?.toFixed(2) || '--'}
- 20日高点: ${market.high20?.toFixed(2) || '--'}
- 20日低点: ${market.low20?.toFixed(2) || '--'}

## 24小时新闻要点
${newsText}
${expText}

请根据以上数据生成卖Put决策JSON。`;
}

async function getDecision(symbol, contract, market, news, experience) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(symbol, contract, market, news, experience);

  try {
    const result = await callDeepSeek(systemPrompt, userPrompt);

    // Hard enforce: strike above ATR safe price → force downgrade
    const safePrice = market?.atrSafePrice;
    if (safePrice != null && contract.strike > safePrice && result.stance === '可卖Put') {
      result.stance = '谨慎卖Put';
      result.riskScore = Math.max(result.riskScore || 4, 6);
      result.putStance = result.putStance === '有利' ? '谨慎' : result.putStance;
      result.reasoning = '⛔ 行权价$' + contract.strike + ' > ATR安全价$' + safePrice.toFixed(2) + '，强制降级。' + result.reasoning;
      result.keyRisks = [...(result.keyRisks || []), '行权价高于ATR安全行权价'];
    }

    return {
      ok: true,
      ...result,
      model: 'deepseek-chat',
    };
  } catch (error) {
    return {
      ok: false,
      stance: '暂不卖Put',
      riskScore: 7,
      putStance: '谨慎',
      temperature: '中温',
      blackSwan: '黄灯',
      reasoning: `AI调用失败: ${error.message}`,
      keyRisks: [],
      monitorSignals: [],
      error: error.message,
    };
  }
}

// ─── Risk Gates ───────────────────────────────────────────────

function checkRiskGates(stats) {
  const open = loadPositions().filter(p => p.status === 'open');

  if (open.length >= CONFIG.maxOpenPositions) {
    return { canOpen: false, reason: `已达到最大持仓数(${CONFIG.maxOpenPositions})` };
  }
  if (stats.consecutiveLosses >= CONFIG.maxConsecutiveLosses) {
    return { canOpen: false, reason: `连续亏损${stats.consecutiveLosses}笔(上限${CONFIG.maxConsecutiveLosses})，暂停开仓` };
  }
  if (stats.maxDrawdown >= CONFIG.maxDrawdown) {
    return { canOpen: false, reason: `最大回撤${(stats.maxDrawdown*100).toFixed(1)}%已达${(CONFIG.maxDrawdown*100).toFixed(0)}%上限` };
  }
  return { canOpen: true, reason: '' };
}

// ─── Position Tracking ────────────────────────────────────────

function openPaperPosition(symbol, contract, decision) {
  const mid = Math.round((contract.bid + (contract.ask || contract.bid)) / 2 * 100) / 100;
  const capitalPerContract = contract.strike * 100;
  const maxContracts = Math.floor(CONFIG.capital * CONFIG.maxSinglePositionPct / capitalPerContract);
  if (maxContracts < 1) return null;
  const contracts = Math.min(5, maxContracts);
  const premium = Math.round(mid * contracts * 100 * 100) / 100;
  const capitalUsed = capitalPerContract * contracts;
  const annualizedReturn = mid / contract.strike * (365 / contract.dte) * 100;

  return {
    symbol,
    status: 'open',
    openedAt: todayStr(),
    expireDate: contract.expireDate,
    strike: contract.strike,
    premium: mid,
    price: contract.underlyingPrice || null,
    contracts,
    capitalUsed,
    premiumCollected: Math.round(premium * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    riskScore: decision.riskScore,
    putStance: decision.putStance,
    result: null,
    expireClose: null,
  };
}

async function settlePosition(pos, prices) {
  const expireDate = pos.expireDate;
  if (!expireDate || todayStr() < expireDate) return pos;

  const priceData = prices[pos.symbol];
  const closePrice = priceData?.price;
  if (!closePrice) {
    console.log(`  ⚠️ ${pos.symbol}: 无法获取到期日收盘价，跳过结算`);
    return pos;
  }

  const itm = closePrice <= pos.strike;
  pos.expireClose = closePrice;

  if (itm) {
    const lossPerShare = pos.strike - closePrice;
    const totalLoss = lossPerShare * pos.contracts * 100;
    pos.result = 'loss';
    pos.lossAmount = Math.round(totalLoss * 100) / 100;
    pos.pnl = Math.round((pos.premiumCollected - totalLoss) * 100) / 100;
    pos.status = 'closed';
    pos.closedAt = new Date().toISOString();
    console.log(`  ❌ ${pos.symbol} $${pos.strike}P 到期ITM: 收盘$${closePrice} 亏损$${pos.pnl.toFixed(2)}`);
  } else {
    pos.result = 'win';
    pos.pnl = pos.premiumCollected;
    pos.lossAmount = 0;
    pos.status = 'closed';
    pos.closedAt = new Date().toISOString();
    console.log(`  ✅ ${pos.symbol} $${pos.strike}P 到期OTM: 收盘$${closePrice} 盈利$${pos.pnl.toFixed(2)}`);
  }
  return pos;
}

// ─── Stats ─────────────────────────────────────────────────────

function recalcStats() {
  const positions = loadPositions();
  const closed = positions.filter(p => p.status === 'closed');
  const open = positions.filter(p => p.status === 'open');

  const stats = loadStats();
  stats.totalPositions = positions.length;
  stats.wins = closed.filter(p => p.result === 'win').length;
  stats.losses = closed.filter(p => p.result === 'loss').length;
  stats.totalPremium = Math.round(closed.reduce((s, p) => s + (p.premiumCollected || 0), 0) * 100) / 100;
  stats.totalLosses = Math.round(closed.reduce((s, p) => s + (p.lossAmount || 0), 0) * 100) / 100;
  stats.netPnL = Math.round(closed.reduce((s, p) => s + (p.pnl || 0), 0) * 100) / 100;

  // Drawdown tracking
  stats.currentDrawdown = 0;
  if (closed.length) {
    let peak = 0;
    let running = 0;
    for (const p of closed) {
      running += p.pnl || 0;
      if (running > peak) {
        peak = running;
      }
      const dd = peak > 0 ? Math.max(0, (peak - running) / CONFIG.capital) : 0;
      stats.maxDrawdown = Math.max(stats.maxDrawdown, dd);
      stats.currentDrawdown = dd;
    }
  }

  // Consecutive losses (from most recent closed)
  stats.consecutiveLosses = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (closed[i].result === 'loss') stats.consecutiveLosses++;
    else break;
  }

  // By symbol
  stats.bySymbol = {};
  for (const p of closed) {
    const s = p.symbol;
    stats.bySymbol[s] = stats.bySymbol[s] || { positions: 0, wins: 0, losses: 0, netPnL: 0 };
    stats.bySymbol[s].positions++;
    if (p.result === 'win') stats.bySymbol[s].wins++;
    if (p.result === 'loss') stats.bySymbol[s].losses++;
    stats.bySymbol[s].netPnL = Math.round((stats.bySymbol[s].netPnL + (p.pnl || 0)) * 100) / 100;
  }

  saveStats(stats);
  return stats;
}

// ─── Early Close Strategy ─────────────────────────────────────

async function checkEarlyClose() {
  const positions = loadPositions();
  const open = positions.filter(p => p.status === 'open');
  if (!open.length) return [];

  const signals = [];
  const now = new Date();

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (pos.status !== 'open') continue;

    const daysLeft = Math.ceil((new Date(pos.expireDate) - now) / 86400000);
    if (daysLeft < 0) continue; // already expired

    // Skip if just opened today
    if (pos.openedAt === todayStr()) continue;

    let currentMid = null;
    try {
      const contracts = await fetchOptionsChain(pos.symbol, { dteMin: 1 });
      const match = contracts.find(c =>
        Math.abs(c.strike - pos.strike) < 0.01 &&
        c.expireDate === pos.expireDate
      );
      if (match) {
        currentMid = (match.bid + (match.ask || match.bid)) / 2;
      }
    } catch { /* can't fetch current price, skip */ }

    if (currentMid === null || currentMid <= 0) continue;

    const originalMid = pos.premium;
    const premiumRemaining = currentMid / originalMid;
    const profitCapture = (1 - premiumRemaining) * 100;

    let signal = null;

    // Take profit: premium decayed to < 20% of original (captured > 80%)
    if (premiumRemaining <= 0.20) {
      signal = {
        type: 'take_profit', urgency: 'high',
        reason: `权利金衰减至${(premiumRemaining*100).toFixed(0)}%，已捕获${profitCapture.toFixed(0)}%利润`,
      };
    }
    // Time decay victory: < 3 DTE and profitable
    else if (daysLeft <= 3 && premiumRemaining < 0.50) {
      signal = {
        type: 'time_decay_close', urgency: 'medium',
        reason: `剩余${daysLeft}天，权利金已衰减至${(premiumRemaining*100).toFixed(0)}%，剩余风险不值得继续持有`,
      };
    }
    // Stop loss: premium doubled (mark-to-market loss 100%)
    else if (premiumRemaining >= 2.0) {
      signal = {
        type: 'stop_loss', urgency: 'high',
        reason: `权利金已翻倍(${(premiumRemaining*100).toFixed(0)}%)，标的可能已接近行权价，建议止损`,
      };
    }
    // Warning: premium up 50%
    else if (premiumRemaining >= 1.5) {
      signal = {
        type: 'warning', urgency: 'medium',
        reason: `权利金已上涨${((premiumRemaining-1)*100).toFixed(0)}%，密切关注标的走势`,
      };
    }

    if (signal) {
      signal.symbol = pos.symbol;
      signal.strike = pos.strike;
      signal.expireDate = pos.expireDate;
      signal.daysLeft = daysLeft;
      signal.originalPremium = originalMid;
      signal.currentPremium = Math.round(currentMid * 100) / 100;
      signal.premiumRemaining = Math.round(premiumRemaining * 1000) / 10;
      signal.profitCapture = Math.round(profitCapture * 10) / 10;
      signal.positionIndex = i;
      signals.push(signal);
    }
  }

  return signals;
}

async function processEarlyCloseSignals(signals, positions) {
  for (const sig of signals) {
    const emoji = sig.type === 'take_profit' ? '✅' : sig.type === 'stop_loss' ? '🛑' : sig.type === 'time_decay_close' ? '⏰' : '⚠️';
    console.log(`  ${emoji} ${sig.type}: ${sig.symbol} $${sig.strike}P 剩余${sig.daysLeft}天`);
    console.log(`     原始权利金: $${sig.originalPremium} → 当前: $${sig.currentPremium} (${sig.premiumRemaining}%)`);
    console.log(`     利润捕获: ${sig.profitCapture}% | ${sig.reason}`);

    // Auto-close on take_profit or time_decay_close
    if (sig.type === 'take_profit' || sig.type === 'time_decay_close') {
      const idx = sig.positionIndex;
      const actualProfit = Math.round((sig.originalPremium - sig.currentPremium) * positions[idx].contracts * 100 * 100) / 100;
      positions[idx].status = 'closed';
      positions[idx].closedAt = new Date().toISOString();
      positions[idx].result = 'win';
      positions[idx].pnl = actualProfit;
      positions[idx].lossAmount = 0;
      positions[idx].closeNote = `提前平仓: 捕获${sig.profitCapture}%利润 ($${sig.originalPremium}→$${sig.currentPremium})`;
      positions[idx].expireClose = positions[idx].strike + 1;
      console.log(`     📝 自动平仓 (赢) PnL: $${actualProfit}`);
    }
  }
  savePositions(positions);
}

// ─── CLI: daily ───────────────────────────────────────────────

async function runDaily() {
  console.log(`\n🔵 Sell Put Agent · ${new Date().toISOString()}\n`);

  const apiKey = readApiKey();
  if (!apiKey) {
    console.log('⛔ 缺少 DEEPSEEK_API_KEY\n   export DEEPSEEK_API_KEY=sk-xxx\n   或写入 ~/.donew-agent/.env 文件\n');
    return;
  }

  // 1. Load data
  const stats = loadStats();
  const experience = loadExperience();

  // 2. Settle expired positions
  let positions = loadPositions();
  const openBefore = positions.filter(p => p.status === 'open');
  if (openBefore.length) {
    console.log('📋 检查到期持仓...');
    const prices = await fetchPrices();
    let settled = false;
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].status === 'closed') continue;
      positions[i] = await settlePosition(positions[i], prices);
      if (positions[i].status === 'closed') settled = true;
    }
    if (settled) savePositions(positions);
    recalcStats();
  }

  // 2b. Early close check
  positions = loadPositions();
  if (positions.some(p => p.status === 'open')) {
    console.log('💰 提前平仓检查...');
    const earlySignals = await checkEarlyClose();
    if (earlySignals.length) {
      await processEarlyCloseSignals(earlySignals, positions);
    } else {
      console.log('   无需操作');
    }
    recalcStats();
  }

  // 3. Risk gates
  const updatedStats = loadStats();
  const gates = checkRiskGates(updatedStats);
  if (!gates.canOpen) {
    console.log(`⛔ ${gates.reason}`);
  }

  // 4. Pre-fetch shared data
  console.log('📡 获取行情数据...');
  let prices, news;
  try {
    [prices, news] = await Promise.all([fetchPrices(), fetchNews()]);
    console.log(`   ${Object.keys(prices).length} 个标的行情, ${news.length} 条新闻\n`);
  } catch (error) {
    console.log(`   ⚠️ 行情获取异常: ${error.message}\n`);
    return;
  }

  // 5. Process each target
  const decisions = [];
  for (const symbol of TARGETS) {
    console.log(`\n━━━ ${symbol} ━━━`);

    // Options chain
    let contracts;
    try {
      console.log('  🔍 拉取期权链...');
      contracts = await fetchOptionsChain(symbol);
    } catch (error) {
      console.log(`  ⚠️ Barchart期权链获取失败: ${error.message}`);
      saveJournal({
        date: todayStr(), timestamp: new Date().toISOString(), symbol,
        price: prices[symbol]?.price || null,
        contract: null, market: null,
        decision: { stance: '数据获取失败', riskScore: null, putStance: null, temperature: null, blackSwan: null, reasoning: error.message },
      });
      continue;
    }

    if (!contracts.length) {
      console.log(`  ⚠️ 无匹配期权合约`);
      saveJournal({
        date: todayStr(), timestamp: new Date().toISOString(), symbol,
        price: prices[symbol]?.price || null,
        contract: null, market: null,
        decision: { stance: '无信号', riskScore: 10, putStance: '不利', temperature: '--', blackSwan: '--', reasoning: '无匹配期权合约 (DTE 5-25, 有bid)' },
      });
      continue;
    }

    const top3 = contracts.slice(0, 3);
    console.log(`  📊 找到 ${contracts.length} 个候选合约，Top3:`);
    for (const c of top3) {
      const otm = prices[symbol]?.price ? ((1 - c.strike / prices[symbol].price) * 100).toFixed(1) : '--';
      console.log(`     $${c.strike?.toFixed(0)}P | DTE:${c.dte} | Δ:${c.delta?.toFixed(3)} | Bid:$${c.bid?.toFixed(2)} | OTM:${otm}%`);
    }

    // ATR safety filter: use stockprice dailyAtr, fall back to 3% of price estimate
    const dailyAtr = prices[symbol]?.dailyAtr;
    const estAtr = (dailyAtr != null && dailyAtr > 0) ? dailyAtr : ((prices[symbol]?.price || 0) * 0.03);
    const estSafePrice = prices[symbol]?.price && estAtr
      ? prices[symbol].price - estAtr * Math.sqrt(contracts[0].dte || 10)
      : null;
    const safeContracts = estSafePrice ? contracts.filter(c => c.strike <= estSafePrice) : contracts;
    const contract = safeContracts.length ? safeContracts[0] : contracts[0];
    if (!safeContracts.length && estSafePrice) {
      console.log(`  ⚠️ 无ATR安全合约(安全价≤$${estSafePrice.toFixed(0)})，选OTM最大: $${contract.strike}P`);
    }

    // Market data
    const priceInfo = prices[symbol] || {};
    let klineStats = {};

    let bars = null;
    try {
      console.log('  📈 获取K线...');
      bars = await fetchKline(symbol);
      if (bars) {
        klineStats = calcKlineStats(bars) || {};
      }
    } catch { /* ok */ }

    // Save K-line data for chart display
    if (bars && bars.length >= 5) {
      ensureDir(KLINE_DIR);
      saveJson(path.join(KLINE_DIR, symbol + '.json'), { symbol, date: todayStr(), bars, ...klineStats });
    }

    const changePctKline = klineStats?.dailyChangePct;
    const prevCloseKline = klineStats?.previousClose;
    const stockChgPct = priceInfo.changePct;
    const isStockpriceStale = changePctKline != null && stockChgPct != null && Math.abs(changePctKline - stockChgPct) > 3;
    if (isStockpriceStale) {
      console.log(`  ⚠️ 行情中心日变化${stockChgPct?.toFixed(1)}% vs K线${changePctKline?.toFixed(1)}%，使用K线值`);
    }
    const market = {
      price: klineStats?.latest || priceInfo.price,
      prevClose: prevCloseKline || priceInfo.prevClose,
      changePct: changePctKline ?? priceInfo.changePct,
      vix: prices['^VIX']?.price,
      ...klineStats,
      atr: klineStats.atr || priceInfo.dailyAtr,
      atrSafePrice: klineStats?.latest && (klineStats.atr || priceInfo.dailyAtr)
        ? (klineStats.latest || priceInfo.price) - (klineStats.atr || priceInfo.dailyAtr) * Math.sqrt(Math.max(contract.dte, 1))
        : null,
    };

    // AI decision
    console.log('  🧠 AI分析中...');
    const decision = await getDecision(symbol, contract, market, news, experience);

    decisions.push({ symbol, contract, market, decision });

    // Print decision
    const emoji = decision.stance === '可卖Put' ? '✅' : decision.stance === '谨慎卖Put' ? '⚠️' : '❌';
    console.log(`  ${emoji} 结论: ${decision.stance} | 风险: ${decision.riskScore}/10 | 环境: ${decision.putStance}`);
    console.log(`     温度: ${decision.temperature} | 尾部风险: ${decision.blackSwan}`);
    console.log(`     理由: ${decision.reasoning}`);

    // Show suggestions
    if (decision.suggestedStrike) {
      console.log(`     建议行权价: $${decision.suggestedStrike}`);
    }
    if (decision.keyRisks?.length) {
      console.log(`     风险: ${decision.keyRisks.join('; ')}`);
    }

    // Build judgment factors for backtesting
    const factors = buildJudgmentFactors(symbol, priceInfo, contract, market, decision);

    // Save journal
    const alreadyHolding = positions.some(p => p.status === 'open' && p.symbol === symbol);
    let willOpen = !alreadyHolding && gates.canOpen && decision.stance === '可卖Put';
    let actionNote = '不操作';
    let tradeDetail = null;

    if (alreadyHolding) actionNote = '已有持仓';
    else if (!gates.canOpen) actionNote = '风控阻断';
    else if (decision.stance === '谨慎卖Put') actionNote = '谨慎不下单';
    else if (decision.stance === '暂不卖Put') actionNote = '信号不利';

    if (willOpen) {
      const maxContracts = Math.floor(CONFIG.capital * CONFIG.maxSinglePositionPct / (contract.strike * 100));
      const contracts = Math.min(5, maxContracts);
      if (maxContracts < 1) {
        actionNote = '资金不足';
        willOpen = false;
      } else {
        actionNote = `开仓 ${contracts}张`;
      }
      tradeDetail = { strike: contract.strike, premium: Math.round((contract.bid + (contract.ask || contract.bid)) / 2 * 100) / 100, contracts, expireDate: contract.expireDate, dte: contract.dte };
    }

    saveJournal({
      date: todayStr(),
      timestamp: new Date().toISOString(),
      symbol,
      price: priceInfo.price,
      contract: {
        strike: contract.strike,
        expireDate: contract.expireDate,
        dte: contract.dte,
        delta: contract.delta,
        bid: contract.bid,
        ask: contract.ask,
        iv: contract.iv,
        otm: priceInfo.price ? (1 - contract.strike / priceInfo.price) * 100 : null,
      },
      market: {
        vix: market.vix,
        atr: market.atr,
        sma5: market.sma5,
        sma10: market.sma10,
        sma20: market.sma20,
        changePct: market.changePct,
      },
      decision,
      factors,
      action: { result: actionNote, trade: tradeDetail },
    });

    // Open paper position
    if (willOpen) {
      const pos = openPaperPosition(symbol, contract, decision);
      if (pos) {
      positions = loadPositions();
      positions.push(pos);
      savePositions(positions);

      // Record order
      const order = {
        id: `${todayStr()}-${symbol}-${Date.now()}`,
        createdAt: new Date().toISOString(),
        symbol: pos.symbol,
        type: 'SELL_PUT',
        strike: pos.strike,
        expireDate: pos.expireDate,
        contracts: pos.contracts,
        fillPrice: pos.premium,
        bid: contract.bid,
        ask: contract.ask,
        spread: Math.round((contract.ask - contract.bid) * 100) / 100,
        premium: pos.premiumCollected,
        capital: pos.capitalUsed,
        annualizedReturn: pos.annualizedReturn,
        status: 'filled',
      };
      const orders = loadOrders();
      orders.push(order);
      saveOrders(orders);

      const statusEmoji = decision.stance === '可卖Put' ? '📝' : '🧪';
      console.log(`  ${statusEmoji} 模拟成交 (中间价)`);
      console.log(`     成交价: $${pos.premium} | Bid: $${contract.bid} / Ask: $${contract.ask} | 价差: $${order.spread}`);
      console.log(`     数量: ${pos.contracts}张 | 权利金: $${pos.premiumCollected} | 保证金: $${pos.capitalUsed}`);
      console.log(`     年化: ${pos.annualizedReturn}% | 到期: ${pos.expireDate} (${Math.ceil((new Date(pos.expireDate) - new Date()) / 86400000)}天)`);
    }} // end if(pos) / if(willOpen)

    // Update stats
    const s = loadStats();
    s.totalDecisions++;
    saveStats(s);

    // Rate limit between symbols
    if (TARGETS.indexOf(symbol) < TARGETS.length - 1) {
      await sleep(2000);
    }
  }

  // 6. Summary
  const finalStats = recalcStats();
  const openPositions = loadPositions().filter(p => p.status === 'open');

  console.log('\n\n══════ 汇总 ══════');
  console.log(`今日决策: ${decisions.length} 笔  当前持仓: ${openPositions.length} 笔`);
  console.log(`累计: 胜${finalStats.wins} 负${finalStats.losses}  胜率: ${(finalStats.wins + finalStats.losses) ? (finalStats.wins / (finalStats.wins + finalStats.losses) * 100).toFixed(0) : '--'}%  PnL: $${finalStats.netPnL.toFixed(2)}`);
  console.log(`最大回撤: ${(finalStats.maxDrawdown * 100).toFixed(1)}%  连续亏损: ${finalStats.consecutiveLosses} 笔`);

  if (openPositions.length) {
    console.log('\n📌 当前持仓:');
    for (const p of openPositions) {
      const daysLeft = Math.ceil((new Date(p.expireDate) - new Date()) / 86400000);
      console.log(`   ${p.symbol} $${p.strike}P | 到期:${p.expireDate}(${daysLeft}天) | 权利金:$${p.premium}×${p.contracts}张`);
    }
  }
  const dashPath = generateDashboard();
  console.log(`🖥 Dashboard: ${dashPath}`);
  console.log('');
}

// ─── CLI: report ──────────────────────────────────────────────

async function generateReport() {
  const stats = recalcStats();
  const positions = loadPositions();
  const open = positions.filter(p => p.status === 'open');
  const orders = loadOrders();
  const today = todayStr();

  ensureDir(REPORTS_DIR);
  const fpath = path.join(REPORTS_DIR, `${today}.md`);

  // Gather today's journal entries
  const journalDir = JOURNAL_DIR;
  const todayFiles = fs.existsSync(journalDir)
    ? fs.readdirSync(journalDir).filter(f => f.startsWith(today))
    : [];

  let decisions = '';
  for (const fname of todayFiles) {
    const entry = loadJson(path.join(journalDir, fname));
    if (!entry) continue;
    const d = entry.decision || {};
    decisions += `| ${entry.symbol} | $${entry.contract?.strike} | ${entry.contract?.dte}天 | ${d.stance} | ${d.riskScore}/10 | ${d.putStance} | ${d.temperature} |\n`;
  }

  let positionsMd = '';
  for (const p of open) {
    const daysLeft = Math.ceil((new Date(p.expireDate) - new Date()) / 86400000);
    positionsMd += `| ${p.symbol} | $${p.strike}P | ${p.expireDate} (${daysLeft}天) | $${p.premium} | ${p.contracts}张 | $${p.premiumCollected} | ${p.annualizedReturn}% |\n`;
  }

  const recentOrders = orders.slice(-10).reverse();
  let ordersMd = '';
  for (const o of recentOrders) {
    ordersMd += `| ${o.symbol} | $${o.strike}P | $${o.fillPrice} | Bid:$${o.bid} Ask:$${o.ask} | ${o.contracts}张 | $${o.premium} | ${o.annualizedReturn}% |\n`;
  }

  const md = `# Sell Put Agent · 日报 ${today}

## 市场摘要
| 标的 | 价格 | 变化 | VIX |
|:---|---:|---:|---:|
${TARGETS.map(s => `| ${s} | -- | -- | ${stats.bySymbol?.[s] ? '--' : '--'} |`).join('\n')}

## 今日决策
| 标的 | 行权价 | DTE | 结论 | 风险分 | 环境 | 温度 |
|:---|:---|---:|:---|:---|:---|:---|
${decisions || '| -- | -- | -- | 无决策 | -- | -- | -- |'}

## 当前持仓
| 标的 | 合约 | 到期 | 权利金 | 数量 | 总权利金 | 年化 |
|:---|:---|---:|:---|:---|:---|:---|
${positionsMd || '| -- | -- | -- | -- | -- | -- | -- |'}

## 最近订单
| 标的 | 合约 | 成交价 | 报价 | 数量 | 权利金 | 年化 |
|:---|:---|---:|:---|:---|:---|:---|
${ordersMd || '| -- | -- | -- | -- | -- | -- | -- |'}

## 累计统计
- 总决策: ${stats.totalDecisions} | 总交易: ${stats.totalPositions}
- 胜: ${stats.wins} | 负: ${stats.losses} | 胜率: ${(stats.wins + stats.losses) ? (stats.wins / (stats.wins + stats.losses) * 100).toFixed(0) : '--'}%
- 净PnL: $${stats.netPnL.toFixed(2)}
- 最大回撤: ${(stats.maxDrawdown * 100).toFixed(1)}%
- 连续亏损: ${stats.consecutiveLosses}笔
`;

  fs.writeFileSync(fpath, md, 'utf-8');
  console.log(`\n📄 报告已生成: ${fpath}`);
  console.log(md);
}

// ─── CLI: setup ───────────────────────────────────────────────

async function setupCron() {
  // Write API key to .env
  const apiKey = readApiKey();
  if (!apiKey) {
    console.log('⛔ 请先设置 DEEPSEEK_API_KEY\n   export DEEPSEEK_API_KEY=sk-xxx\n');
    return;
  }

  // Save .env file
  ensureDir(AGENT_DIR);
  fs.writeFileSync(ENV_FILE, `DEEPSEEK_API_KEY=${apiKey}\n`, 'utf-8');
  console.log(`✅ API Key 已写入 ${ENV_FILE}`);

  // Find node path
  let nodePath = '/opt/homebrew/bin/node';
  try {
    const { execSync } = await import('node:child_process');
    nodePath = execSync('which node', { encoding: 'utf-8' }).trim() || nodePath;
  } catch { /* keep default */ }

  const scriptPath = path.resolve(import.meta.url.replace('file://', ''));
  const repoDir = path.resolve(scriptPath, '../../');
  const logFile = path.join(AGENT_DIR, 'cron.log');
  const pidFile = path.join(AGENT_DIR, 'cron.pid');

  // Create wrapper script
  const runScript = path.join(AGENT_DIR, 'run-daily.sh');
  const sh = `#!/bin/bash
# Auto-generated by sell-put-agent setup
# Runs daily at 9:00 AM via launchd
cd "${repoDir}"
export DEEPSEEK_API_KEY="${apiKey}"
${nodePath} "${scriptPath}" daily >> "${logFile}" 2>&1
`;
  fs.writeFileSync(runScript, sh, { mode: 0o755 });
  console.log(`✅ 启动脚本已创建: ${runScript}`);

  // Create launchd plist
  // Every 15 min during US session: 21:30 → 04:30 (HK time) — 29 runs
  const intervals = [];
  for (let h = 21; h <= 23; h++) for (const m of h === 21 ? [30, 45] : [0, 15, 30, 45]) intervals.push({ Hour: h, Minute: m });
  for (let h = 0; h <= 3; h++) for (const m of [0, 15, 30, 45]) intervals.push({ Hour: h, Minute: m });
  intervals.push({ Hour: 4, Minute: 0 }, { Hour: 4, Minute: 15 }, { Hour: 4, Minute: 30 });

  const intervalXml = intervals.map(({ Hour, Minute }) =>
    `    <dict>\n        <key>Hour</key>\n        <integer>${Hour}</integer>\n        <key>Minute</key>\n        <integer>${Minute}</integer>\n    </dict>`
  ).join('\n');

  const plistPath = path.join(homedir(), 'Library/LaunchAgents/com.donew.sellput.plist');
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.donew.sellput</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${runScript}</string>
    </array>
    <key>StartCalendarInterval</key>
    <array>
${intervalXml}
    </array>
    <key>StandardOutPath</key>
    <string>${logFile}</string>
    <key>StandardErrorPath</key>
    <string>${logFile}</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>`;
  ensureDir(path.dirname(plistPath));
  fs.writeFileSync(plistPath, plist, 'utf-8');
  console.log(`✅ LaunchAgent 已创建: ${plistPath}`);
  console.log(`\n📋 加载并启动：`);
  console.log(`   launchctl load ${plistPath}`);
  console.log(`\n📋 卸载：`);
  console.log(`   launchctl unload ${plistPath}`);
  console.log(`\n📋 日志：`);
  console.log(`   tail -f ${logFile}`);
  console.log(`\n⏰ 运行时间: 每天晚上 21:30 – 凌晨 04:30，每 15 分钟一次`);
}

// ─── CLI: env ─────────────────────────────────────────────────

async function setupEnv() {
  if (process.env.DEEPSEEK_API_KEY) {
    ensureDir(AGENT_DIR);
    fs.writeFileSync(ENV_FILE, `DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY}\n`, 'utf-8');
    console.log(`✅ API Key 已从环境变量写入 ${ENV_FILE}`);
  } else {
    console.log('⛔ 未设置 DEEPSEEK_API_KEY 环境变量');
    console.log('   使用方法: export DEEPSEEK_API_KEY=sk-xxx && node scripts/sell-put-agent.mjs env');
  }
}

// ─── CLI: dashboard ───────────────────────────────────────────

function buildDashboardHtml() {
  const stats = recalcStats();
  const positions = loadPositions();
  const orders = loadOrders();
  const experience = loadExperience();

  // Gather all journal entries
  const journalDir = JOURNAL_DIR;
  const journalFiles = fs.existsSync(journalDir)
    ? fs.readdirSync(journalDir).filter(f => f.endsWith('.json')).sort().reverse()
    : [];
  const journalEntries = journalFiles.map(f => loadJson(path.join(journalDir, f))).filter(Boolean).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Enrich positions with current price from latest journal
  const latestBySymbol = {};
  for (const entry of journalEntries) {
    if (!latestBySymbol[entry.symbol]) latestBySymbol[entry.symbol] = entry;
  }
  for (const pos of positions) {
    const latest = latestBySymbol[pos.symbol];
    if (latest) {
      pos.currentPrice = latest.price;
      pos.currentPutMid = latest.contract ? Math.round((latest.contract.bid + (latest.contract.ask || latest.contract.bid)) / 2 * 100) / 100 : null;
      pos.currentOtm = latest.contract?.otm;
    }
  }

  const capitalInfo = {
    total: 100000,
    deployed: Math.round(positions.filter(p => p.status === 'open').reduce((s, p) => s + (p.capitalUsed || 0), 0) * 100) / 100,
    pendingPremium: Math.round(positions.filter(p => p.status === 'open').reduce((s, p) => s + (p.premiumCollected || 0), 0) * 100) / 100,
    realizedPnL: Math.round(stats.netPnL * 100) / 100,
    totalEquity: Math.round((100000 + (positions.filter(p => p.status === 'closed' && p.result).reduce((s, p) => s + (p.pnl || 0), 0)) + positions.filter(p => p.status === 'open').reduce((s, p) => s + (p.premiumCollected || 0), 0)) * 100) / 100,
    maxDrawdown: Math.round(stats.maxDrawdown * 10000) / 100,
  };
  capitalInfo.available = Math.round((capitalInfo.total - capitalInfo.deployed) * 100) / 100;
  capitalInfo.deploymentRate = Math.round(capitalInfo.deployed / capitalInfo.total * 1000) / 10;

  const scanData = loadJson(SCAN_RESULT_FILE) || { results: [], scannedAt: null };
  const currentTargets = loadTargets();

  // Load K-line data for symbols with positions
  const klineData = {};
  const symbolsWithKline = [...new Set([...positions.map(p => p.symbol), ...currentTargets])];
  for (const sym of symbolsWithKline) {
    const kf = loadJson(path.join(KLINE_DIR, sym + '.json'));
    if (kf && kf.bars) klineData[sym] = kf;
  }

  const dataJson = JSON.stringify({ stats, positions, orders: orders.slice(-50).reverse(), journalEntries: journalEntries.slice(0, 100), experience, capital: capitalInfo, scan: scanData, targets: currentTargets, kline: klineData, generatedAt: new Date().toISOString() });

  const html = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sell Put Agent · 仪表板</title>
<script src="https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#0d1522;color:#cddbf7;line-height:1.5;padding:0}
h1{font-size:1.5rem;font-weight:700;color:#fff;margin:0}
h2{font-size:1.15rem;font-weight:600;color:#dce7fb;margin:18px 0 10px}
.header{background:#131d31;border-bottom:1px solid #1f2b44;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10}
.header span{font-size:.85rem;color:#6b7fa3}
.tabs{display:flex;gap:2px;padding:0 24px;background:#131d31;border-bottom:1px solid #1f2b44}
.tab{padding:10px 18px;font-size:.9rem;font-weight:600;cursor:pointer;color:#6b7fa3;border:none;background:none;border-bottom:2px solid transparent;transition:all .15s}
.tab:hover{color:#b0c4e8}
.tab.active{color:#4d9eff;border-bottom-color:#4d9eff}
.panels{padding:20px 24px;max-width:1200px;margin:0 auto}
.panel{display:none}
.panel.active{display:block}
table{width:100%;border-collapse:collapse;font-size:.9rem;background:#111d2f;border-radius:10px;overflow:hidden;margin:10px 0}
th{background:#1a2942;padding:10px 12px;text-align:left;font-weight:600;color:#b0c4e8;font-size:.82rem}
td{padding:10px 12px;border-bottom:1px solid #1f2b44}
tr:last-child td{border-bottom:none}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-weight:700;font-size:.78rem}
.badge-green{background:#1b3a2a;color:#45d483}
.badge-yellow{background:#3d3520;color:#ffd54a}
.badge-red{background:#3d1e2a;color:#ff6b7d}
.badge-blue{background:#1a2d4d;color:#4d9eff}
.badge-gray{background:#1f2b44;color:#6b7fa3}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:12px 0}
.stat-card{background:#111d2f;border:1px solid #1f2b44;border-radius:10px;padding:14px 16px}
.stat-label{font-size:.78rem;color:#6b7fa3;margin-bottom:4px}
.stat-value{font-size:1.4rem;font-weight:700;color:#dce7fb}
.stat-sub{font-size:.78rem;color:#45d483;margin-top:2px}
.up{color:#45d483}.dn{color:#ff6b7d}.warn{color:#ffd54a}.muted{color:#6b7fa3;font-size:.82rem}
.risk-bar{height:4px;border-radius:2px;background:#1f2b44;margin-top:4px}
.risk-bar div{height:100%;border-radius:2px}
.risk-low{background:#45d483}.risk-mid{background:#ffd54a}.risk-high{background:#ff6b7d}
.cal-nav{display:flex;align-items:center;gap:16px;margin:12px 0}
.cal-nav button{background:#1a2942;border:1px solid #1f2b44;color:#b0c4e8;padding:4px 14px;border-radius:6px;cursor:pointer;font-size:.85rem}
.cal-nav button:hover{background:#22304d}
.cal-nav h3{margin:0;color:#dce7fb;font-size:1.1rem;min-width:140px;text-align:center}
.calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;max-width:500px;margin:0}
.cal-cell{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;font-size:.82rem;font-weight:600;cursor:default;background:#111d2f;border:1px solid #1a2942}
.cal-cell.other{opacity:.3}
.cal-header{font-size:.7rem;color:#6b7fa3;font-weight:700;background:none;border:none;aspect-ratio:auto;padding:4px 0}
.cal-pos{background:#1b3a2a !important;border-color:#2a5a40;color:#45d483}
.cal-neg{background:#3d1e2a !important;border-color:#5a2a3a;color:#ff6b7d}
.cal-pend{background:#2a3520 !important;border-color:#4a5a30;color:#a0c060}
.cal-today{border:2px solid #4d9eff !important}
.capital-bar{display:flex;gap:0;border-radius:10px;overflow:hidden;height:8px;margin:8px 0 16px}
.capital-used{background:#4d9eff}.capital-free{background:#1f2b44}.capital-pending{background:#45d483}
.capital-stats{display:flex;gap:24px;flex-wrap:wrap;margin:4px 0 12px}
.cap-item{display:flex;flex-direction:column}
.cap-label{font-size:.75rem;color:#6b7fa3}
.cap-value{font-size:1.1rem;font-weight:700;color:#dce7fb}
.cal-cell .day{line-height:1}.cal-cell .pnl{font-size:.6rem;margin-top:1px}
.month-summary{display:flex;gap:20px;margin:12px 0;flex-wrap:wrap}
.month-card{background:#111d2f;border:1px solid #1f2b44;border-radius:10px;padding:10px 16px}
.month-card .label{font-size:.75rem;color:#6b7fa3}
.month-card .value{font-size:1rem;font-weight:700}
.filter-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}
.filter-bar select,.filter-bar input{padding:6px 12px;background:#111d2f;border:1px solid #1f2b44;color:#cddbf7;border-radius:6px;font-size:.82rem;outline:none}
.filter-bar select:focus,.filter-bar input:focus{border-color:#4d9eff}
.filter-bar label{font-size:.8rem;color:#6b7fa3}
.pagination{display:flex;gap:6px;justify-content:center;margin:16px 0}
.pagination button{padding:6px 14px;background:#1a2942;border:1px solid #1f2b44;color:#b0c4e8;border-radius:6px;cursor:pointer;font-size:.82rem}
.pagination button:hover{background:#22304d}
.pagination button.active{background:#4d9eff;color:#fff;border-color:#4d9eff}
.pagination span{color:#6b7fa3;font-size:.82rem;display:flex;align-items:center}
.reason{font-size:.84rem;color:#8fa4c4;max-width:500px;line-height:1.5;white-space:normal}
details{margin:8px 0}details>summary{cursor:pointer;color:#4d9eff;font-size:.85rem;font-weight:600}
.footer{text-align:center;padding:20px;color:#6b7fa3;font-size:.78rem}
</style>
</head>
<body>
<div class="header">
  <h1>📊 Sell Put Agent</h1>
  <span>Generated: <span id="genTime"></span>
  <label style="margin-left:12px;cursor:pointer;font-size:.8rem;color:#6b7fa3"><input type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh()" style="vertical-align:middle;margin-right:4px">自动刷新 <span id="refreshCountdown"></span></label>
  <button onclick="location.reload()" style="padding:4px 14px;background:#1a2942;border:1px solid #1f2b44;color:#b0c4e8;border-radius:6px;cursor:pointer;margin-left:10px;font-size:.8rem">🔄 刷新</button></span>
</div>
<div class="tabs">
  <button class="tab active" onclick="switchTab('positions')">持仓</button>
  <button class="tab" onclick="switchTab('orders')">交易明细</button>
  <button class="tab" onclick="switchTab('journal')">判断日志</button>
  <button class="tab" onclick="switchTab('stats')">统计</button>
  <button class="tab" onclick="switchTab('scan')">标的扫描</button>
  <button class="tab" onclick="switchTab('kline')">K线</button>
  <button class="tab" onclick="switchTab('settings')">设置</button>
</div>
<div class="panels">
  <div id="panel-positions" class="panel active"></div>
  <div id="panel-orders" class="panel"></div>
  <div id="panel-journal" class="panel"></div>
  <div id="panel-stats" class="panel"></div>
  <div id="panel-scan" class="panel"></div>
  <div id="panel-kline" class="panel" style="position:relative;min-height:500px"></div>
  <div id="panel-settings" class="panel"></div>
</div>
<div class="footer">Sell Put Agent · Paper Trading Dashboard</div>
<script>
const DATA = ${dataJson};

document.getElementById('genTime').textContent = new Date(DATA.generatedAt).toLocaleString('zh-HK');

let refreshTimer = null;
let refreshSeconds = 600;

function toggleAutoRefresh() {
  const checked = document.getElementById('autoRefresh').checked;
  if (checked) {
    refreshSeconds = 600;
    updateCountdown();
    refreshTimer = setInterval(() => {
      refreshSeconds--;
      updateCountdown();
      if (refreshSeconds <= 0) location.reload();
    }, 1000);
  } else {
    clearInterval(refreshTimer);
    refreshTimer = null;
    document.getElementById('refreshCountdown').textContent = '';
  }
}

function updateCountdown() {
  const m = Math.floor(refreshSeconds / 60);
  const s = refreshSeconds % 60;
  document.getElementById('refreshCountdown').textContent = '(' + m + ':' + String(s).padStart(2,'0') + ')';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  sessionStorage.setItem('activeTab', name);
}

// Restore last active tab on load
(function() {
  const lastTab = sessionStorage.getItem('activeTab');
  if (lastTab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const tabBtn = document.querySelector('.tab[onclick*=\"'+lastTab+'\"]');
    if (tabBtn) tabBtn.classList.add('active');
    const panel = document.getElementById('panel-' + lastTab);
    if (panel) panel.classList.add('active');
  }
})();

function riskColor(score) {
  if (score == null) return '#6b7fa3';
  if (score <= 3) return '#45d483';
  if (score <= 5) return '#ffd54a';
  return '#ff6b7d';
}

function stanceBadge(s) {
  if (s === '可卖Put') return '<span class="badge badge-green">可卖Put</span>';
  if (s === '谨慎卖Put') return '<span class="badge badge-yellow">谨慎卖Put</span>';
  if (s === '暂不卖Put' || s === '数据获取失败') return '<span class="badge badge-red">'+s+'</span>';
  return '<span class="badge badge-gray">'+s+'</span>';
}

// Positions panel
(function() {
  const p = DATA.positions;
  const open = p.filter(x => x.status === 'open');
  const closed = p.filter(x => x.status === 'closed' || x.status === 'cancelled').slice(-20);

  // Capital overview
  const c = DATA.capital;
  const deployedPct = c.deployed / c.total * 100;
  let html = '<h2>资金总览</h2>';
  html += '<div class="capital-stats">';
  html += '<div class="cap-item"><span class="cap-label">总资金</span><span class="cap-value">$'+c.total.toLocaleString()+'</span></div>';
  html += '<div class="cap-item"><span class="cap-label">已部署</span><span class="cap-value" style="color:#4d9eff">$'+c.deployed.toLocaleString()+' ('+c.deploymentRate+'%)</span></div>';
  html += '<div class="cap-item"><span class="cap-label">可用</span><span class="cap-value" style="color:#6b7fa3">$'+c.available.toLocaleString()+'</span></div>';
  html += '<div class="cap-item"><span class="cap-label">待结算权利金</span><span class="cap-value" style="color:#45d483">$'+c.pendingPremium.toLocaleString()+'</span></div>';
  html += '<div class="cap-item"><span class="cap-label">已实现盈亏</span><span class="cap-value '+(c.realizedPnL>=0?'up':'dn')+'">$'+c.realizedPnL.toLocaleString()+'</span></div>';
  html += '<div class="cap-item"><span class="cap-label">当前权益</span><span class="cap-value '+(c.totalEquity>=c.total?'up':'dn')+'">$'+c.totalEquity.toLocaleString()+'</span></div>';
  html += '</div>';
  html += '<div class="capital-bar"><div class="capital-used" style="width:'+deployedPct+'%"></div><div class="capital-free" style="width:'+(100-deployedPct)+'%"></div></div>';

  html += '<h2>当前持仓 (' + open.length + ')</h2>';
  if (open.length) {
    html += '<table><thead><tr><th>标的</th><th>合约</th><th>到期</th><th>剩</th><th>现价</th><th>开仓价</th><th>当前</th><th>浮盈</th><th>张</th><th>权利金</th><th>年化</th><th>风险</th></tr></thead><tbody>';
    for (const pos of open) {
      const days = Math.ceil((new Date(pos.expireDate) - new Date()) / 86400000);
      const cPx = pos.currentPrice || pos.price || null;
      const cMid = pos.currentPutMid;
      const oMid = pos.premium;
      const pnl = cMid != null && oMid ? Math.round((oMid - cMid) * pos.contracts * 100) : null;
      const pnlClass = pnl === null ? 'muted' : pnl >= 0 ? 'up' : 'dn';
      const pnlStr = pnl === null ? '--' : (pnl >= 0 ? '+' : '') + '$' + pnl;
      const putDir = cMid != null && oMid ? (cMid < oMid ? ' ↓' : cMid > oMid ? ' ↑' : '') : '';
      html += '<tr><td><b>'+pos.symbol+'</b></td><td>$'+pos.strike+'P</td><td>'+pos.expireDate.slice(5)+'</td><td>'+days+'天</td><td>$'+(cPx||'--')+'</td><td>$'+oMid+'</td><td>$'+(cMid!=null?cMid:'--')+putDir+'</td><td class="'+pnlClass+'" style="font-weight:700">'+pnlStr+'</td><td>'+pos.contracts+'张</td><td>$'+pos.premiumCollected+'</td><td>'+pos.annualizedReturn+'%</td><td style="color:'+riskColor(pos.riskScore)+'">'+pos.riskScore+'/10</td></tr>';
    }
    html += '</tbody></table>';
  } else {
    html += '<p class="muted">无持仓</p>';
  }
  
  if (closed.length) {
    html += '<h2>已结算 (' + closed.length + ')</h2>';
    html += '<table><thead><tr><th>标的</th><th>合约</th><th>开仓日</th><th>到期日</th><th>结果</th><th>PnL</th><th>成交价</th></tr></thead><tbody>';
    for (const pos of closed) {
      const resultBadge = pos.result === 'win' ? '<span class="badge badge-green">胜</span>' : pos.result === 'cancelled' ? '<span class="badge badge-gray">取消</span>' : '<span class="badge badge-red">负</span>';
      html += '<tr><td><b>'+pos.symbol+'</b></td><td>$'+pos.strike+'P</td><td>'+pos.openedAt+'</td><td>'+pos.expireDate+'</td><td>'+resultBadge+'</td><td class="'+(pos.pnl>=0?'up':'dn')+'">$'+ (pos.pnl||0).toFixed(2)+'</td><td>$'+pos.premium+'</td></tr>';
    }
    html += '</tbody></table>';
  }
  document.getElementById('panel-positions').innerHTML = html;
})();

// Orders panel (includes closed/cancelled positions)
(function() {
  const orders = DATA.orders || [];
  const allPositions = DATA.positions || [];
  const closed = allPositions.filter(p => p.status === 'closed' || p.status === 'cancelled');
  
  // Merge orders and closed positions into unified trade list
  const trades = [];
  for (const o of orders) {
    trades.push({ type: 'open', time: o.createdAt, symbol: o.symbol, strike: o.strike, fillPrice: o.fillPrice, bid: o.bid, ask: o.ask, spread: o.spread, contracts: o.contracts, premium: o.premium, annualizedReturn: o.annualizedReturn });
  }
  for (const p of closed) {
    trades.push({ type: 'close', time: p.closedAt || p.openedAt, symbol: p.symbol, strike: p.strike, fillPrice: p.premium, bid: null, ask: null, spread: null, contracts: p.contracts, premium: p.premiumCollected || 0, annualizedReturn: p.annualizedReturn || 0, result: p.result, reason: p.closeNote || '', pnl: p.pnl || 0 });
  }
  trades.sort((a, b) => new Date(b.time) - new Date(a.time));

  let html = '<h2>交易明细 (' + trades.length + ')</h2>';
  if (!trades.length) { html += '<p class="muted">暂无记录</p>'; }
  else {
    html += '<table><thead><tr><th>时间</th><th>类型</th><th>标的</th><th>合约</th><th>成交价</th><th>数量</th><th>权利金</th><th>结果</th></tr></thead><tbody>';
    for (const tr of trades) {
      const t = typeof tr.time === 'string' ? new Date(tr.time).toLocaleString('zh-HK', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : tr.time;
      const typeBadge = tr.type === 'open' ? '<span class="badge badge-green">开仓</span>' :
        tr.result === 'cancelled' ? '<span class="badge badge-gray">取消</span>' :
        tr.result === 'win' ? '<span class="badge badge-green">平仓</span>' : '<span class="badge badge-red">平仓</span>';
      const resultStr = tr.type === 'open' ? '<span class="muted">待到期</span>' :
        tr.result === 'cancelled' ? '<span class="badge badge-gray">'+tr.reason+'</span>' :
        tr.result === 'win' ? '<span class="up">+$'+tr.pnl.toFixed(2)+'</span>' : '<span class="dn">-$'+tr.pnl.toFixed(2)+'</span>';
      html += '<tr><td class="muted">'+t+'</td><td>'+typeBadge+'</td><td><b>'+tr.symbol+'</b></td><td>$'+tr.strike+'P</td><td>$'+(tr.fillPrice||0).toFixed(2)+'</td><td>'+tr.contracts+'张</td><td>$'+tr.premium.toFixed(2)+'</td><td>'+resultStr+'</td></tr>';
    }
    html += '</tbody></table>';
  }
  document.getElementById('panel-orders').innerHTML = html;
})();

// Journal panel (with filter + pagination)
(function() {
  const entries = DATA.journalEntries;
  const PER_PAGE = 100;
  let page = 0;
  let pageSize = 100;
  let filterSymbol = 'all';
  let filterStance = 'all';
  let filterAction = 'all';
  let filterDateFrom = '';
  let filterDateTo = '';
  let searchText = '';

  function actionBadgeHTML(act) {
    if (!act) return '<span class="badge badge-gray">--</span>';
    if (act.trade) return '<span class="badge badge-green">开仓'+act.trade.contracts+'张 $'+act.trade.strike+'P</span>';
    if (act.result === '已有持仓') return '<span class="badge badge-blue">已有持仓</span>';
    if (act.result === '风控阻断') return '<span class="badge badge-red">风控阻断</span>';
    if (act.result === '信号不利') return '<span class="badge badge-red">信号不利</span>';
    if (act.result === '平仓') return '<span class="badge badge-yellow">平仓</span>';
    if (act.result === '清算') return '<span class="badge badge-yellow">清算</span>';
    return '<span class="badge badge-gray">'+act.result+'</span>';
  }

  function renderJournal() {
    let filtered = entries;
    if (filterSymbol !== 'all') filtered = filtered.filter(e => e.symbol === filterSymbol);
    if (filterStance !== 'all') filtered = filtered.filter(e => e.decision?.stance === filterStance);
    if (filterAction !== 'all') {
      if (filterAction === '开仓+平仓') filtered = filtered.filter(e => e.action?.trade != null || /平仓|取消/.test(e.action?.result || ''));
      else if (filterAction === '开仓') filtered = filtered.filter(e => e.action?.trade != null);
      else if (filterAction === '平仓') filtered = filtered.filter(e => !e.action?.trade && /平仓|取消/.test(e.action?.result || ''));
      else if (filterAction === '清算') filtered = filtered.filter(e => !e.action?.trade && /到期|结算|清算|win|loss/.test(e.action?.result || ''));
      else if (filterAction === '其他') filtered = filtered.filter(e => !e.action?.trade && !/平仓|取消|到期|结算|清算|win|loss/.test(e.action?.result || ''));
    }
    if (filterDateFrom) filtered = filtered.filter(e => e.date >= filterDateFrom);
    if (filterDateTo) filtered = filtered.filter(e => e.date <= filterDateTo);
    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(e => (e.decision?.reasoning || '').toLowerCase().includes(q) || (e.action?.result || '').includes(q));
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page >= totalPages) page = totalPages - 1;
    const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);

    let html = '<h2>判断日志 <span style="font-weight:400;font-size:.85rem;color:#6b7fa3">('+filtered.length+'条'+(filtered.length !== entries.length ? '/共'+entries.length+'条' : '')+')</span></h2>';

    // Filter bar
    html += '<div class="filter-bar">';
    html += '<label>标的</label><select id="jf-symbol" onchange="journalFilterSymbol()">';
    html += '<option value="all"'+(filterSymbol==='all'?' selected':'')+'>全部</option>';
    const syms = [...new Set(entries.map(e => e.symbol))].sort();
    for (const s of syms) html += '<option value="'+s+'"'+(filterSymbol===s?' selected':'')+'>'+s+'</option>';
    html += '</select>';
    html += '<label>结论</label><select id="jf-stance" onchange="journalFilterStance()">';
    html += '<option value="all"'+(filterStance==='all'?' selected':'')+'>全部</option>';
    html += '<option value="可卖Put"'+(filterStance==='可卖Put'?' selected':'')+'>可卖Put</option>';
    html += '<option value="谨慎卖Put"'+(filterStance==='谨慎卖Put'?' selected':'')+'>谨慎卖Put</option>';
    html += '<option value="暂不卖Put"'+(filterStance==='暂不卖Put'?' selected':'')+'>暂不卖Put</option>';
    html += '</select>';
    html += '<label>操作</label><select id="jf-action" onchange="journalFilterAction()">';
    html += '<option value="all"'+(filterAction==='all'?' selected':'')+'>全部</option>';
    html += '<option value="开仓+平仓"'+(filterAction==='开仓+平仓'?' selected':'')+'>开仓+平仓</option>';
    html += '<option value="开仓"'+(filterAction==='开仓'?' selected':'')+'>开仓</option>';
    html += '<option value="平仓"'+(filterAction==='平仓'?' selected':'')+'>平仓</option>';
    html += '<option value="清算"'+(filterAction==='清算'?' selected':'')+'>清算</option>';
    html += '<option value="其他"'+(filterAction==='其他'?' selected':'')+'>其他</option>';
    html += '</select>';
    html += '<label>日期</label><input id="jf-datefrom" type="date" value="'+filterDateFrom+'" onchange="journalFilterDate()" style="width:130px">';
    html += '<span style="color:#6b7fa3">至</span>';
    html += '<input id="jf-dateto" type="date" value="'+filterDateTo+'" onchange="journalFilterDate()" style="width:130px">';
    html += '<input id="jf-search" type="text" placeholder="搜索理由..." value="'+searchText+'" oninput="journalSearch()" style="width:180px">';
    html += '</div>';

    if (!slice.length) { html += '<p class="muted">无匹配记录</p>'; }
    else {
      html += '<table><thead><tr><th>时间</th><th>标的</th><th>价格</th><th>合约</th><th>OTM</th><th>Δ</th><th>年化</th><th>结论</th><th>风险</th><th>操作</th><th>理由</th></tr></thead><tbody>';
      for (const e of slice) {
        const t = new Date(e.timestamp).toLocaleString('zh-HK', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
        const contract = e.contract ? '$'+e.contract.strike+'P DTE'+e.contract.dte : '--';
        const otm = e.contract?.otm != null ? e.contract.otm.toFixed(1)+'%' : '--';
        const delta = e.contract?.delta != null ? e.contract.delta.toFixed(3) : '--';
        const annual = e.factors?.rtnAnnualized != null ? e.factors.rtnAnnualized+'%' : (e.contract?.bid && e.contract?.strike && e.contract?.dte ? (e.contract.bid / e.contract.strike * 365 / e.contract.dte * 100).toFixed(0)+'%' : '--');
        const reason = e.decision?.reasoning || '';
        html += '<tr><td class="muted">'+t+'</td><td><b>'+e.symbol+'</b></td><td>$'+e.price+'</td><td>'+contract+'</td><td>'+otm+'</td><td>'+delta+'</td><td>'+annual+'</td><td>'+stanceBadge(e.decision?.stance)+'</td><td style="color:'+riskColor(e.decision?.riskScore)+';font-weight:700">'+e.decision?.riskScore+'/10</td><td>'+actionBadgeHTML(e.action)+'</td><td class="reason">'+reason+'</td></tr>';
      }
      html += '</tbody></table>';

      // Pagination
      if (totalPages > 1 || filtered.length > 5) {
        html += '<div class="pagination"><button onclick="journalGo(0)"'+(page===0?' disabled':'')+'>|<</button><button onclick="journalGo('+(page-1)+')"'+(page===0?' disabled':'')+'>←</button><span>第'+(page+1)+'/'+totalPages+'页 共'+filtered.length+'条</span><button onclick="journalGo('+(page+1)+')"'+(page>=totalPages-1?' disabled':'')+'>→</button><button onclick="journalGo('+(totalPages-1)+')"'+(page>=totalPages-1?' disabled':'')+'>>|</button>';
        html += '<select onchange="journalPageSize(this.value)" style="margin-left:8px;padding:4px 8px;background:#111d2f;border:1px solid #1f2b44;color:#cddbf7;border-radius:4px;font-size:.78rem">';
        html += '<option value="10"'+(pageSize===10?' selected':'')+'>10条/页</option>';
        html += '<option value="20"'+(pageSize===20?' selected':'')+'>20条/页</option>';
        html += '<option value="50"'+(pageSize===50?' selected':'')+'>50条/页</option>';
        html += '<option value="100"'+(pageSize===100?' selected':'')+'>100条/页</option>';
        html += '</select></div>';
      }
    }
    document.getElementById('panel-journal').innerHTML = html;
  }

  renderJournal();
  window.journalGo = function(p) {
    page = p;
    renderJournal();
  };
  window.journalPageSize = function(v) {
    pageSize = parseInt(v);
    page = 0;
    renderJournal();
  };
  window.journalFilterSymbol = function() {
    filterSymbol = document.getElementById('jf-symbol').value;
    page = 0;
    renderJournal();
  };
  window.journalFilterStance = function() {
    filterStance = document.getElementById('jf-stance').value;
    page = 0;
    renderJournal();
  };
  window.journalSearch = function() {
    searchText = document.getElementById('jf-search').value;
    page = 0;
    renderJournal();
  };
  window.journalFilterAction = function() {
    filterAction = document.getElementById('jf-action').value;
    page = 0;
    renderJournal();
  };
  window.journalFilterDate = function() {
    filterDateFrom = document.getElementById('jf-datefrom').value;
    filterDateTo = document.getElementById('jf-dateto').value;
    page = 0;
    renderJournal();
  };
})();

// Stats panel with calendar
(function() {
  const s = DATA.stats;
  const positions = DATA.positions;
  const closed = positions.filter(x => x.status === 'closed' && x.result);
  
  // Build daily PnL: premium on open day + final adj on close day
  const dailyPnL = {};
  for (const pos of positions) {
    if (pos.status === 'cancelled') continue;
    if (pos.openedAt && pos.premiumCollected) {
      dailyPnL[pos.openedAt] = (dailyPnL[pos.openedAt] || 0) + pos.premiumCollected;
    }
    if (pos.status === 'closed' && pos.result && pos.closedAt) {
      dailyPnL[pos.closedAt] = (dailyPnL[pos.closedAt] || 0) + (pos.pnl || 0) - (pos.premiumCollected || 0);
    }
  }
  
  // Monthly P&L
  const monthlyPnL = {};
  for (const [date, pnl] of Object.entries(dailyPnL)) {
    const month = date.substring(0, 7);
    monthlyPnL[month] = (monthlyPnL[month] || 0) + pnl;
  }
  
  let html = '<div class="stat-grid">';
  html += '<div class="stat-card"><div class="stat-label">总决策</div><div class="stat-value">'+s.totalDecisions+'</div></div>';
  html += '<div class="stat-card"><div class="stat-label">总交易</div><div class="stat-value">'+s.totalPositions+'</div></div>';
  html += '<div class="stat-card"><div class="stat-label">胜率</div><div class="stat-value">'+(s.wins+s.losses ? (s.wins/(s.wins+s.losses)*100).toFixed(0)+'%' : '--')+'</div></div>';
  html += '<div class="stat-card"><div class="stat-label">净PnL</div><div class="stat-value '+(s.netPnL>=0?'up':'dn')+'">$'+s.netPnL.toFixed(2)+'</div></div>';
  html += '<div class="stat-card"><div class="stat-label">最大回撤</div><div class="stat-value dn">'+(s.maxDrawdown*100).toFixed(1)+'%</div></div>';
  html += '<div class="stat-card"><div class="stat-label">连续亏损</div><div class="stat-value">'+s.consecutiveLosses+'笔</div></div>';
  html += '</div>';

  // Monthly summary
  const mKeys = Object.keys(monthlyPnL).sort().reverse();
  const cap = DATA.capital?.total || 100000;
  if (mKeys.length) {
    html += '<h2>月度收益 <span class="muted">(目标 2.5%/月)</span></h2><div class="month-summary">';
    for (const m of mKeys.slice(0, 6)) {
      const v = monthlyPnL[m];
      const rate = (v / cap * 100).toFixed(2);
      const hitTarget = parseFloat(rate) >= 2.5;
      html += '<div class="month-card"><div class="label">'+m+'</div><div class="value '+(v>=0?'up':'dn')+'">$'+v.toFixed(2)+' <span style="font-size:.8rem;font-weight:500">('+ (v>=0?'+':'') +rate+'%)</span>'+(hitTarget?' <span class="badge badge-green" style="font-size:.65rem">达标</span>':'')+'</div></div>';
    }
    html += '</div>';
  }

  // Calendar
  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth() + 1;

  function renderCal(offset) {
    calMonth += offset;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    if (calMonth < 1) { calMonth = 12; calYear--; }

    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const monthLabel = calYear + '-' + String(calMonth).padStart(2,'0');
    const todayKey = now.toISOString().substring(0,10);
    
    const monthPnL = monthlyPnL[monthLabel] || 0;
    
    let calHtml = '<div class="cal-nav"><button onclick="calShift(-1)">◀</button><h3>'+monthLabel+'</h3><button onclick="calShift(1)">▶</button><span class="'+(monthPnL>=0?'up':'dn')+'" style="font-weight:700">'+ (monthPnL>=0?'+':'') +'$'+monthPnL.toFixed(2)+'</span></div>';
    calHtml += '<div class="calendar">';
    const dayNames = ['日','一','二','三','四','五','六'];
    for (const d of dayNames) {
      calHtml += '<div class="cal-cell cal-header">'+d+'</div>';
    }
    for (let i = 0; i < firstDay; i++) {
      calHtml += '<div class="cal-cell other"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = monthLabel + '-' + String(d).padStart(2,'0');
      const pnl = dailyPnL[dateKey] || 0;
      let cls = 'cal-cell';
      if (dateKey === todayKey) cls += ' cal-today';
      if (pnl > 0) cls += ' cal-pos';
      else if (pnl < 0) cls += ' cal-neg';
      const pnlShow = pnl ? (pnl>=0?'+':'')+'$'+pnl.toFixed(0) : '';
      calHtml += '<div class="'+cls+'" title="'+dateKey+' PnL: $'+pnl.toFixed(2)+'"><span class="day">'+d+'</span><span class="pnl">'+pnlShow+'</span></div>';
    }
    calHtml += '</div>';
    document.getElementById('cal-container').innerHTML = calHtml;
  }

  html += '<h2>日历</h2><div id="cal-container"></div>';
  
  if (s.bySymbol && Object.keys(s.bySymbol).length) {
    html += '<h2>按标的</h2><table><thead><tr><th>标的</th><th>交易数</th><th>胜</th><th>负</th><th>胜率</th><th>净PnL</th></tr></thead><tbody>';
    for (const [sym, d] of Object.entries(s.bySymbol)) {
      const wr = (d.wins+d.losses) ? (d.wins/(d.wins+d.losses)*100).toFixed(0)+'%' : '--';
      html += '<tr><td><b>'+sym+'</b></td><td>'+d.positions+'</td><td>'+d.wins+'</td><td>'+d.losses+'</td><td>'+wr+'</td><td class="'+(d.netPnL>=0?'up':'dn')+'">$'+d.netPnL.toFixed(2)+'</td></tr>';
    }
    html += '</tbody></table>';
  }
  document.getElementById('panel-stats').innerHTML = html;
  renderCal(0);
})();

let calOffset = 0;
function calShift(n) {
  calOffset += n;
  // Re-render calendar
  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth() + 1 + calOffset;
  while (calMonth > 12) { calMonth -= 12; calYear++; }
  while (calMonth < 1) { calMonth += 12; calYear--; }
  
  const dailyPnL = {};
  for (const pos of DATA.positions) {
    if (pos.openedAt && pos.premiumCollected) {
      dailyPnL[pos.openedAt] = (dailyPnL[pos.openedAt] || 0) + pos.premiumCollected;
    }
    if (pos.status === 'closed' && pos.result && pos.closedAt) {
      dailyPnL[pos.closedAt] = (dailyPnL[pos.closedAt] || 0) + (pos.pnl || 0) - (pos.premiumCollected || 0);
    }
  }
  const monthlyPnL = {};
  for (const [date, pnl] of Object.entries(dailyPnL)) {
    const month = date.substring(0, 7);
    monthlyPnL[month] = (monthlyPnL[month] || 0) + pnl;
  }
  
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const monthLabel = calYear + '-' + String(calMonth).padStart(2,'0');
  const todayKey = new Date().toISOString().substring(0,10);
  const monthPnL = monthlyPnL[monthLabel] || 0;
  
  let calHtml = '<div class="cal-nav"><button onclick="calShift(-1)">◀</button><h3>'+monthLabel+'</h3><button onclick="calShift(1)">▶</button><span class="'+(monthPnL>=0?'up':'dn')+'" style="font-weight:700">'+ (monthPnL>=0?'+':'') +'$'+monthPnL.toFixed(2)+'</span></div>';
  calHtml += '<div class="calendar">';
  const dayNames = ['日','一','二','三','四','五','六'];
  for (const d of dayNames) {
    calHtml += '<div class="cal-cell cal-header">'+d+'</div>';
  }
  for (let i = 0; i < firstDay; i++) {
    calHtml += '<div class="cal-cell other"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = monthLabel + '-' + String(d).padStart(2,'0');
    const pnl = dailyPnL[dateKey] || 0;
    let cls = 'cal-cell';
    if (dateKey === todayKey) cls += ' cal-today';
    if (pnl > 0) cls += ' cal-pos';
    else if (pnl < 0) cls += ' cal-neg';
    const pnlShow = pnl ? (pnl>=0?'+':'')+'$'+pnl.toFixed(0) : '';
    calHtml += '<div class="'+cls+'" title="'+dateKey+' PnL: $'+pnl.toFixed(2)+'"><span class="day">'+d+'</span><span class="pnl">'+pnlShow+'</span></div>';
  }
  calHtml += '</div>';
  document.getElementById('cal-container').innerHTML = calHtml;
}

// Scan panel
(function() {
  const s = DATA.scan || { results: [], scannedAt: null };
  const targets = DATA.targets || [];
  let scanResults = s.results || [];
  let scanTime = s.scannedAt;
  
  function renderScanTable() {
    let html = '<h2>标的扫描 · IV溢价排名</h2>';
    html += '<div class="filter-bar">';
    if (scanTime) html += '<span class="muted">扫描时间: ' + new Date(scanTime).toLocaleString('zh-HK') + ' (' + scanResults.length + ' 个标的)</span>';
    html += '<button onclick="refreshScan()" id="scanRefreshBtn" style="padding:6px 14px;background:#1a2942;border:1px solid #1f2b44;color:#b0c4e8;border-radius:6px;cursor:pointer;font-size:.82rem;margin-left:auto">🔄 刷新扫描</button>';
    html += '</div>';
    html += '<p id="scanStatus" class="muted"></p>';
    
    if (scanResults.length) {
      html += '<table><thead><tr><th>#</th><th>标的</th><th>评分</th><th>状态</th><th>IV</th><th>HV</th><th>溢价</th><th>Rank</th><th>Pctl</th><th>ExpMove</th><th>成交量</th><th>OI</th><th>P/C Vol</th><th>信号</th></tr></thead><tbody>';
      for (let i = 0; i < scanResults.length; i++) {
        const r = scanResults[i];
        const toneEmoji = r.tone === 'green' ? '🟢' : r.tone === 'yellow' ? '🟡' : '🔴';
        const toneStyle = r.tone === 'green' ? 'color:#45d483;font-weight:700' : r.tone === 'yellow' ? 'color:#ffd54a' : 'color:#ff6b7d';
        const premiumStyle = r.premium >= 3 ? 'up' : r.premium < 0 ? 'dn' : '';
        html += '<tr>';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td><b>' + r.symbol + '</b> <a href="https://donew-beta.vercel.app/sell-put-decision-tool.html?symbol='+r.symbol+'" target="_blank" style="font-size:.7rem;color:#4d9eff">→决策</a></td>';
        html += '<td style="font-weight:700;font-size:1.1rem;color:#ffd54a">' + r.score + '</td>';
        html += '<td style="' + toneStyle + '">' + toneEmoji + ' ' + r.state + '</td>';
        html += '<td>' + (r.iv?.toFixed(1) || '--') + '%</td>';
        html += '<td>' + (r.hv?.toFixed(1) || '--') + '%</td>';
        html += '<td class="' + premiumStyle + '">' + (r.premium >= 0 ? '+' : '') + r.premium + '%</td>';
        html += '<td>' + (r.ivRank?.toFixed(0) || '--') + '%</td>';
        html += '<td>' + (r.ivPct?.toFixed(0) || '--') + '%</td>';
        html += '<td>' + (r.expected?.toFixed(1) || '--') + '%</td>';
        html += '<td>' + (r.vol >= 1000 ? (r.vol/1000).toFixed(1)+'k' : r.vol?.toFixed(0) || '--') + '</td>';
        html += '<td>' + (r.oi >= 1000 ? (r.oi/1000).toFixed(1)+'k' : r.oi?.toFixed(0) || '--') + '</td>';
        html += '<td>' + (r.pcVol?.toFixed(2) || '--') + '</td>';
        html += '<td style="font-size:.78rem">' + (r.posReasons || []).map(x => '<span class="up">+'+x+'</span>').join(' ') + ' ' + (r.riskReasons || []).map(x => '<span class="dn">-'+x+'</span>').join(' ') + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
    } else {
      html += '<p class="muted">暂无数据，点击刷新按钮获取</p>';
    }
    document.getElementById('panel-scan').innerHTML = html;
  }
  
  renderScanTable();
  
  window.refreshScan = async function() {
    const btn = document.getElementById('scanRefreshBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 扫描中...'; }
    let errorMsg = null;
    try {
      const apiUrl = 'https://donew-beta.vercel.app/api/barchart-overview?symbols=' + targets.join(',');
      const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const data = json.data || [];
      scanResults = data.filter(d => d.ok && d.metrics).map(d => {
        const m = d.metrics || {};
        const iv = parseFloat(m.iv) || 0, hv = parseFloat(m.hv) || 0;
        const ivRank = parseFloat(m.ivRank) || 0, ivPct = parseFloat(m.ivPercentile) || 0;
        const expected = parseFloat(m.expectedMovePct) || 0;
        const vol = parseFloat(m.todayVolume) || 0, oi = parseFloat(m.todayOpenInterest) || 0;
        const pcVol = parseFloat(m.putCallVolRatio) || 0;
        const premium = iv - hv;
        let score = 12; const posR = [], riskR = [];
        if (premium >= 8) { score += 25; posR.push('IV-HV溢价显著'); }
        else if (premium >= 3) { score += 18; posR.push('IV高于HV'); }
        else if (premium >= 0) score += 8;
        else { score -= 15; riskR.push('IV低于HV'); }
        if (ivRank >= 70) { score += 18; posR.push('IV Rank高'); }
        else if (ivRank >= 50) score += 12;
        else if (ivRank >= 30) score += 6;
        else riskR.push('IV Rank偏低');
        if (ivPct >= 80) { score += 15; posR.push('IV Percentile高'); }
        else if (ivPct >= 60) score += 10;
        else if (ivPct >= 40) score += 5;
        if (vol >= 1000) { score += 8; posR.push('成交活跃'); }
        else if (vol >= 300) score += 4;
        else { score -= 6; riskR.push('成交量低'); }
        if (oi >= 10000) { score += 8; posR.push('OI充足'); }
        else if (oi >= 1000) score += 4;
        else { score -= 6; riskR.push('OI偏低'); }
        if (expected > 15) { score -= 16; riskR.push('ExpMove极高'); }
        else if (expected > 10) score -= 7;
        else if (expected >= 4) score += 5;
        if (pcVol >= 2) { score -= 12; riskR.push('Put拥挤'); }
        else if (pcVol >= 1.3) score -= 6;
        else if (pcVol >= 0.25) score += 4;
        score = Math.max(0, Math.min(100, Math.round(score)));
        let tone='yellow', state='可观察';
        if (score >= 70) { tone='green'; state='优质候选'; }
        else if (score < 50) { tone='red'; state='暂不建议'; }
        return { symbol: d.symbol, score, tone, state, premium: Math.round(premium*10)/10, iv, hv, ivRank, ivPct, expected, vol, oi, pcVol, posReasons: posR, riskReasons: riskR };
      });
      scanResults.sort((a,b) => b.score - a.score);
      scanTime = new Date().toISOString();
    } catch(e) {
      errorMsg = e.message || '网络错误';
      console.error('Scan refresh error:', e);
    }
    renderScanTable();
    // Show status after DOM rebuild
    const statusEl = document.getElementById('scanStatus');
    if (statusEl) {
      if (errorMsg) statusEl.textContent = '❌ ' + errorMsg;
      else if (scanResults.length) { statusEl.textContent = '✅ 刷新完成 (' + scanResults.length + ' 个标的)'; setTimeout(() => { const el = document.getElementById('scanStatus'); if (el) el.textContent = ''; }, 3000); }
    }
  };
})();

// Settings panel
(function() {
  const targets = DATA.targets || [];
  let html = '<h2>标的池管理</h2>';
  html += '<p class="muted">当前标的 (' + targets.length + '个)</p>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">';
  for (const s of targets) {
    html += '<span style="display:inline-flex;align-items:center;gap:4px;background:#111d2f;border:1px solid #1f2b44;border-radius:6px;padding:4px 10px;font-size:.85rem"><b>'+s+'</b> <button data-sym="'+s+'" onclick="removeSymbol(this.dataset.sym)" style="background:none;border:none;color:#ff6b7d;cursor:pointer;font-size:1rem;padding:0 2px" title="删除 '+s+'">×</button></span>';
  }
  html += '</div>';
  html += '<div class="filter-bar">';
  html += '<label>添加标的</label><input id="symAdd" type="text" placeholder="输入代码..." style="width:120px;padding:6px 12px;background:#111d2f;border:1px solid #1f2b44;color:#cddbf7;border-radius:6px">';
  html += '<button onclick="addSymbol()" style="padding:6px 14px;background:#1a2942;border:1px solid #1f2b44;color:#b0c4e8;border-radius:6px;cursor:pointer;font-size:.82rem">添加</button>';
  html += '</div>';
  html += '<p id="symMsg" style="font-size:.82rem;margin-top:8px"></p>';
  html += '<p class="muted" style="margin-top:8px">修改后运行 <code>node scripts/sell-put-agent.mjs dashboard</code> 生效</p>';
  
  document.getElementById('panel-settings').innerHTML = html;
})();

// Symbol management functions
function addSymbol() {
  const input = document.getElementById('symAdd');
  const sym = input.value.trim().toUpperCase();
  if (!sym || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(sym)) {
    document.getElementById('symMsg').innerHTML = '<span style="color:#ff6b7d">请输入有效的美股代码</span>';
    return;
  }
  document.getElementById('symMsg').innerHTML = '<span style="color:#ffd54a">请运行: <code>node scripts/sell-put-agent.mjs symbols add '+sym+'</code> 然后重新生成仪表板</span>';
}

function removeSymbol(sym) {
  document.getElementById('symMsg').innerHTML = '<span style="color:#ffd54a">请运行: <code>node scripts/sell-put-agent.mjs symbols remove '+sym+'</code> 然后重新生成仪表板</span>';
}

// K-line chart panel
(function() {
  const klineData = DATA.kline || {};
  const positions = DATA.positions || [];
  
  // Only show symbols with positions or K-line data that has trades
  const symbolKeys = [...new Set([
    ...positions.map(p => p.symbol),
    ...Object.keys(klineData).filter(s => positions.some(p => p.symbol === s))
  ])];
  
  let html = '<h2>K线图表</h2>';
  if (!symbolKeys.length) {
    html += '<p class="muted">暂无K线数据。运行 daily 后自动获取。</p>';
    document.getElementById('panel-kline').innerHTML = html;
    return;
  }

  // Default to symbol with open positions first
  const openSym = positions.find(p => p.status === 'open')?.symbol;
  const defaultSym = openSym || symbolKeys[0];

  html += '<div class="filter-bar"><label>标的</label><select id="kc-symbol" onchange="renderKlineChart()">';
  for (const s of symbolKeys) {
    const posCount = positions.filter(p => p.symbol === s && (p.status === 'open' || p.status === 'closed' || p.status === 'cancelled')).length;
    html += '<option value="'+s+'"'+(s===defaultSym?' selected':'')+'>'+s+(posCount?' ('+posCount+'笔)':'')+'</option>';
  }
  html += '</select></div>';
  html += '<div id="kline-chart-container" style="width:100%;height:560px;border:1px solid #1f2b44;border-radius:8px;overflow:hidden"></div>';
  document.getElementById('panel-kline').innerHTML = html;

  let chart = null;
  window.renderKlineChart = function() {
    if (typeof LightweightCharts === 'undefined') {
      document.getElementById('kline-chart-container').innerHTML = '<p class="muted" style="padding:40px;text-align:center">图表库加载中...请确保网络连接正常</p>';
      return;
    }
    try {
    const sym = document.getElementById('kc-symbol').value;
    const data = klineData[sym];
    if (!data || !data.bars || !data.bars.length) return;

    document.getElementById('kline-chart-container').innerHTML = '';
    if (chart) chart.remove();

    chart = LightweightCharts.createChart(document.getElementById('kline-chart-container'), {
      layout: { background: { color: '#0d1522' }, textColor: '#6b7fa3' },
      grid: { vertLines: { color: '#1a2942' }, horzLines: { color: '#1a2942' } },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      timeScale: { borderColor: '#1f2b44', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#1f2b44' },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#45d483', downColor: '#ff6b7d',
      borderUpColor: '#45d483', borderDownColor: '#ff6b7d',
      wickUpColor: '#45d483', wickDownColor: '#ff6b7d',
    });

    const bars = data.bars.map(b => ({
      time: b.date,
      open: b.open, high: b.high, low: b.low, close: b.close,
    }));
    candleSeries.setData(bars);

    // Add position markers
    const symPositions = positions.filter(p => p.symbol === sym);
    const markers = [];
    for (const pos of symPositions) {
      if (pos.openedAt) {
        markers.push({
          time: pos.openedAt,
          position: 'belowBar',
          color: pos.status === 'cancelled' ? '#6b7fa3' : '#45d483',
          shape: 'arrowDown',
          text: 'S ' + pos.strike + 'P×' + (pos.contracts || 1) + ' $' + pos.premium,
          size: 3,
        });
      }
      if (pos.closedAt && pos.status !== 'open') {
        const closeTime = pos.closedAt.includes('T') ? pos.closedAt.split('T')[0] : (pos.closedAt.includes(' ') ? pos.closedAt.split(' ')[0] : pos.closedAt);
        markers.push({
          time: closeTime,
          position: 'aboveBar',
          color: pos.result === 'win' ? '#45d483' : pos.result === 'cancelled' ? '#ffd54a' : '#ff6b7d',
          shape: pos.result === 'win' ? 'arrowUp' : 'circle',
          text: pos.result === 'win' ? '+$' + (pos.pnl || 0).toFixed(0) : pos.result === 'cancelled' ? '取消' : 'Loss',
          size: 3,
        });
      }
    }
    if (markers.length) candleSeries.setMarkers(markers);

    chart.timeScale().fitContent();
    } catch(e) { document.getElementById('kline-chart-container').innerHTML = '<p class="muted" style="padding:40px;text-align:center">图表渲染失败</p>'; }
  };

  setTimeout(() => renderKlineChart(), 500);
})();

</script>
</body>
</html>`;
  return html;
}

function generateDashboard() {
  const html = buildDashboardHtml();
  const fpath = path.join(AGENT_DIR, 'dashboard.html');
  fs.writeFileSync(fpath, html, 'utf-8');
  console.log('Dashboard saved: ' + fpath);
  return fpath;
}

async function serveDashboard() {
  const http = await import('node:http');
  const port = 8765;
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/dashboard') {
      const html = buildDashboardHtml();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end('404');
    }
  });
  server.listen(port, () => {
    console.log('🖥 Dashboard: http://localhost:' + port);
    console.log('   每 10 分钟自动刷新。按 Ctrl+C 停止。');
  });
}

// ─── CLI: scan ────────────────────────────────────────────────

async function runScan() {
  const symbols = loadTargets();
  console.log(`🔍 扫描 ${symbols.length} 个标的...`);

  const VERCEL_API = 'https://donew-beta.vercel.app';
  const res = await fetch(`${VERCEL_API}/api/barchart-overview?symbols=${symbols.join(',')}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew-agent/1.0)' },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) { console.log(`❌ HTTP ${res.status}`); return; }

  const json = await res.json();
  const data = json.data || [];
  const results = data.filter(d => d.ok && d.metrics).map(d => {
    const m = d.metrics || {};
    const iv = parseFloat(m.iv) || 0;
    const hv = parseFloat(m.hv) || 0;
    const ivRank = parseFloat(m.ivRank) || 0;
    const ivPct = parseFloat(m.ivPercentile) || 0;
    const expected = parseFloat(m.expectedMovePct) || 0;
    const vol = parseFloat(m.todayVolume) || 0;
    const oi = parseFloat(m.todayOpenInterest) || 0;
    const pcVol = parseFloat(m.putCallVolRatio) || 0;
    const premium = iv - hv;

    let score = 12;
    const posReasons = [], riskReasons = [];
    if (premium >= 8) { score += 25; posReasons.push('IV-HV溢价显著'); }
    else if (premium >= 3) { score += 18; posReasons.push('IV高于HV'); }
    else if (premium >= 0) { score += 8; }
    else { score -= 15; riskReasons.push('IV低于HV'); }
    if (ivRank >= 70) { score += 18; posReasons.push('IV Rank高'); }
    else if (ivRank >= 50) score += 12;
    else if (ivRank >= 30) score += 6;
    else riskReasons.push('IV Rank偏低');
    if (ivPct >= 80) { score += 15; posReasons.push('IV Percentile高'); }
    else if (ivPct >= 60) score += 10;
    else if (ivPct >= 40) score += 5;
    if (vol >= 1000) { score += 8; posReasons.push('成交活跃'); }
    else if (vol >= 300) score += 4;
    else { score -= 6; riskReasons.push('成交量低'); }
    if (oi >= 10000) { score += 8; posReasons.push('OI充足'); }
    else if (oi >= 1000) score += 4;
    else { score -= 6; riskReasons.push('OI偏低'); }
    if (expected > 15) { score -= 16; riskReasons.push('ExpMove极高'); }
    else if (expected > 10) { score -= 7; riskReasons.push('ExpMove偏高'); }
    else if (expected >= 4) score += 5;
    if (pcVol >= 2) { score -= 12; riskReasons.push('Put拥挤'); }
    else if (pcVol >= 1.3) { score -= 6; riskReasons.push('Put偏多'); }
    else if (pcVol >= 0.25) score += 4;

    const missing = [iv, hv, ivRank, ivPct].filter(v => v === null || isNaN(v)).length;
    if (missing >= 2) score = Math.min(score, 35);
    score = Math.max(0, Math.min(100, Math.round(score)));

    let state = '观察', tone = 'yellow';
    if (score >= 70) { tone = 'green'; state = '优质候选'; }
    else if (score >= 50) { tone = 'yellow'; state = '可观察'; }
    else { tone = 'red'; state = '暂不建议'; }

    return { symbol: d.symbol, score, tone, state, premium: Math.round(premium * 10) / 10, iv, hv, ivRank, ivPct, expected, vol, oi, pcVol, posReasons, riskReasons, delayNote: d.delayNote || '', warning: d.warning || '' };
  });

  results.sort((a, b) => b.score - a.score);
  saveJson(SCAN_RESULT_FILE, { scannedAt: new Date().toISOString(), total: results.length, results });
  console.log(`✅ 扫描完成: ${results.length} 个标的\n`);

  // Print top results
  for (const r of results.slice(0, 10)) {
    const badge = r.tone === 'green' ? '🟢' : r.tone === 'yellow' ? '🟡' : '🔴';
    console.log(`${badge} ${r.symbol.padEnd(6)} 评分:${String(r.score).padStart(3)}  ${r.state.padEnd(8)} IV:${String(r.iv?.toFixed(1)).padStart(6)}% HV:${String(r.hv?.toFixed(1)).padStart(6)}% 溢价:${r.premium >= 0 ? '+' : ''}${r.premium}%`);
  }
}

// ─── CLI: symbols ─────────────────────────────────────────────

async function manageSymbols() {
  const sub = process.argv[3] || 'list';
  let targets = loadTargets();

  if (sub === 'list') {
    console.log(`📋 当前标的池 (${targets.length}):`, targets.join(', '));
    return;
  }
  if (sub === 'add' && process.argv[4]) {
    const sym = process.argv[4].toUpperCase();
    if (!targets.includes(sym)) { targets.push(sym); saveTargets(targets); console.log(`✅ 已添加: ${sym}`); }
    else console.log(`⚠️ ${sym} 已在池中`);
    return;
  }
  if (sub === 'remove' && process.argv[4]) {
    const sym = process.argv[4].toUpperCase();
    targets = targets.filter(s => s !== sym);
    saveTargets(targets);
    console.log(`✅ 已移除: ${sym} 当前池:`, targets.join(', '));
    return;
  }
  console.log('Usage: node scripts/sell-put-agent.mjs symbols [list|add SYM|remove SYM]');
}

// ─── CLI: stats ───────────────────────────────────────────────

function showStats() {
  const stats = recalcStats();
  const positions = loadPositions();
  const open = positions.filter(p => p.status === 'open');
  const closed = positions.filter(p => p.status === 'closed');

  console.log('\n📊 Sell Put Agent · 统计面板\n');
  console.log(`总决策: ${stats.totalDecisions} | 总交易: ${stats.totalPositions} | 持仓: ${open.length}`);
  console.log(`胜: ${stats.wins} | 负: ${stats.losses} | 胜率: ${(stats.wins + stats.losses) ? (stats.wins / (stats.wins + stats.losses) * 100).toFixed(0) : '--'}%`);
  console.log(`总收入: $${stats.totalPremium.toFixed(2)} | 总亏损: $${stats.totalLosses.toFixed(2)} | 净PnL: $${stats.netPnL.toFixed(2)}`);
  console.log(`最大回撤: ${(stats.maxDrawdown * 100).toFixed(1)}% | 连续亏损: ${stats.consecutiveLosses}笔\n`);

  if (Object.keys(stats.bySymbol).length) {
    console.log('按标的:');
    for (const [sym, s] of Object.entries(stats.bySymbol)) {
      const wr = (s.wins + s.losses) ? (s.wins / (s.wins + s.losses) * 100).toFixed(0) : '--';
      console.log(`  ${sym}: ${s.positions}笔 | 胜率${wr}% | PnL $${s.netPnL.toFixed(2)}`);
    }
  }

  if (closed.length) {
    console.log('\n最近5笔:');
    for (const p of closed.slice(-5)) {
      const emoji = p.result === 'win' ? '✅' : '❌';
      console.log(`  ${emoji} ${p.openedAt} ${p.symbol} $${p.strike}P | 到期${p.expireDate} | PnL $${(p.pnl || 0).toFixed(2)}`);
    }
  }

  if (open.length) {
    console.log('\n当前持仓:');
    for (const p of open) {
      const daysLeft = Math.ceil((new Date(p.expireDate) - new Date()) / 86400000);
      console.log(`  ${p.symbol} $${p.strike}P | 到期${p.expireDate}(${daysLeft}天) | 权利金$${p.premium}×${p.contracts}张 | 年化${p.annualizedReturn}%`);
    }
  }
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────

function showVersion() {
  console.log('Sell Put Agent v0.4.0');
  console.log(`Data: ${AGENT_DIR}`);
}

async function main() {
  ensureDir(AGENT_DIR);
  ensureDir(JOURNAL_DIR);

  const mode = process.argv[2] || 'daily';

  switch (mode) {
    case 'daily':     await runDaily();       break;
    case 'stats':     showStats();            break;
    case 'report':    await generateReport(); break;
    case 'dashboard': generateDashboard();    break;
    case 'serve':     await serveDashboard(); break;
    case 'scan':      await runScan();        break;
    case 'symbols':   await manageSymbols();  break;
    case 'setup':     await setupCron();      break;
    case 'env':     await setupEnv();       break;
    case 'version': showVersion();          break;
    default:
      console.log('Usage: node scripts/sell-put-agent.mjs [daily|stats|report|dashboard|scan|symbols|setup|env|version]');
      console.log('  daily     - 每日卖Put分析（拉取数据→AI决策→记录→结算到期）');
      console.log('  stats     - 显示统计面板');
      console.log('  report    - 生成今日 Markdown 日报');
      console.log('  dashboard - 生成可视化仪表板 (HTML 文件)');
      console.log('  scan      - 扫描标的池的IV溢价排名和异动');
      console.log('  symbols   - 管理标的池 (list/add/remove)');
      console.log('  setup     - 安装 launchd 自动运行');
      console.log('  env       - 将 DEEPSEEK_API_KEY 写入本地 .env 文件');
      console.log('  version   - 版本信息');
      console.log('\n首次使用: export DEEPSEEK_API_KEY=sk-xxx && node scripts/sell-put-agent.mjs env');
  }
}

main().catch(error => {
  console.error(`\n💥 Agent 异常: ${error.message}`);
  process.exit(1);
});
