import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_API = 'https://blob.vercel-storage.com';
const BLOB_KEY = 'users.json';

let userCache = null;
let cacheTime = 0;
const CACHE_TTL = 3000; // 3秒缓存

async function readUsers() {
  // 有 Blob token 就用 Blob
  if (BLOB_TOKEN) {
    const now = Date.now();
    if (userCache && now - cacheTime < CACHE_TTL) return userCache;
    try {
      // 列出 Blob 获取最新 URL
      const listRes = await fetch(`${BLOB_API}/?prefix=${BLOB_KEY}`, {
        headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
      });
      const list = await listRes.json();
      if (list.blobs && list.blobs.length > 0) {
        const fileRes = await fetch(list.blobs[0].url);
        if (fileRes.ok) {
          const data = await fileRes.json();
          userCache = data;
          cacheTime = now;
          return data;
        }
      }
    } catch (e) {
      console.log('Blob read failed, using cache:', e.message);
      if (userCache) return userCache;
    }
  }
  // 回退本地
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'users.json'), 'utf8')); }
  catch { return []; }
}

async function writeUsers(users) {
  userCache = users;
  cacheTime = Date.now();
  if (BLOB_TOKEN) {
    try {
      const res = await fetch(`${BLOB_API}/${BLOB_KEY}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${BLOB_TOKEN}`,
          'Content-Type': 'application/json',
          'x-add-random-suffix': 'false',
          'x-content-type': 'application/json',
        },
        body: JSON.stringify(users),
      });
      if (!res.ok) console.log('Blob write failed:', res.status);
    } catch (e) {
      console.log('Blob write error:', e.message);
    }
  }
}

export async function findUser(predicate) {
  return (await readUsers()).find(predicate);
}

export async function addUser(user) {
  const users = await readUsers();
  users.push(user);
  await writeUsers(users);
}

export async function updateUser(predicate, updater) {
  const users = await readUsers();
  const idx = users.findIndex(predicate);
  if (idx === -1) return false;
  updater(users[idx]);
  await writeUsers(users);
  return true;
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, method: user.method },
    JWT_SECRET, { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

export async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
export async function comparePassword(pw, hash) { return bcrypt.compare(pw, hash); }

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify(data));
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return true;
  }
  return false;
}

export function getUserFromReq(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}
