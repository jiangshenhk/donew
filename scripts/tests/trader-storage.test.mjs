import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, writeJsonAtomic } from '../lib/storage/json-file.mjs';
import { createTraderKvStore } from '../lib/storage/trader-store.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ─── fake SQLite DB/statement 辅助 ───
function makeFakeDb({ rows = [], throwOn = null, statements = {} } = {}) {
  const calls = { prepares: [], gets: [], runs: [] };
  const statement = {
    get: (...args) => {
      calls.gets.push(args);
      if (throwOn === 'get') throw new Error('get fail');
      return rows.length ? rows[0] : undefined;
    },
    run: (...args) => {
      calls.runs.push(args);
      if (throwOn === 'run') throw new Error('run fail');
      return { changes: 1 };
    },
  };
  const db = {
    prepare: (sql) => {
      calls.prepares.push(sql);
      if (throwOn === 'prepare') throw new Error('prepare fail');
      return statements[sql] || statement;
    },
  };
  return { db, calls };
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jsonstore-'));
}

test('readJson: 正常读取', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'a.json');
  fs.writeFileSync(f, '{"x":1}');
  assert.deepEqual(readJson(f), { x: 1 });
});

test('readJson: 损坏 JSON 返回 fallback', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'bad.json');
  fs.writeFileSync(f, 'not-json{');
  assert.equal(readJson(f, { fallback: 'FB' }), 'FB');
});

test('readJson: 文件不存在返回 fallback/null', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'none.json');
  assert.equal(readJson(f), null);
  assert.deepEqual(readJson(f, { fallback: [] }), []);
});

test('writeJsonAtomic: 缩进2的写入内容', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'b.json');
  writeJsonAtomic(f, { a: 1, b: [1, 2] });
  const content = fs.readFileSync(f, 'utf-8');
  assert.ok(content.includes('{\n  "a": 1'));
  assert.deepEqual(JSON.parse(content), { a: 1, b: [1, 2] });
});

test('writeJsonAtomic: ensureParent=true 创建父目录', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'sub', 'deep', 'c.json');
  writeJsonAtomic(f, { x: 1 }, { ensureParent: true });
  assert.ok(fs.existsSync(f));
});

test('writeJsonAtomic: ensureParent=false 父目录不存在则抛错', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'no-parent', 'c.json');
  assert.throws(() => writeJsonAtomic(f, { x: 1 }, { ensureParent: false }));
});

test('writeJsonAtomic: 长线 tempPathFactory 路径', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'long.json');
  let tmpPath = null;
  const factory = (fp) => { tmpPath = fp + '.tmp-' + process.pid; return tmpPath; };
  writeJsonAtomic(f, { x: 1 }, { tempPathFactory: factory });
  assert.equal(tmpPath, f + '.tmp-' + process.pid);
});

test('writeJsonAtomic: 短线/SellPut tempPathFactory 路径', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'short.json');
  let tmpPath = null;
  const factory = (fp) => { tmpPath = `${fp}.${process.pid}.${Date.now()}.tmp`; return tmpPath; };
  writeJsonAtomic(f, { x: 1 }, { tempPathFactory: factory });
  assert.match(tmpPath, new RegExp(process.pid));
  assert.ok(tmpPath.endsWith('.tmp'));
});

test('writeJsonAtomic: rename 成功后无临时文件', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'd.json');
  writeJsonAtomic(f, { x: 1 });
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.equal(files[0], 'd.json');
});

test('writeJsonAtomic: write 失败清理临时文件并抛错', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'e.json');
  let wrote = false;
  const fsImpl = {
    mkdirSync: fs.mkdirSync,
    writeFileSync: () => { wrote = true; throw new Error('disk full'); },
    renameSync: fs.renameSync,
    existsSync: fs.existsSync,
    unlinkSync: fs.unlinkSync,
  };
  assert.throws(() => writeJsonAtomic(f, { x: 1 }, { fsImpl, ensureParent: false }));
  assert.equal(wrote, true);
  assert.ok(!fs.existsSync(f));
});

