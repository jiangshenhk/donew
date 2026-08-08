// json-file.mjs — 共享 JSON 文件读写原语
// 通过配置保留三个机器人现有 loadJson/saveJson 行为差异
// 支持依赖注入（fsImpl），便于测试不触碰真实数据目录

import fs from 'node:fs';
import path from 'node:path';

// 读取 JSON 文件；文件不存在、损坏或解析失败时返回 fallback
export function readJson(filePath, { fsImpl = fs, fallback = null } = {}) {
  try {
    return JSON.parse(fsImpl.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

// 原子写入 JSON：临时文件 + rename 覆盖
// 配置：
//   fsImpl        注入文件系统（测试用）
//   indent        JSON 缩进（默认 2）
//   ensureParent  是否确保父目录存在（长线 false，短线/SellPut true）
//   tempPathFactory  生成临时文件路径；未提供时用默认（fpath.pid.timestamp.tmp）
export function writeJsonAtomic(filePath, value, {
  fsImpl = fs,
  indent = 2,
  ensureParent = false,
  tempPathFactory = null,
} = {}) {
  if (ensureParent) {
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const tmp = tempPathFactory
    ? tempPathFactory(filePath)
    : `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fsImpl.writeFileSync(tmp, JSON.stringify(value, null, indent), 'utf-8');
    fsImpl.renameSync(tmp, filePath);
  } finally {
    try { if (fsImpl.existsSync(tmp)) fsImpl.unlinkSync(tmp); } catch {}
  }
}

