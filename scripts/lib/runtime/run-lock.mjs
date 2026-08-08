// run-lock.mjs — 文件运行锁（可配置差异）
// 通过显式配置保留三个机器人现有锁行为差异

import fs from 'node:fs';

// 默认进程存活检查：EPERM 视为存活（进程存在但无权限）
export function defaultProcessExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function createFileRunLock({
  lockFile,
  staleMs,
  startedAtFormat = 'iso', // 'iso' | 'epoch-ms'
  startedAtFallback = 'zero', // 'mtime' | 'zero'：startedAt 缺失/无效时的年龄基准
  pid = process.pid,
  processExists = defaultProcessExists,
  isStale = null,          // 自定义 stale 判断(existing, alive, age, staleMs) => boolean
  busyAction = 'return-null', // 'return-null' | 'throw'
  releaseForm = 'callback',   // 'callback' | 'separate'
  lockContent = null,         // 额外字段（如 mode）
  loadJson = null,            // 可选 JSON 读取器
  fsImpl = fs,               // 可注入文件系统依赖（测试用）
  removeUnreadableOnRelease = true, // release 时损坏锁是否删除
}) {
  const readLock = () => {
    try {
      if (loadJson) return loadJson(lockFile);
      return JSON.parse(fsImpl.readFileSync(lockFile, 'utf-8'));
    } catch {
      return null;
    }
  };

  // 计算锁年龄基准：startedAt 无效时按配置回退
  const startedAtMs = (existing) => {
    let ms = startedAtFormat === 'epoch-ms'
      ? Number(existing.startedAt) || 0
      : Date.parse(existing.startedAt) || 0;
    if (!ms && startedAtFallback === 'mtime') {
      try { ms = fsImpl.statSync(lockFile).mtimeMs; } catch {}
    }
    return ms || 0;
  };

  const writeLock = (fd, extra) => {
    const startedAt = startedAtFormat === 'epoch-ms' ? Date.now() : new Date().toISOString();
    const content = { pid, startedAt, ...(extra || {}) };
    fsImpl.writeFileSync(fd, JSON.stringify(content));
  };

  const create = (extra) => {
    let fd = null;
    try {
      fd = fsImpl.openSync(lockFile, 'wx');
      writeLock(fd, extra);
      fsImpl.closeSync(fd);
      fd = null;
    } catch (error) {
      // 只清理本进程成功创建但写入失败的锁；EEXIST(锁已存在)不删除
      if (fd !== null) {
        try { fsImpl.closeSync(fd); } catch {}
        try { fsImpl.unlinkSync(lockFile); } catch {}
        error.runLockPhase = 'write'; // 标记：本进程创建但写入失败
      }
      throw error;
    }
  };

  const removeIfOwned = () => {
    try {
      const current = readLock();
      if (current === null) {
        // 读取失败（损坏锁）
        if (removeUnreadableOnRelease) { try { fsImpl.unlinkSync(lockFile); } catch {} }
        return;
      }
      if (!current || Number(current.pid) === pid) fsImpl.unlinkSync(lockFile);
    } catch {}
  };

  const acquire = (extra) => {
    try {
      create(extra || lockContent || undefined);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const existing = readLock() || {};
      const startedMs = startedAtMs(existing);
      const age = Date.now() - startedMs;
      const liveProcess = processExists(Number(existing.pid));
      const busy = isStale
        ? !isStale(existing, liveProcess, age, staleMs)
        : (liveProcess || (!existing.pid && age <= staleMs));
      if (busy) {
        if (busyAction === 'throw') {
          throw new Error(`已有任务运行中 (pid=${existing.pid || '?'}, startedAt=${existing.startedAt || '?'}, ${Math.floor(age / 1000)}s前)`);
        }
        return null;
      }
      // 过期锁：删除后重试一次
      try { fsImpl.unlinkSync(lockFile); } catch {}
      try {
        create(extra || lockContent || undefined);
      } catch (e2) {
        if (e2.code === 'EEXIST') throw new Error('锁竞争：另一进程正在获取锁，本次退出');
        throw e2;
      }
    }
    if (releaseForm === 'callback') return () => removeIfOwned();
    return true;
  };

  return {
    acquire,
    release: releaseForm === 'separate' ? removeIfOwned : null,
  };
}
