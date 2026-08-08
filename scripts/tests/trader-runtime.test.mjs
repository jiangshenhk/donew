import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNtfyClient } from '../lib/integrations/ntfy.mjs';
import { createFileRunLock, defaultProcessExists } from '../lib/runtime/run-lock.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ─── ntfy 测试 ───
function makeMockRequest(handler) {
  return async (url, options) => {
    const res = handler(url, options);
    return {
      ok: res?.ok !== false,
      status: res?.status ?? 200,
    };
  };
}

test('ntfy: ASCII Title 走 header', async () => {
  let captured = null;
  const request = makeMockRequest((url, options) => {
    captured = { url, options };
    return { ok: true, status: 200 };
  });
  const client = createNtfyClient({
    server: 'https://ntfy.sh', topic: 'test', token: 'tk',
    request, titleMode: 'ascii-header', requireOk: true,
  });
  await client.send('Hello 中文', 'msg');
  assert.equal(captured.options.headers['Title'], 'Hello');
  assert.equal(captured.options.headers['Authorization'], 'Bearer tk');
  assert.equal(captured.options.headers['Priority'], '4');
  assert.equal(captured.options.headers['Markdown'], 'yes');
});

test('ntfy: Unicode Title 走 query', async () => {
  let captured = null;
  const request = makeMockRequest((url, options) => {
    captured = { url, options };
    return { ok: true, status: 200 };
  });
  const client = createNtfyClient({
    server: 'https://ntfy.sh', topic: 'test', token: 'tk',
    request, titleMode: 'query', requireOk: true,
  });
  await client.send('中文标题', 'msg');
  assert.equal(captured.url.searchParams.get('title'), '中文标题');
  assert.equal(captured.options.headers['Title'], undefined);
});

test('ntfy: tags 有值和空值', async () => {
  let lastHeaders = null;
  const request = makeMockRequest((url, options) => {
    lastHeaders = options.headers;
    return { ok: true, status: 200 };
  });
  const client = createNtfyClient({ server: 'https://ntfy.sh', topic: 't', token: 'k', request });
  await client.send('x', 'msg', 'skull');
  assert.equal(lastHeaders['Tags'], 'skull');
  await client.send('y', 'msg', '');
  assert.equal(lastHeaders['Tags'], undefined);
});

test('ntfy: 非2xx 且 requireOk=true 返回 ok:false', async () => {
  const request = makeMockRequest(() => ({ ok: false, status: 500 }));
  const client = createNtfyClient({ server: 'https://ntfy.sh', topic: 't', token: 'k', request, requireOk: true });
  const r = await client.send('x', 'msg');
  assert.equal(r.ok, false);
  assert.match(r.error, /500/);
});

test('ntfy: requireOk=false 非2xx 返回 ok:true', async () => {
  const request = makeMockRequest(() => ({ ok: false, status: 500 }));
  const client = createNtfyClient({ server: 'https://ntfy.sh', topic: 't', token: 'k', request, requireOk: false });
  const r = await client.send('x', 'msg');
  assert.equal(r.ok, true);
});

test('ntfy: onSuccess/onError 回调', async () => {
  let successCalled = false;
  let errorCalled = false;
  const okReq = makeMockRequest(() => ({ ok: true, status: 200 }));
  const okClient = createNtfyClient({ server: 'https://ntfy.sh', topic: 't', token: 'k', request: okReq, onSuccess: () => { successCalled = true; } });
  await okClient.send('x', 'm');
  assert.equal(successCalled, true);

  const errReq = async () => { throw new Error('boom'); };
  const errClient = createNtfyClient({ server: 'https://ntfy.sh', topic: 't', token: 'k', request: errReq, onError: () => { errorCalled = true; } });
  await errClient.send('x', 'm');
  assert.equal(errorCalled, true);
});

test('ntfy: 配置 timeoutMs 时 request 收到第三参数', async () => {
  let receivedTimeout = null;
  const request = async (url, options, timeout) => {
    receivedTimeout = timeout;
    return { ok: true, status: 200 };
  };
  const client = createNtfyClient({ server: 'https://ntfy.sh', topic: 't', token: 'k', request, timeoutMs: 10000 });
  await client.send('x', 'm');
  assert.equal(receivedTimeout, 10000);
});

