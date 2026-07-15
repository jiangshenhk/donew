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

const requiredAssetAliases = {
  QQQ: ['QQQ'],
  QLD: ['QLD'],
  MSTR: ['MSTR'],
  BTC: ['BTC', '比特币'],
  INTC: ['INTC', '英特尔'],
  VIX: ['VIX', '恐慌指数'],
  EEM: ['EEM', '新兴市场', '新兴市场ETF'],
  '10Y': ['10Y', '10年期美债', '美国10年期国债', '美债收益率']
};

const missingSections = requiredSections.filter(x => !text.includes(x));
const missingAssets = Object.entries(requiredAssetAliases)
  .filter(([_, aliases]) => !aliases.some(alias => text.includes(alias)))
  .map(([name]) => name);

if (text.length < 2000) {
  throw new Error(`Report too short: ${text.length}`);
}

if (missingSections.length) {
  throw new Error(`Missing sections: ${missingSections.join(', ')}`);
}

if (missingAssets.length) {
  throw new Error(`Missing assets: ${missingAssets.join(', ')}`);
}

const forbidden = ['保证盈利', '必涨', '必跌', '无风险'];
const foundForbidden = forbidden.filter(x => text.includes(x));
if (foundForbidden.length) {
  throw new Error(`Forbidden investment wording: ${foundForbidden.join(', ')}`);
}

console.log('Market report validation passed');
