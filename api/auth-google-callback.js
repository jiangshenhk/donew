import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import { findUser, addUser, updateUser, signToken } from './_lib/auth-utils.js';

function httpsJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const isPost = opts.method === 'POST';
    const body = opts.body || null;

    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(opts.headers || {}),
      },
    }, (rsp) => {
      let data = '';
      rsp.on('data', c => data += c);
      rsp.on('end', () => {
        try { resolve({ status: rsp.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: rsp.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('https timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const code = u.searchParams.get('code');
  const error = u.searchParams.get('error');

  if (error || !code) {
    res.writeHead(302, { Location: `/auth/?error=${encodeURIComponent(error || 'no_code')}` });
    return res.end();
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.writeHead(302, { Location: `/auth/?error=${encodeURIComponent('Google OAuth 未配置')}` });
      return res.end();
    }

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;

    const tokenRes = await httpsJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${base}/api/auth-google-callback`,
      }),
    });

    if (tokenRes.status !== 200 || !tokenRes.body.access_token) {
      res.writeHead(302, { Location: `/auth/?error=${encodeURIComponent('令牌交换失败')}` });
      return res.end();
    }

    const userInfo = await httpsJson('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.body.access_token}` },
    });

    if (!userInfo.body.email) {
      res.writeHead(302, { Location: `/auth/?error=${encodeURIComponent('获取用户信息失败')}` });
      return res.end();
    }

    const { id: googleId, email, name, picture } = userInfo.body;

    let user = findUser(u => u.googleId === googleId);
    if (!user) {
      user = {
        id: uuidv4(),
        googleId,
        email,
        name,
        picture,
        method: 'google',
        activated: true,
        createdAt: new Date().toISOString(),
      };
      addUser(user);
    } else {
      updateUser(u => u.googleId === googleId, u => {
        u.name = name;
        u.email = email;
        u.picture = picture;
      });
    }

    const token = signToken(user);
    res.writeHead(302, { Location: `/auth/?token=${encodeURIComponent(token)}` });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: `/auth/?error=${encodeURIComponent(e.message)}` });
    res.end();
  }
}
