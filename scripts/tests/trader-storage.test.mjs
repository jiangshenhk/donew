import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, writeJsonAtomic } from '../lib/storage/json-file.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
