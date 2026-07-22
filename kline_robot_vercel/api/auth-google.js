import { handleOptions } from './_lib/auth-utils.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('Google OAuth 未配置');
  }

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId, redirect_uri: `${base}/api/auth-google-callback`,
    response_type: 'code', scope: 'openid email profile',
    access_type: 'offline', prompt: 'select_account',
  });

  res.writeHead(302, { Location: url });
  res.end();
}
