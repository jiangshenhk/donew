import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const router = Router();
const AGENT_DIR = join(homedir(), '.donew-agent');
const DASHBOARD_FILE = join(AGENT_DIR, 'dashboard.html');

// GET /api/agent/dashboard — Sell Put Agent 可视化仪表板
router.get('/api/agent/dashboard', (req, res) => {
  try {
    if (!existsSync(DASHBOARD_FILE)) {
      return res.status(404).json({ ok: false, message: 'dashboard.html 不存在，请先运行 agent' });
    }
    const html = readFileSync(DASHBOARD_FILE, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/agent/status — Sell Put Agent 数据状态摘要
router.get('/api/agent/status', (req, res) => {
  try {
    const out = { ok: true, dataDir: AGENT_DIR };
    const read = (name, fn) => {
      const f = join(AGENT_DIR, name);
      if (!existsSync(f)) return null;
      try { return fn ? fn(JSON.parse(readFileSync(f, 'utf-8'))) : null; } catch { return null; }
    };

    const positions = read('positions.json', (j) => Array.isArray(j) ? j : null);
    out.positions = {
      open: (positions || []).filter(p => p.status === 'open').length,
      closed: (positions || []).filter(p => p.status === 'closed').length,
      cancelled: (positions || []).filter(p => p.status === 'cancelled').length,
    };
    out.openPositions = (positions || []).filter(p => p.status === 'open').map(p => ({
      symbol: p.symbol, strike: p.strike, contracts: p.contracts,
      expireDate: p.expireDate, premium: p.premium, annualizedReturn: p.annualizedReturn,
    }));

    out.stats = read('stats.json', (j) => ({
      wins: j.wins, losses: j.losses, netPnL: j.netPnL,
      currentDrawdown: j.currentDrawdown, maxDrawdown: j.maxDrawdown,
      consecutiveLosses: j.consecutiveLosses,
    }));

    out.pool = read('pool.json', (j) => ({ trading: j.trading, watchlist: j.watchlist }));

    const journalDir = join(AGENT_DIR, 'journal');
    if (existsSync(journalDir)) {
      const files = readdirSync(journalDir).filter(f => f.endsWith('.json'));
      out.journalCount = files.length;
    }

    out.dashboard = {
      exists: existsSync(DASHBOARD_FILE),
      size: existsSync(DASHBOARD_FILE) ? Math.round(readFileSync(DASHBOARD_FILE, 'utf-8').length / 1024) + 'KB' : null,
    };
    res.json(out);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
