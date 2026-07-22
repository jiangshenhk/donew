import { findUser, comparePassword, signToken, sendJson, handleOptions } from './_lib/auth-utils.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, { ok: false, error: 'Method not allowed' }, 405);

  try {
    const { email, password } = req.body;
    if (!email || !password) return sendJson(res, { ok: false, error: '请填写邮箱和密码' });

    const user = findUser(u => u.email === email && u.method === 'email');
    if (!user) return sendJson(res, { ok: false, error: '邮箱或密码错误' });
    if (!user.activated) return sendJson(res, { ok: false, error: '账号尚未激活' });

    const match = await comparePassword(password, user.password);
    if (!match) return sendJson(res, { ok: false, error: '邮箱或密码错误' });

    const token = signToken(user);
    sendJson(res, { ok: true, token, user: { id: user.id, name: user.name, email: user.email, method: user.method } });
  } catch (e) {
    sendJson(res, { ok: false, error: e.message }, 500);
  }
}
