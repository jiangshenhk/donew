import legacyHandler from './market-report_old.js';

function riskFromSellPut(value) {
  const text = String(value || '');
  if (text.includes('❌')) return '🔴';
  if (text.includes('✅')) return '🟢';
  return '🟡';
}

function blackSwanFor(asset, eventRisk, sellPut) {
  const name = String(asset || '').replace(/\*/g, '').trim().toUpperCase();
  if (name.includes('MSTR') || name === 'BTC') return '🔴';
  if (name.includes('INTC')) return '🟡';
  const event = String(eventRisk || '');
  if (/高|红|严重|逆风|🔴/.test(event)) return '🔴';
  if (/低|绿|顺风|🟢/.test(event) && !String(sellPut || '').includes('❌')) return '🟢';
  return '🟡';
}

function splitRow(line) {
  return String(line).trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function joinRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

function enforceStrategyMatrix(markdown, report = {}) {
  const lines = String(markdown || '').split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    const header = splitRow(lines[i]);
    const normalized = header.map(cell => cell.replace(/\s+/g, '').toUpperCase());
    const isOldHeader = normalized.length === 4
      && normalized[0].includes('资产')
      && normalized[1].includes('买CALL')
      && normalized[2].includes('卖PUT')
      && normalized[3].includes('核心逻辑');
    const isPartialHeader = normalized.length === 5
      && normalized[0].includes('资产')
      && normalized[1].includes('买CALL')
      && normalized.includes('卖PUT')
      && normalized.at(-1).includes('核心逻辑');

    if (!isOldHeader && !isPartialHeader) continue;

    lines[i] = '| 资产 | 买CALL | 大跌风险 | 黑天鹅灯号 | 卖PUT | 核心逻辑 |';
    if (i + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[i + 1])) {
      lines[i + 1] = '|:---|:---:|:---:|:---:|:---:|:---|';
    }

    for (let j = i + 2; j < lines.length; j += 1) {
      if (!/^\s*\|/.test(lines[j])) break;
      const cells = splitRow(lines[j]);
      if (cells.length < 4) break;
      const asset = cells[0];
      const buyCall = cells[1];
      const sellPut = isOldHeader ? cells[2] : cells.at(-2);
      const logic = cells.at(-1);
      const downRisk = riskFromSellPut(sellPut);
      const blackSwan = blackSwanFor(asset, report.eventRisk, sellPut);
      lines[j] = joinRow([asset, buyCall, downRisk, blackSwan, sellPut, logic]);
    }
    changed = true;
    break;
  }

  if (!changed && !String(markdown || '').includes('黑天鹅灯号')) {
    throw new Error('策略矩阵未找到可升级的表头，已拒绝返回旧格式报告');
  }
  return lines.join('\n');
}

function captureResponse() {
  let statusCode = 200;
  let payload;
  const headers = new Map();
  return {
    setHeader(name, value) { headers.set(name, value); },
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; },
    end() { return this; },
    get result() { return { statusCode, payload, headers }; },
  };
}

export default async function handler(req, res) {
  const captured = captureResponse();
  await legacyHandler(req, captured);
  const { statusCode, payload, headers } = captured.result;
  for (const [name, value] of headers.entries()) res.setHeader(name, value);

  if (statusCode >= 400 || !payload?.ok || !payload?.report?.markdown) {
    return res.status(statusCode).json(payload || { ok: false, message: '旧版市场报告接口未返回有效数据' });
  }

  try {
    payload.report.markdown = enforceStrategyMatrix(payload.report.markdown, payload.report);
    payload.report.schemaVersion = 'strategy-matrix-v2';
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || String(error) });
  }
}
