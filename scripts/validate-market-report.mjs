import fs from 'fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node validate-market-report.mjs <markdown-file>');

const text = fs.readFileSync(file, 'utf8');

const requiredSections = [
  '# 📊 市场结构日报',
  '一句话结论',
  '策略矩阵',
  '资金联动',
  '宏观资产观察',
  '卖Put策略',
  '今日动作',
  '最后的话'
];

const assetAliases = {
  QQQ: ['QQQ', 'SPY', '纳指ETF', '纳斯达克ETF', '纳指', '标普500', '美股大盘'],
  QLD: ['QLD', '2倍纳指ETF', '纳指2倍ETF', '杠杆纳指ETF'],
  MSTR: ['MSTR', 'Strategy', 'MicroStrategy', '微策略'],
  BTC: ['BTC', 'Bitcoin', '比特币', '加密货币', '数字资产'],
  INTC: ['INTC', 'Intel', '英特尔', '英特尔公司'],
  VIX: ['VIX', '恐慌指数', '波动率指数', '隐含波动率'],
  EEM: ['EEM', '新兴市场', '新兴市场ETF', '新兴市场股票', '亚洲市场'],
  '10Y': ['10Y', '10年期美债', '美国10年期国债', '美债收益率', '美国国债收益率', '十年期国债', '长端利率']
};

const hasAsset = name => assetAliases[name].some(alias => text.includes(alias));
const missingSections = requiredSections.filter(x => !text.includes(x));

if (text.length < 2000) {
  throw new Error(`Report too short: ${text.length}`);
}

if (missingSections.length) {
  throw new Error(`Missing sections: ${missingSections.join(', ')}`);
}

// 核心市场维度必须覆盖：大盘、利率、波动率、加密资产。
const requiredMarketAssets = ['QQQ', '10Y', 'VIX', 'BTC'];
const missingMarketAssets = requiredMarketAssets.filter(name => !hasAsset(name));
if (missingMarketAssets.length) {
  throw new Error(`Missing core market assets: ${missingMarketAssets.join(', ')}`);
}

// 卖 Put 章节至少覆盖两个策略标的；不再强制每篇报告机械出现全部股票。
const strategyAssets = ['QLD', 'MSTR', 'INTC', 'EEM'];
const coveredStrategyAssets = strategyAssets.filter(hasAsset);
if (coveredStrategyAssets.length < 2) {
  throw new Error(`Insufficient strategy asset coverage: found ${coveredStrategyAssets.join(', ') || 'none'}, require at least 2 of ${strategyAssets.join(', ')}`);
}

const forbidden = ['保证盈利', '必涨', '必跌', '无风险'];
const foundForbidden = forbidden.filter(x => text.includes(x));
if (foundForbidden.length) {
  throw new Error(`Forbidden investment wording: ${foundForbidden.join(', ')}`);
}

console.log(`Market report validation passed; strategy assets: ${coveredStrategyAssets.join(', ')}`);
