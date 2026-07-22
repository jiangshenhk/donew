import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret';
const LOCAL_DB = path.join(__dirname, '..', '..', 'db', 'users.json');
const TMP_DB = '/tmp/users.json';

// 读：先从 /tmp 读，没有则回退到本地文件，都没有返回空数组
function readUsers() {
  try { return JSON.parse(fs.readFileSync(TMP_DB, 'utf8')); }
  catch {
    try { return JSON.parse(fs.readFileSync(LOCAL_DB, 'utf8')); }
    catch { return []; }
  }
}

// 写：始终写 /tmp
function writeUsers(users) {
  try { fs.writeFileSync(TMP_DB, JSON.stringify(users, null, 2), 'utf8'); }
  catch {}
}

export function findUser(predicate) { return readUsers().find(predicate); }

export function addUser(user) {
  const users = readUsers();
  users.push(user);
  writeUsers(users);
}

export function updateUser(predicate, updater) {
  const users = readUsers();
  const idx = users.findIndex(predicate);
  if (idx === -1) return false;
  updater(users[idx]);
  writeUsers(users);
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
