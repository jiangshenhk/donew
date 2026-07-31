// sell-put-signal.js — Sell Put Agent 信号共享页
// GET /api/sell-put-signal?symbol=MSTR
// 数据来源：stockprice/data/sell-put-signals.json（由 Agent 自动更新）

const SIGNALS_URL = 'https://raw.githubusercontent.com/jiangshenhk/donew/main/stockprice/data/sell-put-signals.json';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { data: null, fetchedAt: 0 };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
  };
}

async function fetchSignals() {
  const now = Date.now();
  if (cache.data && (now - cache.fetchedAt) < CACHE_TTL_MS) return cache.data;
  const res = await fetch(SIGNALS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; donew/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return cache.data || null;
  const json = await res.json();
  cache = { data: json, fetchedAt: now };
  return json;
}

function stanceBadge(stance) {
  if (stance === '可卖Put') return '<span style="color:#45d483;font-weight:700">可卖Put</span>';
  if (stance === '谨慎卖Put') return '<span style="color:#ffd54a;font-weight:700">谨慎卖Put</span>';
  return '<span style="color:#ff6b7d;font-weight:700">暂不卖Put</span>';
}

function riskColor(r) { if (r >= 7) return '#ff6b7d'; if (r >= 5) return '#ffd54a'; return '#45d483'; }

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString('zh-HK', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { symbol } = req.query;
  if (!symbol) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send('<!doctype html><html><body style="font-family:monospace;padding:20px"><p>用法: <code>/api/sell-put-signal?symbol=MSTR</code></p></body></html>');
  }

  const sym = String(symbol).trim().toUpperCase();
  const signals = await fetchSignals();
  if (!signals || !signals[sym]) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!doctype html><html><body style="font-family:monospace;padding:20px;background:#0d1522;color:#cddbf7"><h2>无信号</h2><p>${sym} 暂无最新信号数据</p></body></html>`);
  }

  const s = signals[sym];
  const mid = s.contract?.mid?.toFixed(2) || '--';
  const otm = s.otm != null ? s.otm.toFixed(1) + '%' : '--';
  const delta = s.contract?.delta != null ? s.contract.delta.toFixed(3) : '--';
  const iv = s.contract?.iv != null ? (s.contract.iv * 100).toFixed(1) + '%' : '--';
  const annual = s.annual || '--';
  const safePrice = s.safePrice != null ? '$' + s.safePrice.toFixed(2) : '--';

  const tempBg = s.decision?.temperature === '高温' ? 'bg-red' : s.decision?.temperature === '低温' ? 'bg-green' : 'bg-yellow';
  const swanBg = s.decision?.blackSwan === '红灯' ? 'bg-red' : s.decision?.blackSwan === '绿灯' ? 'bg-green' : 'bg-yellow';
  const stanceBg = s.decision?.putStance === '不利' ? 'bg-red' : s.decision?.putStance === '有利' ? 'bg-green' : 'bg-yellow';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sym} · Sell Put 信号</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1522;color:#cddbf7;padding:24px;max-width:700px;margin:0 auto}
h1{font-size:1.4rem;margin-bottom:4px}
.muted{color:#6b7fa3;font-size:.82rem}
.card{background:#111d2f;border:1px solid #1f2b44;border-radius:10px;padding:20px;margin:16px 0}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1a2942}
.row:last-child{border-bottom:none}
.label{color:#6b7fa3;font-size:.82rem}
.value{font-weight:600;text-align:right}
.stance{font-size:1.2rem;margin:8px 0}
.risk{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.82rem;margin-left:8px}
.section{margin:16px 0;line-height:1.6;color:#b0c4e8;font-size:.88rem;white-space:pre-wrap}
.footer{text-align:center;color:#6b7fa3;font-size:.75rem;margin-top:24px;padding-top:16px;border-top:1px solid #1a2942}
a{color:#4d9eff;text-decoration:none}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.78rem;font-weight:600}
.bg-red{background:#3d1e2a;color:#ff6b7d}.bg-yellow{background:#2a3520;color:#ffd54a}.bg-green{background:#1b3a2a;color:#45d483}
</style>
</head>
<body>
<h1>${sym} · Sell Put 信号</h1>


<p class="muted">${fmtDate(s.timestamp)} | Agent v0.5.0 自动分析</p>

<div class="card">
  <div class="stance">${stanceBadge(s.decision?.stance)}
    <span class="risk" style="color:${riskColor(s.decision?.riskScore)};background:${s.decision?.riskScore >= 7 ? '#3d1e2a' : s.decision?.riskScore >= 5 ? '#2a3520' : '#1b3a2a'}">风险 ${s.decision?.riskScore}/10</span>
    <span class="badge ${stanceBg}" style="margin-left:8px">${s.decision?.putStance || '--'}</span>
  </div>
  <div style="margin-top:8px">
    <span class="badge ${tempBg}" style="margin-right:6px">${s.decision?.temperature || '--'}</span>
    <span class="badge ${swanBg}">${s.decision?.blackSwan || '--'}</span>
  </div>
</div>
  <div style="margin-top:8px">
    <span class="badge bg-${
      s.decision?.temperature === '高温' ? 'red' : '绿色' === 'green' ? 'error' : 'yellow'
    }" style="margin-right:6px">${s.decision?.temperature || '--'}</span>
    <span class="badge bg-${
      s.decision?.blackSwan === '红灯' ? 'red' : s.decision?.blackSwan === '黄灯' ? 'yellow' : 'green'
    }">尾巴风险: ${s.decision?.blackSwan || '--'}</span>
  </div>
</div>

<div class="card">
  <div class="row"><span class="label">价格</span><span class="value">$${s.price?.toFixed(2) || '--'}</span></div>
  <div class="row"><span class="label">合约</span><span class="value">$${s.contract?.strike?.toFixed(0)}P DTE${s.contract?.dte}</span></div>
  <div class="row"><span class="label">Bid / Mid / Ask</span><span class="value">$${s.contract?.bid?.toFixed(2)} / $${mid} / $${s.contract?.ask?.toFixed(2) || '--'}</span></div>
  <div class="row"><span class="label">OTM 安全垫</span><span class="value">${otm}</span></div>
  <div class="row"><span class="label">Δ</span><span class="value">${delta}</span></div>
  <div class="row"><span class="label">IV</span><span class="value">${iv}</span></div>
  <div class="row"><span class="label">年化收益</span><span class="value">${annual}%</span></div>
  <div class="row"><span class="label">严格安全价</span><span class="value">${safePrice}</span></div>
  <div class="row"><span class="label">操作</span><span class="value">${s.action || '--'}</span></div>
</div>

<div class="section">
<strong>判断理由：</strong>
${(s.decision?.reasoning || '--').replace(/\n/g, '<br>')}
</div>

<div class="footer">
  数据来源: <a href="https://github.com/jiangshenhk/donew">Sell Put Agent</a> · 自动更新 · 仅供参考
</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
