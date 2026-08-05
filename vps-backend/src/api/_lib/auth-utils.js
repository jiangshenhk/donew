import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret';
const USERS_FILE = path.join(__dirname, '..', '..', '..', 'data', 'users.json');

let userCache = null;
let cacheTime = 0;
const CACHE_TTL = 3000; // 3秒缓存

async function readUsers() {
  const now = Date.now();
  if (userCache && now - cacheTime < CACHE_TTL) return userCache;
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    userCache = Array.isArray(users) ? users : [];
  } catch {
    userCache = [];
  }
  cacheTime = now;
  return userCache;
}

async function writeUsers(users) {
  userCache = users;
  cacheTime = Date.now();
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + '\n', 'utf8');
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
