// time.mjs — 时间格式纯函数
// 无副作用，支持传入固定时间以便确定性测试
// 注意：本轮只复现现有行为，不修正时区/夏令时语义

export function fmtNodeDate(t) {
  const d = new Date(t);
  const p = n => (n < 10 ? '0' : '') + n;
  return p(d.getMonth() + 1) + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

export function todayStr(date = new Date()) {
  return new Date(date).toISOString().split('T')[0];
}

export function fmtTimeET(ts) {
  const d = new Date(ts instanceof Date ? ts : ts * 1000);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
}

export function fmtTimeShort(ts) {
  const d = new Date(ts instanceof Date ? ts : ts * 1000);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function hkNow(now = new Date()) {
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
}

export function etNow(now = new Date()) {
  const opts = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
  const get = t => parts.find(p => p.type === t)?.value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-05:00`);
}
