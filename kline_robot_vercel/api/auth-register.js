import { v4 as uuidv4 } from 'uuid';
import { findUser, addUser, hashPassword, sendJson, handleOptions } from './_lib/auth-utils.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, { ok: false, error: 'Method not allowed' }, 405);

  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return sendJson(res, { ok: false, error: '请填写所有字段' });
    if (password.length < 6)
      return sendJson(res, { ok: false, error: '密码至少 6 位' });

    if (findUser(u => u.email === email))
      return sendJson(res, { ok: false, error: '该邮箱已被注册' });

    const token = uuidv4();
    addUser({
      id: uuidv4(), name, email,
      password: await hashPassword(password),
      method: 'email', activated: false,
      activateToken: token,
      activateExpires: Date.now() + 3600_000,
      createdAt: new Date().toISOString(),
    });

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;
    console.log(`\n📧 [激活链接] ${email} → ${base}/api/auth-activate?token=${token}\n`);

    sendJson(res, { ok: true, message: '注册成功，请在 Vercel 函数日志中查看激活链接' });
  } catch (e) {
    sendJson(res, { ok: false, error: e.message }, 500);
  }
}