test('writeJsonAtomic: rename 失败清理临时文件并抛错', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'f.json');
  const tmpPath = path.join(dir, 'f.json.123.456.tmp');
  const fsImpl = {
    mkdirSync: fs.mkdirSync,
    writeFileSync: (p, c) => fs.writeFileSync(p, c),
    renameSync: () => { throw new Error('rename failed'); },
    existsSync: fs.existsSync,
    unlinkSync: fs.unlinkSync,
  };
  assert.throws(() => writeJsonAtomic(f, { x: 1 }, { fsImpl, tempPathFactory: () => tmpPath }));
  assert.ok(!fs.existsSync(tmpPath), '临时文件应被清理');
});

// ─── trader-store KV 测试 ───
const SQL_SELECT = 'SELECT value FROM trader_store WHERE key=?';
const SQL_UPSERT_SHORT = "INSERT OR REPLACE INTO trader_store (key, value, updated_at) VALUES (?, ?, datetime('now'))";
const SQL_UPSERT_LONG = 'INSERT OR REPLACE INTO trader_store (key, value) VALUES (?, ?)';

test('kv: get 成功解析对象', () => {
  const { db } = makeFakeDb({ rows: [{ value: '{"a":1}' }] });
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.deepEqual(store.get('k'), { a: 1 });
});

test('kv: get 成功解析数组', () => {
  const { db } = makeFakeDb({ rows: [{ value: '[1,2]' }] });
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.deepEqual(store.get('k'), [1, 2]);
});

test('kv: key缺失返回 null', () => {
  const { db } = makeFakeDb({ rows: [] });
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(store.get('k'), null);
});

test('kv: 无DB返回 null/false', () => {
  const store = createTraderKvStore({ getDb: () => null, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(store.get('k'), null);
  assert.equal(store.put('k', {}), false);
});

test('kv: ensureReady false 返回 null/false', () => {
  const { db } = makeFakeDb();
  const store = createTraderKvStore({ getDb: () => db, ensureReady: () => false, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(store.get('k'), null);
  assert.equal(store.put('k', {}), false);
});

test('kv: ensureReady 抛错返回 null/false', () => {
  const { db } = makeFakeDb();
  const store = createTraderKvStore({ getDb: () => db, ensureReady: () => { throw new Error('ready fail'); }, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(store.get('k'), null);
  assert.equal(store.put('k', {}), false);
});

test('kv: prepare 抛错返回 null/false', () => {
  const { db } = makeFakeDb({ throwOn: 'prepare' });
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(store.get('k'), null);
  assert.equal(store.put('k', {}), false);
});

test('kv: get/run 抛错返回 null/false', () => {
  const g = makeFakeDb({ throwOn: 'get' });
  const gs = createTraderKvStore({ getDb: () => g.db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(gs.get('k'), null);
  const r = makeFakeDb({ throwOn: 'run' });
  const rs = createTraderKvStore({ getDb: () => r.db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(rs.put('k', {}), false);
});

test('kv: 损坏 JSON 返回 null', () => {
  const { db } = makeFakeDb({ rows: [{ value: 'not-json{' }] });
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(store.get('k'), null);
});

test('kv: 循环对象 stringify 失败返回 false', () => {
  const { db, calls } = makeFakeDb();
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  const circular = {}; circular.self = circular;
  assert.equal(store.put('k', circular), false);
  assert.equal(calls.runs.length, 0);
});

test('kv: put 成功参数与 SQL 正确', () => {
  const { db, calls } = makeFakeDb();
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_LONG });
  assert.equal(store.put('k', { x: 1 }), true);
  assert.equal(calls.prepares[0], SQL_UPSERT_LONG);
  assert.deepEqual(calls.runs[0], ['k', '{"x":1}']);
});

test('kv: 短线显式 updated_at SQL 被原样使用', () => {
  const { db, calls } = makeFakeDb();
  const store = createTraderKvStore({ getDb: () => db, selectSql: SQL_SELECT, upsertSql: SQL_UPSERT_SHORT });
  store.put('k', { x: 1 });
  assert.equal(calls.prepares[0], SQL_UPSERT_SHORT);
});
