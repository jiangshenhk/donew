import fs from 'fs';
import path from 'path';

export const STRATEGY_RELATIVE_PATH = 'docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md';
export const CORE_MARKET_ASSETS = ['QQQ', '10Y', 'VIX', 'BTC'];
export const CORE_STRATEGY_ASSETS = ['QLD', 'MSTR', 'INTC'];

export function loadStrategyBaseline(root = process.cwd()) {
  const strategyFile = path.join(root, STRATEGY_RELATIVE_PATH);
  if (!fs.existsSync