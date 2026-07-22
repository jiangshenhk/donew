import { findUser, updateUser, sendJson, handleOptions } from './_lib/auth-utils.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return sendJson(res, { ok: false, error: 'Method not allowed' }, 405);

  const { token } = req.query;
  if (!token) return sendJson(res, { ok: false, error: '缺少激活令牌' });

  const user = findUser(u => u.activateToken === token);
  if (!user) return sendJson(res, { ok: false, error: '激活令牌无效' });
  if (user.activated) return sendJson(res, { ok: false, error: '该账号已激活' });
  if (Date.now() > user.activateExpires) return sendJson(res, { ok: false, error: '激活链接已过期' });

  updateUser(u => u.activateToken === token, u => {
    u.activated = true;
    delete u.activateToken;
    delete u.activateExpires;
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>激活成功</title>
<style>body{font-family:sans-serif;background:#0f1117;color:#e1e4e8;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px;text-align:center}
h1{color:#3fb950}a{color:#58a6ff}</style></head><body>
<div class="card"><h1>✅ 激活成功</h1><p>账号已激活，可以<a href="/auth-login.html">登录</a>了。</p></div></body></html>`);
}