test('ntfy: 不配置 timeout 时按普通请求路径调用(无第三参数)', async () => {
  let args = null;
  const request = async (...a) => { args = a; return { ok: true, status: 200 }; };
  const client = createNtfyClient({ server: 'https://ntfy.sh', topic: 't', token: 'k', request });
  await client.send('x', 'm');
  assert.equal(args.length, 2); // url, options，无 timeout
});

// ─── run-lock 测试 ───
function tmpLock() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runlock-'));
  return path.join(dir, 'lock.json');
}

test('run-lock: 首次获取成功', () => {
  const lockFile = tmpLock();
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000 });
  const release = lock.acquire();
  assert.ok(release);
  assert.ok(fs.existsSync(lockFile));
  release();
  assert.ok(!fs.existsSync(lockFile));
});

test('run-lock: 同一锁重复获取 busy', () => {
  const lockFile = tmpLock();
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 1, processExists: () => true });
  lock.acquire();
  const second = lock.acquire();
  assert.equal(second, null); // 默认 return-null
});

test('run-lock: busyAction=throw 时抛错', () => {
  const lockFile = tmpLock();
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 1, processExists: () => true, busyAction: 'throw' });
  lock.acquire();
  assert.throws(() => lock.acquire(), /已有任务运行中/);
});

test('run-lock: 存活 PID 视为占用', () => {
  const lockFile = tmpLock();
  // 用当前进程的 PID（肯定存活）
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: process.pid, processExists: defaultProcessExists });
  const release = lock.acquire();
  const second = lock.acquire();
  assert.equal(second, null);
  release();
});

test('run-lock: 死亡 PID + 过期锁可覆盖', () => {
  const lockFile = tmpLock();
  const lock = createFileRunLock({ lockFile, staleMs: 100, pid: 1, processExists: () => false });
  const release = lock.acquire();
  // 等锁过期（staleMs=100ms 且 pid 死亡）
  return new Promise(resolve => {
    setTimeout(() => {
      const second = lock.acquire();
      assert.ok(second);
      resolve();
    }, 200);
  });
});

test('run-lock: mtime回退-新鲜损坏锁(短线/SellPut)视为busy', () => {
  const lockFile = tmpLock();
  fs.writeFileSync(lockFile, 'not-json{');
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 1, processExists: () => false, startedAtFallback: 'mtime' });
  const result = lock.acquire();
  assert.equal(result, null); // 新鲜 mtime → busy
});

test('run-lock: mtime回退-损坏锁超过阈值(短线/SellPut)可覆盖', () => {
  const lockFile = tmpLock();
  fs.writeFileSync(lockFile, 'not-json{');
  // 把文件 mtime 改成超过阈值（过去 1 小时）
  const past = Date.now() - 60 * 60 * 1000;
  fs.utimesSync(lockFile, new Date(past), new Date(past));
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 1, processExists: () => false, startedAtFallback: 'mtime' });
  const release = lock.acquire();
  assert.ok(release); // mtime 老 → 陈旧 → 可覆盖
});

test('run-lock: zero回退-损坏锁(长线)立即视为陈旧可覆盖', () => {
  const lockFile = tmpLock();
  fs.writeFileSync(lockFile, 'not-json{');
  const lock = createFileRunLock({ lockFile, staleMs: 10 * 60 * 1000, pid: 1, processExists: () => false, startedAtFallback: 'zero' });
  const release = lock.acquire();
  assert.ok(release); // zero 年龄 → 立即陈旧
});

test('run-lock: 有PID但进程死亡时可立即覆盖', () => {
  const lockFile = tmpLock();
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 99999999, startedAt: new Date().toISOString() }));
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 1, processExists: () => false, startedAtFallback: 'mtime' });
  const release = lock.acquire();
  assert.ok(release); // 进程死亡 → 可覆盖
});

