import fs from 'fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node validate-market-report.mjs <markdown-file>');
if (!fs.existsSync(file)) throw new Error(`Report file missing: ${file}`);

const text = fs.readFileSync(file, 'utf8');
if (text.length < 1500) throw new Error(`Report too short: ${text.length}`);

const requiredConcepts = {
  title: ['# 📊 市场结构日报', '# 市场结构日报'],
  conclusion: ['一句话结论', '本期市场在交易什么', '市场在交易什么'],
  strategy: ['策略矩阵', '卖 put 策略', '卖Put策略', '落到我的卖 put 策略'],
  flow: ['资金流向', '资金联动', '跨资产'],
  risk: ['风险评分', '大跌概率', '黑天鹅'],
};

const missingConcepts = Object.entries(requiredConcepts)
  .filter(([, aliases]) => !aliases.some(alias => text.includes(alias)))
  .map(([name]) => name);
if (missingConcepts.length) throw new Error(`Missing required report concepts: ${missingConcepts.join(', ')}`);

const assetAliases = {
  QQQ: ['QQQ', '纳指', '纳斯达克'],
  '10Y': ['10Y', '10年期美债', '美债收益率', '长端利率'],
  VIX: ['VIX', '恐慌指数', '波动率指数'],
  BTC: ['BTC', 'Bitcoin', '比特币'],
  QLD: ['QLD'],
  MSTR: ['MSTR', 'MicroStrategy', 'Strategy', '微策略'],
  INTC: ['INTC', 'Intel', '英特尔'],
};

const hasAsset = name => assetAliases[name].some(alias => text.includes(alias));
const requiredAssets = ['QQQ', '10Y', 'VIX', 'BTC', 'QLD', 'MSTR', 'INTC'];
const missingAssets = requiredAssets.filter(name => !hasAsset(name));
if (missingAssets.length) throw new Error(`Missing required assets: ${missingAssets.join(', ')}`);

const forbidden = ['保证盈利', '必涨', '必跌', '无风险'];
const foundForbidden = forbidden.filter(term => text.includes(term));
if (foundForbidden.length) throw new Error(`Forbidden investment wording: ${foundForbidden.join(', ')}`);

console.log(`Market report validation passed: ${requiredAssets.join(', ')}`);
