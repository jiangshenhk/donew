import fs from 'fs';
import path from 'path';

export const STRATEGY_RELATIVE_PATH = 'docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md';
export const CORE_MARKET_ASSETS = ['QQQ', '10Y', 'VIX', 'BTC'];
export const CORE_STRATEGY_ASSETS = ['QLD', 'MSTR', 'INTC'];

export function loadStrategyBaseline(root = process.cwd()) {
  const strategyFile = path.join(root, STRATEGY_RELATIVE_PATH);
  if (!fs.existsSync(strategyFile)) {
    throw new Error(`Strategy baseline missing: ${STRATEGY_RELATIVE_PATH}`);
  }
  const strategy = fs.readFileSync(strategyFile, 'utf8').trim();
  if (strategy.length < 1000) {
    throw new Error(`Strategy baseline too short: ${strategy.length}`);
  }
  for (const symbol of CORE_STRATEGY_ASSETS) {
    if (!strategy.includes(symbol)) throw new Error(`Strategy baseline missing required target: ${symbol}`);
  }
  return { strategy, strategyFile, strategySource: STRATEGY_RELATIVE_PATH };
}

export function buildMarketReportPrompt({ strategy, reportType = 'daily', news = [], marketSnapshot = {} }) {
  const normalized = String(reportType || 'daily').toLowerCase();
  const sessionInstruction = normalized === 'morning'
    ? '重点分析隔夜美股收盘、盘后变化和今日交易准备。'
    : normalized === 'evening'
      ? '重点分析亚洲与欧洲交易时段变化，以及今晚美股开盘前的交易准备。'
      : normalized === 'weekly'
        ? '输出周度结构复盘，并给出下一周卖 Put 风险约束。'
        : '输出当前时点的每日市场结构判断。';

  return `${strategy}

---

# 本次执行要求

- 报告类型：${normalized}
- ${sessionInstruction}
- 必须明确覆盖 QLD、MSTR、INTC；没有交易机会也要写明观察、暂停或不适合。
- 核心市场维度必须覆盖：QQQ、10Y、VIX、BTC。
- 策略矩阵必须包含“未来3-5日大跌风险”或等义列，并给出绿/黄/红风险判断。
- 必须包含黑天鹅灯号与卖 Put 动作约束。
- 不得编造期权链、Strike、Delta、IV、OI 或成交数据。
- 输出完整 Markdown 正文，不要解释提示词，不要输出代码围栏。

新闻：${JSON.stringify(news).slice(0, 50000)}
行情：${JSON.stringify(marketSnapshot).slice(0, 20000)}`;
}

export function validateCriticalRequirements(text) {
  const value = String(text || '');
  const missing = [];
  if (value.length < 1000) missing.push('报告长度不足');
  if (!value.includes('市场结构')) missing.push('市场结构标题');
  if (!(value.includes('大跌风险') || value.includes('大跌概率') || value.includes('未来3-5日'))) missing.push('大跌风险判断');
  if (!(value.includes('黑天鹅') || value.includes('跳空风险'))) missing.push('黑天鹅/跳空风险');
  for (const symbol of [...CORE_MARKET_ASSETS, ...CORE_STRATEGY_ASSETS]) {
    if (!value.includes(symbol)) missing.push(symbol);
  }
  const forbidden = ['保证盈利', '必涨', '必跌', '无风险'].filter(item => value.includes(item));
  if (forbidden.length) missing.push(`禁用表述:${forbidden.join(',')}`);
  if (missing.length) throw new Error(`Missing critical requirements: ${missing.join(', ')}`);
  return true;
}

export function reportMetadata({ reportType = 'daily', markdown, provider = 'DeepSeek' }) {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  const kind = String(reportType).toLowerCase() === 'weekly' ? 'weekly' : 'daily';
  const title = kind === 'weekly' ? `${date}市场结构周报` : `${date}市场结构日报`;
  return {
    id: `${title}-${Date.now()}`,
    kind,
    date,
    typeLabel: kind === 'weekly' ? '周报' : '今日分析',
    sessionLabel: kind === 'weekly' ? '周报' : '今日最新分析',
    title,
    fileName: `${title}.md`,
    windLight: '以报告正文为准',
    executionLevel: '以报告正文为准',
    eventRisk: '以报告正文为准',
    aiProvider: provider,
    usedAi: true,
    retrievedAt: now.toISOString(),
    retrievedAtLabel: now.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false }),
    markdown,
    archiveRow: `| **${date}** | 市场结构报告 | [${title}](/docs/市场/${title}.md) | 以正文结论为准 |`,
  };
}