test('run-lock: 写锁失败后清理fd和残留锁', () => {
  const lockFile = tmpLock();
  let unlinkCalled = false;
  let closeCalled = false;
  const fsImpl = {
    openSync: () => 12345,
    writeFileSync: () => { throw new Error('disk full'); },
    closeSync: () => { closeCalled = true; },
    unlinkSync: () => { unlinkCalled = true; },
    readFileSync: () => { throw new Error('no file'); },
    statSync: () => { throw new Error('no stat'); },
  };
  const lock = createFileRunLock({ lockFile, staleMs: 1000, pid: 1, processExists: () => false, fsImpl });
  let caught = null;
  try { lock.acquire(); } catch (e) { caught = e; }
  assert.equal(closeCalled, true, '写失败后应关闭fd');
  assert.equal(unlinkCalled, true, '写失败后应删除残留锁');
  assert.equal(caught?.runLockPhase, 'write', '错误应带 write 阶段标记');
});

test('run-lock: removeUnreadableOnRelease=true 时损坏锁release删除', () => {
  const lockFile = tmpLock();
  fs.writeFileSync(lockFile, 'not-json{');
  const lock = createFileRunLock({ lockFile, staleMs: 1000, pid: 1, processExists: () => false, startedAtFallback: 'mtime', releaseForm: 'separate', removeUnreadableOnRelease: true });
  lock.release();
  assert.ok(!fs.existsSync(lockFile), '损坏锁在 removeUnreadableOnRelease=true 时应删除');
});

test('run-lock: removeUnreadableOnRelease=false 时损坏锁release保留', () => {
  const lockFile = tmpLock();
  fs.writeFileSync(lockFile, 'not-json{');
  const lock = createFileRunLock({ lockFile, staleMs: 1000, pid: 1, processExists: () => false, startedAtFallback: 'mtime', releaseForm: 'separate', removeUnreadableOnRelease: false });
  // 模拟长线：损坏锁 + 独立 release，release 不应删除损坏锁
  lock.release();
  assert.ok(fs.existsSync(lockFile), '损坏锁在 removeUnreadableOnRelease=false 时应保留');
});

test('run-lock: epoch-ms 格式（长线）', () => {
  const lockFile = tmpLock();
  const lock = createFileRunLock({ lockFile, staleMs: 10 * 60 * 1000, startedAtFormat: 'epoch-ms', pid: 1, processExists: () => false });
  const release = lock.acquire();
  const content = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
  assert.equal(typeof content.startedAt, 'number');
  release();
});

test('run-lock: ISO 格式 + mode 字段（SellPut）', () => {
  const lockFile = tmpLock();
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 1, processExists: () => false, lockContent: { mode: 'daily' } });
  const release = lock.acquire();
  const content = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
  assert.equal(content.mode, 'daily');
  assert.ok(typeof content.startedAt === 'string'); // ISO
  release();
});

test('run-lock: releaseForm=separate 独立 release（长线）', () => {
  const lockFile = tmpLock();
  const lock = createFileRunLock({ lockFile, staleMs: 10 * 60 * 1000, pid: 1, processExists: () => false, releaseForm: 'separate' });
  const r = lock.acquire();
  assert.equal(r, true);
  assert.ok(fs.existsSync(lockFile));
  lock.release();
  assert.ok(!fs.existsSync(lockFile));
});

test('run-lock: owner 才能 release', () => {
  const lockFile = tmpLock();
  // owner(pid=1) 获取锁
  const lock = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 1, processExists: () => false, releaseForm: 'separate' });
  lock.acquire();
  assert.ok(fs.existsSync(lockFile));
  // 非 owner(pid=999) 尝试 release，不应删除
  const other = createFileRunLock({ lockFile, staleMs: 30 * 60 * 1000, pid: 999, processExists: () => false, releaseForm: 'separate' });
  other.release();
  assert.ok(fs.existsSync(lockFile), '非owner不应删除锁');
  // owner release 应删除
  lock.release();
  assert.ok(!fs.existsSync(lockFile), 'owner应删除锁');
});
