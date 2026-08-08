// number-format.mjs — 数字转换与格式化纯函数
// 无副作用，不读取环境变量，不访问文件/网络/数据库

export function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseLooseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[,%+]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function roundTo(value, digits = 4) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

export function formatSigned(value, digits = 2, suffix = '') {
  return (value >= 0 ? '+' : '') + Number(value).toFixed(digits) + suffix;
}

export function fmtUSD(value) {
  return formatSigned(value, 2, '');
}

export function fmtPct(value) {
  return formatSigned(value, 2, '%');
}
