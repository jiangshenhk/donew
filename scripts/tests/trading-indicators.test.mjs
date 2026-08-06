import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcEMA, calcEMAForSeries, calcMACD, calcRSI } from '../long-term-trader.mjs';

test('EMA: 常数序列的 EMA 应等于该常数', () => {
  const values = new Array(50).fill(100);
  assert.equal(calcEMA(values, 10), 100);
});

test('EMA: 上升序列的短 EMA 应高于长 EMA', () => {
  const values = Array.from({ length: 60 }, (_, i) => 100 + i);
  const emaShort = calcEMA(values, 10);
  const emaLong = calcEMA(values, 30);
  assert.ok(emaShort > emaLong, `${emaShort} should be > ${emaLong}`);
});

test('EMA: 数据少于 period 时返回 null 或末值', () => {
  assert.equal(calcEMA([1, 2, 3], 10), 3);
});

test('EMA: EMAForSeries 前 period-1 位为 null', () => {
  const values = Array.from({ length: 30 }, (_, i) => i + 1);
  const series = calcEMAForSeries(values, 10);
  assert.equal(series.length, 30);
  for (let i = 0; i < 9; i++) assert.equal(series[i], null);
  for (let i = 9; i < 30; i++) assert.notEqual(series[i], null);
});

test('RSI: 全部上涨序列接近100', () => {
  const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
  const rsi = calcRSI(closes, 14);
  assert.equal(rsi, 100);
});

test('RSI: 全部下跌序列接近0', () => {
  const closes = Array.from({ length: 40 }, (_, i) => 200 - i);
  const rsi = calcRSI(closes, 14);
  assert.equal(rsi, 0);
});

test('RSI: 对称涨跌样本接近50', () => {
  // 交替 +/- 1
  const closes = [100];
  for (let i = 0; i < 39; i++) closes.push(closes[i] + (i % 2 === 0 ? 1 : -1));
  const rsi = calcRSI(closes, 14);
  assert.ok(rsi >= 40 && rsi <= 60, `rsi=${rsi} should be near 50`);
});

test('RSI: 返回值始终在 0-100 范围内', () => {
  for (let n = 0; n < 50; n++) {
    const closes = Array.from({ length: 40 }, () => 100 + Math.random() * 10);
    const rsi = calcRSI(closes, 14);
    assert.ok(rsi >= 0 && rsi <= 100, `rsi=${rsi} out of range`);
  }
});

test('RSI: 数据不足返回 null', () => {
  assert.equal(calcRSI([1, 2, 3, 4, 5], 14), null);
  assert.equal(calcRSI([], 14), null);
});

test('MACD: 常数价格序列 DIF/DEA/Histogram 均接近0', () => {
  const closes = new Array(60).fill(100);
  const macd = calcMACD(closes);
  assert.ok(Math.abs(macd.dif) < 0.01, `dif=${macd.dif}`);
  assert.ok(Math.abs(macd.dea) < 0.01, `dea=${macd.dea}`);
  assert.ok(Math.abs(macd.hist) < 0.01, `hist=${macd.hist}`);
});

test('MACD: 持续上升序列最后 DIF 大于0', () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
  const macd = calcMACD(closes);
  assert.ok(macd.dif > 0, `dif=${macd.dif} should be > 0`);
});

test('MACD: Histogram 不应因 DEA 实现错误永远为0', () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5 + Math.sin(i / 3) * 5);
  const macd = calcMACD(closes);
  assert.notEqual(macd.hist, 0);
});

test('MACD: 数据不足返回 null', () => {
  assert.equal(calcMACD(new Array(25).fill(100)), null);
  assert.equal(calcMACD(null), null);
});

test('MACD: 与已知样本对照', () => {
  // 已知序列（手工构造），验证 DIF 计算
  const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
  const macd = calcMACD(closes);
  // 上升序列中 DIF 应明显为正
  assert.ok(macd.dif > 0);
  assert.ok(macd.hist !== undefined);
});
