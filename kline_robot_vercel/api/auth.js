import { v4 as uuidv4 } from 'uuid';
import {
  findUser, addUser, updateUser, signToken,
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
      if (await findUser(u => u.email === email)) return sendJson(res, { ok: false, error: '该邮箱已被注册' });

      const user = {
        id: uuidv4(), name, email,
        password: await hashPassword(password),
        method: 'email', activated: true,
        createdAt: new Date().toISOString(),
      };
      await addUser(user);
      return sendJson(res, { ok: true, token: signToken(user), user: { id: user.id, name: user.name, email: user.email, method: user.method } });
    }

    // ── POST /login ──
    if (path === '/login' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) return sendJson(res, { ok: false, error: '请填写邮箱和密码' });
      const user = await findUser(u => u.email === email && u.method === 'email');
      if (!user) return sendJson(res, { ok: false, error: '邮箱或密码错误' });
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

      let user = await findUser(u => u.googleId === userInfo.id);
      if (!user) {
        const newUser = { id: uuidv4(), googleId: userInfo.id, email: userInfo.email || '', name: userInfo.name || userInfo.email, avatar: userInfo.picture || '', method: 'google', activated: true, createdAt: new Date().toISOString() };
        await addUser(newUser);
        user = newUser;
      } else {
        await updateUser(u => u.googleId === userInfo.id, u => { u.name = userInfo.name || u.name; u.avatar = userInfo.picture || u.avatar; });
      }
      res.writeHead(302, { Location: `/auth-login.html?token=${signToken(user)}` });
      return res.end();
    }

    return sendJson(res, { ok: false, error: 'Not found' }, 404);
  } catch (e) {
    return sendJson(res, { ok: false, error: e.message }, 500);
  }
}
