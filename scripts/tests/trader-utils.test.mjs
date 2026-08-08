import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toFiniteNumber,
  parseLooseNumber,
  roundTo,
  formatSigned,
  fmtUSD,
  fmtPct,
} from '../lib/utils/number-format.mjs';
import {
  fmtNodeDate,
  todayStr,
  fmtTimeET,
  fmtTimeShort,
  hkNow,
  etNow,
} from '../lib/utils/time.mjs';

// ─── toFiniteNumber ───
test('toFiniteNumber: null/undefined 返回 null', () => {
  assert.equal(toFiniteNumber(null), null);
  assert.equal(toFiniteNumber(undefined), null);
});

test('toFiniteNumber: NaN/Infinity 返回 null', () => {
  assert.equal(toFiniteNumber(NaN), null);
  assert.equal(toFiniteNumber(Infinity), null);
  assert.equal(toFiniteNumber(-Infinity), null);
});

test('toFiniteNumber: 空字符串转数字为0', () => {
  assert.equal(toFiniteNumber(''), 0);
});

test('toFiniteNumber: 普通整数和小数', () => {
  assert.equal(toFiniteNumber(10), 10);
  assert.equal(toFiniteNumber(3.14159), 3.14159);
  assert.equal(toFiniteNumber('42'), 42);
});

// ─── parseLooseNumber ───
test('parseLooseNumber: 清理逗号', () => {
  assert.equal(parseLooseNumber('1,234.56'), 1234.56);
});

test('parseLooseNumber: 清理百分号', () => {
  assert.equal(parseLooseNumber('45.6%'), 45.6);
});

test('parseLooseNumber: 清理正号', () => {
  assert.equal(parseLooseNumber('+5.5'), 5.5);
});

test('parseLooseNumber: 空字符串返回 null', () => {
  assert.equal(parseLooseNumber(''), null);
});

// ─── roundTo ───
test('roundTo: 四位小数舍入（短线/长线 num 行为）', () => {
  assert.equal(roundTo(1.23456789), 1.2346);
  assert.equal(roundTo(-1.23456789), -1.2346);
  assert.equal(roundTo(100.5), 100.5);
});

test('roundTo: null 返回 null', () => {
  assert.equal(roundTo(null), null);
  assert.equal(roundTo(undefined), null);
});

test('roundTo: NaN 返回 null', () => {
  assert.equal(roundTo(NaN), null);
});

// ─── formatSigned ───
test('formatSigned: 正数带+号', () => {
  assert.equal(formatSigned(10), '+10.00');
});

test('formatSigned: 负数带-号', () => {
  assert.equal(formatSigned(-10), '-10.00');
});

test('formatSigned: 百分比后缀', () => {
  assert.equal(formatSigned(1.5, 2, '%'), '+1.50%');
  assert.equal(formatSigned(-1.5, 2, '%'), '-1.50%');
});

// ─── fmtUSD / fmtPct 直接测试 ───
test('fmtUSD: 正数带+号', () => {
  assert.equal(fmtUSD(10), '+10.00');
  assert.equal(fmtUSD(1.5), '+1.50');
});

test('fmtUSD: 负数带-号', () => {
  assert.equal(fmtUSD(-10), '-10.00');
});

test('fmtUSD: 零按现有行为带正号', () => {
  assert.equal(fmtUSD(0), '+0.00');
});

test('fmtPct: 正数带+号和%', () => {
  assert.equal(fmtPct(1.5), '+1.50%');
  assert.equal(fmtPct(10), '+10.00%');
});

test('fmtPct: 负数带-号和%', () => {
  assert.equal(fmtPct(-1.5), '-1.50%');
});

test('fmtPct: 零按现有行为带正号', () => {
  assert.equal(fmtPct(0), '+0.00%');
});

// ─── fmtNodeDate ───
test('fmtNodeDate: 固定时间输出 MMDD HHMMSS（本地时间语义）', () => {
  const d = new Date(2026, 7, 8, 9, 5, 7);
  assert.equal(fmtNodeDate(d), '0808 090507');
});

test('fmtNodeDate: 补零', () => {
  const d = new Date(2026, 0, 2, 3, 4, 5);
  assert.equal(fmtNodeDate(d), '0102 030405');
});

test('fmtNodeDate: 接受时间戳', () => {
  const ts = new Date(2026, 7, 8, 21, 30, 0).getTime();
  assert.equal(fmtNodeDate(ts), '0808 213000');
});

// ─── todayStr ───
test('todayStr: 返回 ISO 日期', () => {
  assert.equal(todayStr(new Date('2026-08-08T12:00:00Z')), '2026-08-08');
});

// ─── fmtTimeET / fmtTimeShort（与 legacy 参考实现精确比较）───
function legacyFmtTimeET(ts) {
  const d = new Date(ts instanceof Date ? ts : ts * 1000);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
}

function legacyFmtTimeShort(ts) {
  const d = new Date(ts instanceof Date ? ts : ts * 1000);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
}

function legacyHkNow(now) {
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
}

function legacyEtNow(now) {
  const opts = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
  const get = t => parts.find(p => p.type === t)?.value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-05:00`);
}

test('fmtTimeET: 固定秒级时间戳与 legacy 一致', () => {
  const fixed = new Date('2026-08-06T18:55:00Z');
  const ts = fixed.getTime() / 1000;
  assert.equal(fmtTimeET(ts), legacyFmtTimeET(ts));
});

test('fmtTimeET: 接收 Date 与 legacy 一致', () => {
  const d = new Date('2026-08-06T18:55:00Z');
  assert.equal(fmtTimeET(d), legacyFmtTimeET(d));
});

test('fmtTimeShort: 固定秒级时间戳与 legacy 一致', () => {
  const fixed = new Date('2026-08-06T18:55:00Z');
  const ts = fixed.getTime() / 1000;
  assert.equal(fmtTimeShort(ts), legacyFmtTimeShort(ts));
});

test('fmtTimeShort: 接收 Date 与 legacy 一致', () => {
  const d = new Date('2026-08-06T18:55:00Z');
  assert.equal(fmtTimeShort(d), legacyFmtTimeShort(d));
});

// ─── hkNow / etNow（固定时间注入，与 legacy 精确比较）───
test('hkNow: 固定时间输入与 legacy 算法一致', () => {
  const fixed = new Date('2026-08-08T04:30:00Z');
  assert.equal(hkNow(fixed).getTime(), legacyHkNow(fixed).getTime());
});

test('hkNow: 另一个固定时间与 legacy 算法一致', () => {
  const fixed = new Date('2026-08-01T23:59:59Z');
  assert.equal(hkNow(fixed).getTime(), legacyHkNow(fixed).getTime());
});

test('etNow: 固定时间输入与 legacy 算法一致', () => {
  const fixed = new Date('2026-08-08T12:00:00Z');
  assert.equal(etNow(fixed).getTime(), legacyEtNow(fixed).getTime());
});

test('etNow: 另一个固定时间与 legacy 算法一致', () => {
  const fixed = new Date('2026-08-06T18:55:00Z');
  assert.equal(etNow(fixed).getTime(), legacyEtNow(fixed).getTime());
});
