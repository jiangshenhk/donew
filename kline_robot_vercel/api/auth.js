import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import {
  findUser, addUser, updateUser, signToken, verifyToken,
  hashPassword, comparePassword, sendJson, handleOptions,
  getUserFromReq,
} from './_lib/auth-utils.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace('/api/auth', '');

  try {
    // ── POST /register ──
    if (path === '/register' && req.method === 'POST') {
      const { name, email, password } = req.body;
      if (!name || !email || !password) return sendJson(res, { ok: false, error: '请填写所有字段' });
      if (password.length < 6) return sendJson(res, { ok: false, error: '密码至少 6 位' });
      if (findUser(u => u.email === email)) return sendJson(res, { ok: false, error: '该邮箱已被注册' });

      const token = uuidv4();
      addUser({
        id: uuidv4(), name, email,
        password: await hashPassword(password),
        method: 'email', activated: false,
        activateToken: token, activateExpires: Date.now() + 3600_000,
        createdAt: new Date().toISOString(),
      });
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      console.log(`\n📧 [激活] ${email} → ${base}/api/auth/activate?token=${token}\n`);
      return sendJson(res, { ok: true, message: '注册成功，激活链接已打印到函数日志' });
    }

    // ── GET /activate ──
    if (path === '/activate' && req.method === 'GET') {
      const { token } = url.searchParams;
      if (!token) return sendJson(res, { ok: false, error: '缺少激活令牌' });
      const user = findUser(u => u.activateToken === token);
      if (!user) return sendJson(res, { ok: false, error: '激活令牌无效' });
      if (user.activated) return sendJson(res, { ok: false, error: '该账号已激活' });
      if (Date.now() > user.activateExpires) return sendJson(res, { ok: false, error: '激活链接已过期' });
      updateUser(u => u.activateToken === token, u => { u.activated = true; delete u.activateToken; delete u.activateExpires; });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>激活成功</title><style>body{font-family:sans-serif;background:#0f1117;color:#e1e4e8;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px;text-align:center}h1{color:#3fb950}a{color:#58a6ff}</style></head><body><div class="card"><h1>✅ 激活成功</h1><p>可以<a href="/auth-login.html">登录</a>了。</p></div></body></html>');
    }

    // ── POST /login ──
    if (path === '/login' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) return sendJson(res, { ok: false, error: '请填写邮箱和密码' });
      const user = findUser(u => u.email === email && u.method === 'email');
      if (!user) return sendJson(res, { ok: false, error: '邮箱或密码错误' });
      if (!user.activated) return sendJson(res, { ok: false, error: '账号尚未激活' });
      if (!await comparePassword(password, user.password)) return sendJson(res, { ok: false, error: '邮箱或密码错误' });
      return sendJson(res, { ok: true, token: signToken(user), user: { id: user.id, name: user.name, email: user.email, method: user.method } });
    }

    // ── GET /me ──
    if (path === '/me' && req.method === 'GET') {
      const user = getUserFromReq(req);
      return sendJson(res, { ok: !!user, user: user || null });
    }

    // ── POST /logout ──
    if (path === '/logout' && req.method === 'POST') {
      return sendJson(res, { ok: true });
    }

    // ── GET /google ──
    if (path === '/google' && req.method === 'GET') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('Google OAuth 未配置'); }
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const gUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: clientId, redirect_uri: `${base}/api/auth/google-callback`,
        response_type: 'code', scope: 'openid email profile', access_type: 'offline', prompt: 'select_account',
      });
      res.writeHead(302, { Location: gUrl });
      return res.end();
    }

    // ── GET /google-callback ──
    if (path === '/google-callback' && req.method === 'GET') {
      const { code } = url.searchParams;
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      if (!code) { res.writeHead(302, { Location: '/auth-login.html?error=no_code' }); return res.end(); }
      const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) { res.writeHead(302, { Location: '/auth-login.html?error=config' }); return res.end(); }

      const tokenData = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${base}/api/auth/google-callback`, grant_type: 'authorization_code' }),
      }).then(r => r.json());

      if (!tokenData.access_token) { res.writeHead(302, { Location: '/auth-login.html?error=token' }); return res.end(); }

      const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo?alt=json', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }).then(r => r.json());

      if (!userInfo.id) { res.writeHead(302, { Location: '/auth-login.html?error=userinfo' }); return res.end(); }

      let user = findUser(u => u.googleId === userInfo.id);
      if (!user) {
        const newUser = { id: uuidv4(), googleId: userInfo.id, email: userInfo.email || '', name: userInfo.name || userInfo.email, avatar: userInfo.picture || '', method: 'google', activated: true, createdAt: new Date().toISOString() };
        addUser(newUser);
        user = newUser;
      } else {
        updateUser(u => u.googleId === userInfo.id, u => { u.name = userInfo.name || u.name; u.avatar = userInfo.picture || u.avatar; });
      }
      res.writeHead(302, { Location: `/auth-login.html?token=${signToken(user)}` });
      return res.end();
    }

    return sendJson(res, { ok: false, error: 'Not found' }, 404);
  } catch (e) {
    return sendJson(res, { ok: false, error: e.message }, 500);
  }
}
