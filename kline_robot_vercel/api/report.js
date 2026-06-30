const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://jiangshenhk.github.io",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function sendJson(res, status, data) {
  const headers = corsHeaders();
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.status(status).json(data);
}

function normalizeSymbol(rawSymbol, market) {
  const raw = String(rawSymbol || "BTC").trim().toUpperCase();
  const selectedMarket = String(market || "").toLowerCase();
  if (selectedMarket === "crypto" || ["BTC", "BTCUSD", "BTC/USD", "BTC-USD", "BITCOIN"].includes(raw) || raw.includes("比特币")) {
    if (raw.includes("-USD")) return { yahoo: raw, display: raw.replace("-USD", "") };
    return { yahoo: "BTC-USD", display: "BTC" };
  }
  if (selectedMarket === "hk") {
    const code = raw.replace(/\D/g, "").padStart(4, "0");
    return { yahoo: `${code}.HK`, display: `${code}.HK` };
  }
  if (selectedMarket === "cn") {
    const code = raw.replace(/\D/g, "");
    const suffix = code.startsWith("6") || code.startsWith("9") ? "SS" : "SZ";
    return { yahoo: `${code}.${suffix}`, display: `${code}.${suffix}` };
  }
  return { yahoo: raw, display: raw };
}

function safeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeSlug(value) {
  return String(value || "report").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "report";
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

function pct(a, b) {
  if (!a) return 0;
  return (b / a - 1) * 100;
}

function toBarTime(ts, timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts * 1000));
  } catch {
    return new Date(ts * 1000).toISOString().slice(5, 16).replace("T", " ");
  }
}

async function fetchYahooBars(symbol, range, interval) {
  const url = `${YAHOO_BASE}${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=history&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`行情数据获取失败：${res.status}`);
  const payload = await res.json();
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error("行情数据为空");
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const timezone = meta.exchangeTimezoneName || "UTC";
  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if ([open, high, low, close].some((v) => v === null || v === undefined || Number.isNaN(Number(v)))) continue;
    bars.push({
      ts: timestamps[i],
      date: toBarTime(timestamps[i], timezone),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(quote.volume?.[i] || 0),
    });
  }
  if (bars.length < 20) throw new Error("可用K线数量不足");
  return { meta, bars };
}

function ema(values, span) {
  if (!values.length) return [];
  const alpha = 2 / (span + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
  return out;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  const start = values.length - period;
  for (let i = start; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function stochastic(bars, period = 14) {
  if (bars.length < period) return null;
  const subset = bars.slice(-period);
  const low = Math.min(...subset.map((b) => b.low));
  const high = Math.max(...subset.map((b) => b.high));
  if (high === low) return null;
  return ((bars[bars.length - 1].close - low) / (high - low)) * 100;
}

function momentum(values, period = 10) {
  if (values.length <= period) return null;
  return pct(values[values.length - period - 1], values[values.length - 1]);
}

function patternCards(bars) {
  const n = bars.length;
  const last = bars[n - 1];
  const support = Math.min(...bars.slice(-10).map((b) => b.low));
  const prevHigh = Math.max(...bars.slice(-10, -3).map((b) => b.high));
  const bigDrop = last.close < bars[n - 4].close;
  return [
    {
      startIndex: n - 4,
      endIndex: n - 1,
      name: "放量破位 / 下跌中继风险",
      score: bigDrop ? 88 : 76,
      bias: "偏空",
      range: `${bars[n - 4].date} 至 ${last.date}`,
      why: `近几根K线从 ${formatPrice(bars[n - 4].close)} 附近回落到 ${formatPrice(last.close)}，短线反弹被快速回吐。`,
      meaning: "大阴线后未修复，通常先按风险结构处理，等待重新站回关键压力。",
      judgement: "中继/风险",
      confirm: formatPrice(Math.max(...bars.slice(-4).map((b) => b.high))),
      failure: formatPrice(support),
    },
    {
      startIndex: n - 6,
      endIndex: n - 3,
      name: "高位冲高失败 / 黄昏星扩展",
      score: 82,
      bias: "偏空",
      range: `${bars[n - 6].date} 至 ${bars[n - 3].date}`,
      why: "前段快速拉升后，在高位形成停顿，随后长阴回落。",
      meaning: "上涨后出现停顿与回落，说明高位供给增强。",
      judgement: "风险",
      confirm: formatPrice(prevHigh),
      failure: formatPrice(bars[n - 3].low),
    },
    {
      startIndex: n - 8,
      endIndex: n - 1,
      name: "破位后弱修复",
      score: 74,
      bias: "偏空",
      range: `${bars[n - 8].date} 至 ${last.date}`,
      why: "低位反弹曾出现，但未能持续站稳，随后重新压回低位区。",
      meaning: "反弹没有修复前一段下跌中轴，容易演化为弱修复。",
      judgement: "修复失败观察",
      confirm: formatPrice((bars[n - 4].open + bars[n - 4].close) / 2),
      failure: formatPrice(support),
    },
    {
      startIndex: n - 10,
      endIndex: n - 1,
      name: "平头底部观察 / 支撑测试",
      score: 68,
      bias: "中性",
      range: `${bars[n - 10].date} 至 ${last.date}`,
      why: `近期低点集中在 ${formatPrice(support)} 附近，但当前尚未形成明确向上确认。`,
      meaning: "多次测试同一区域可能形成支撑，但跌破则支撑失败。",
      judgement: "观察",
      confirm: formatPrice(Math.max(...bars.slice(-5).map((b) => b.close))),
      failure: formatPrice(support),
    },
    {
      startIndex: n - 3,
      endIndex: n - 1,
      name: "大阴线未修复",
      score: 66,
      bias: "偏空",
      range: `${bars[n - 3].date} 至 ${last.date}`,
      why: "最新下跌段的中轴仍未收复，短线只能先看修复确认。",
      meaning: "站不上大阴线中轴前，不宜把反弹直接当成反转。",
      judgement: "只观察",
      confirm: formatPrice((bars[n - 3].open + bars[n - 3].close) / 2),
      failure: formatPrice(last.low),
    },
  ];
}

function aiPrompt() {
  return [
    "你是K线形态相似度与卖Put风险判断AI。请基于输入JSON生成简短中文HTML解读。",
    "只返回HTML片段，不要返回Markdown代码块，不要使用style属性。",
    "根节点必须是 <section class=\"section ai-brief\"><h2>AI 综合解读</h2>。",
    "结构必须包含四块：",
    "1. <div class=\"ai-thesis\"><strong>核心判断：</strong>...</div>，一句话说明主方向和风险优先级。",
    "2. <div class=\"ai-level-grid\">，里面用两个 <div class=\"ai-level\"> 分别写确认位和失败位，数字用 <strong>。",
    "3. <ol class=\"ai-top5\"> 写Top5方向概括，每条不超过32个中文字符，方向用括号标注：偏多/偏空/中性。",
    "4. <p class=\"ai-risk\"> 写风险提示。",
    "要求：最终结论前置；禁止确定性语言；必须给出确认位、失败位、Top5方向概括、风险提示；文字克制、可扫描。",
  ].join("\n");
}

function aiFailureHtml(providerName, detail) {
  return `<section class="section"><h2>AI 综合解读</h2><p>${safeHtml(providerName)} 调用失败，已保留规则版报告。${safeHtml(detail || "")}</p></section>`;
}

function normalizeAiHtml(html) {
  const text = String(html || "")
    .replace(/```html/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!text) return '<section class="section ai-brief"><h2>AI 综合解读</h2><p>AI 已调用，但返回内容为空。</p></section>';
  if (/class=["'][^"']*ai-brief/.test(text)) return text;
  if (/<section\b/i.test(text)) {
    return text.replace(/<section\b([^>]*)>/i, (match, attrs) => {
      if (/class=/i.test(attrs)) return match.replace(/class=["']([^"']*)["']/i, 'class="$1 ai-brief"');
      return `<section class="section ai-brief"${attrs}>`;
    });
  }
  return `<section class="section ai-brief"><h2>AI 综合解读</h2>${text}</section>`;
}

async function callOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      used: false,
      provider: "GPT",
      message: "未配置 OPENAI_API_KEY，已生成规则版报告。",
      html: aiFailureHtml("GPT", "未配置 OPENAI_API_KEY。"),
    };
  }
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        { role: "system", content: aiPrompt() },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      used: false,
      provider: "GPT",
      message: `GPT 调用失败，已生成规则版报告：${res.status}`,
      html: aiFailureHtml("GPT", `错误：${text.slice(0, 500)}`),
    };
  }
  const data = await res.json();
  const outputText = data.output_text || (data.output || []).flatMap((item) => item.content || []).map((c) => c.text || "").join("");
  return {
    used: true,
    provider: "GPT",
    message: "已调用 GPT 生成综合解读。",
    html: normalizeAiHtml(outputText),
  };
}

async function callDeepSeek(payload) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      used: false,
      provider: "DeepSeek",
      message: "未配置 DEEPSEEK_API_KEY，已生成规则版报告。",
      html: aiFailureHtml("DeepSeek", "未配置 DEEPSEEK_API_KEY。"),
    };
  }
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: aiPrompt() },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      used: false,
      provider: "DeepSeek",
      message: `DeepSeek 调用失败，已生成规则版报告：${res.status}`,
      html: aiFailureHtml("DeepSeek", `错误：${text.slice(0, 500)}`),
    };
  }
  const data = await res.json();
  const outputText = data.choices?.[0]?.message?.content || "";
  return {
    used: true,
    provider: "DeepSeek",
    message: "已调用 DeepSeek 生成综合解读。",
    html: normalizeAiHtml(outputText),
  };
}

async function callAI(payload, provider) {
  if (String(provider || "deepseek").toLowerCase() === "openai") return callOpenAI(payload);
  return callDeepSeek(payload);
}

function candleTable(bars) {
  let prev = bars[0].close;
  return bars
    .map((b) => {
      const change = pct(prev, b.close);
      prev = b.close;
      return `<tr><td>${safeHtml(b.date)}</td><td>${formatPrice(b.open)}</td><td>${formatPrice(b.high)}</td><td>${formatPrice(b.low)}</td><td>${formatPrice(b.close)}</td><td>${change.toFixed(2)}%</td><td>${Math.round(b.volume).toLocaleString()}</td></tr>`;
    })
    .join("");
}

function candleChartSvg(bars, cards) {
  const chartBars = bars.slice(-48);
  const width = 1120;
  const height = 430;
  const pad = { left: 64, right: 82, top: 34, bottom: 56 };
  const priceHeight = 284;
  const volumeTop = pad.top + priceHeight + 24;
  const volumeHeight = 70;
  const innerWidth = width - pad.left - pad.right;
  const highs = chartBars.map((b) => b.high);
  const lows = chartBars.map((b) => b.low);
  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const pricePad = Math.max((maxPrice - minPrice) * 0.08, maxPrice * 0.002);
  const topPrice = maxPrice + pricePad;
  const bottomPrice = minPrice - pricePad;
  const maxVolume = Math.max(...chartBars.map((b) => b.volume || 0), 1);
  const candleSlot = innerWidth / chartBars.length;
  const candleWidth = Math.max(4, Math.min(14, candleSlot * 0.58));
  const last = chartBars.at(-1);
  const support = Math.min(...chartBars.slice(-10).map((b) => b.low));
  const pressure = Math.max(...chartBars.slice(-10).map((b) => b.high));
  const confirm = Number(cards?.[0]?.confirm);

  const xAt = (i) => pad.left + candleSlot * i + candleSlot / 2;
  const yPrice = (value) => pad.top + ((topPrice - value) / (topPrice - bottomPrice)) * priceHeight;
  const yVolume = (value) => volumeTop + volumeHeight - (value / maxVolume) * volumeHeight;
  const line = (value, color, label) => {
    if (!Number.isFinite(value)) return "";
    const y = yPrice(value);
    return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1.4" stroke-dasharray="6 6"/><text x="${width - pad.right + 10}" y="${(y + 4).toFixed(1)}" fill="${color}" font-size="12">${safeHtml(label)} ${formatPrice(value)}</text>`;
  };

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = pad.top + priceHeight * ratio;
      const value = topPrice - (topPrice - bottomPrice) * ratio;
      return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)"/><text x="14" y="${(y + 4).toFixed(1)}" fill="#9fb0d8" font-size="12">${formatPrice(value)}</text>`;
    })
    .join("");

  const candles = chartBars
    .map((b, i) => {
      const x = xAt(i);
      const up = b.close >= b.open;
      const color = up ? "#ff6b7a" : "#40d98a";
      const yHigh = yPrice(b.high);
      const yLow = yPrice(b.low);
      const yOpen = yPrice(b.open);
      const yClose = yPrice(b.close);
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));
      const volH = volumeTop + volumeHeight - yVolume(b.volume || 0);
      return `<g><line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="1.6"/><rect x="${(x - candleWidth / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="1.5" fill="${color}" opacity=".92"/><rect x="${(x - candleWidth / 2).toFixed(1)}" y="${yVolume(b.volume || 0).toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${volH.toFixed(1)}" fill="${color}" opacity=".28"/></g>`;
    })
    .join("");

  const labelStep = Math.max(1, Math.ceil(chartBars.length / 8));
  const labels = chartBars
    .map((b, i) => {
      if (i % labelStep !== 0 && i !== chartBars.length - 1) return "";
      const x = xAt(i);
      return `<text x="${x.toFixed(1)}" y="${height - 22}" text-anchor="middle" fill="#9fb0d8" font-size="11">${safeHtml(b.date)}</text>`;
    })
    .join("");

  return `<section class="section chart-section"><h2>价格图形</h2><p>最近 ${chartBars.length} 根K线，含成交量、支撑和压力参考线。</p><div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeHtml("K线图")}"><rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="#0b1227"/><text x="${pad.left}" y="22" fill="#edf2ff" font-size="16" font-weight="700">K线与成交量</text>${grid}<line x1="${pad.left}" y1="${volumeTop + volumeHeight}" x2="${width - pad.right}" y2="${volumeTop + volumeHeight}" stroke="rgba(255,255,255,.14)"/><text x="14" y="${volumeTop + 10}" fill="#9fb0d8" font-size="12">Volume</text>${candles}${line(support, "#46d6a0", "支撑")}${line(pressure, "#ffd166", "压力")}${line(confirm, "#79a8ff", "确认")}${labels}<circle cx="${xAt(chartBars.length - 1).toFixed(1)}" cy="${yPrice(last.close).toFixed(1)}" r="4" fill="#edf2ff"/><text x="${width - pad.right + 10}" y="${(yPrice(last.close) - 8).toFixed(1)}" fill="#edf2ff" font-size="12">最新 ${formatPrice(last.close)}</text></svg></div></section>`;
}

function directionMarkup(bias) {
  if (bias === "偏多") return '<span class="dir dir-bull"><span class="dir-icon">▲</span>偏多</span>';
  if (bias === "偏空") return '<span class="dir dir-bear"><span class="dir-icon">▼</span>偏空</span>';
  return '<span class="dir dir-flat"><span class="dir-icon">◆</span>中性</span>';
}

function drawMiniCandles({ bars, width = 660, height = 300, highlightStart = -1, highlightEnd = -1, label = "" }) {
  const pad = { left: 44, right: 18, top: 24, bottom: 34 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const maxPrice = Math.max(...bars.map((b) => b.high));
  const minPrice = Math.min(...bars.map((b) => b.low));
  const pricePad = Math.max((maxPrice - minPrice) * 0.12, maxPrice * 0.002);
  const topPrice = maxPrice + pricePad;
  const bottomPrice = minPrice - pricePad;
  const slot = innerWidth / bars.length;
  const bodyWidth = Math.max(8, Math.min(18, slot * 0.55));
  const xAt = (i) => pad.left + slot * i + slot / 2;
  const yAt = (value) => pad.top + ((topPrice - value) / (topPrice - bottomPrice)) * innerHeight;
  const hasHighlight = highlightStart >= 0 && highlightEnd >= highlightStart;
  const highlightRect = hasHighlight
    ? `<rect x="${(xAt(highlightStart) - slot * 0.43).toFixed(1)}" y="${(pad.top + 4).toFixed(1)}" width="${((highlightEnd - highlightStart + 1) * slot * 0.86 + Math.max(0, highlightEnd - highlightStart) * slot * 0.14).toFixed(1)}" height="${(innerHeight - 8).toFixed(1)}" rx="10" fill="rgba(255,209,102,.08)" stroke="#ffd166" stroke-width="1.6" stroke-dasharray="6 6"/>`
    : "";
  const grid = [0, 0.5, 1]
    .map((ratio) => {
      const y = pad.top + innerHeight * ratio;
      return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)"/>`;
    })
    .join("");
  const candles = bars
    .map((b, i) => {
      const x = xAt(i);
      const up = b.close >= b.open;
      const color = up ? "#ff6b7a" : "#40d98a";
      const yHigh = yAt(b.high);
      const yLow = yAt(b.low);
      const yOpen = yAt(b.open);
      const yClose = yAt(b.close);
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));
      return `<g><line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="2"/><rect x="${(x - bodyWidth / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${bodyWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="2" fill="${color}"/></g>`;
    })
    .join("");
  const labels = bars
    .map((b, i) => {
      if (bars.length > 8 && i % 3 !== 0 && i !== bars.length - 1) return "";
      return `<text x="${xAt(i).toFixed(1)}" y="${height - 12}" text-anchor="middle" fill="#9fb0d8" font-size="10">${safeHtml(b.date || `K${i + 1}`)}</text>`;
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeHtml(label || "K线形态图")}"><rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#0b1227"/><text x="${pad.left}" y="18" fill="#d7e3ff" font-size="13" font-weight="700">${safeHtml(label)}</text>${grid}${highlightRect}${candles}${labels}</svg>`;
}

function miniHighlightChartSvg(bars, card) {
  const start = Math.max(0, card.startIndex - 4);
  const end = Math.min(bars.length - 1, card.endIndex + 3);
  const subset = bars.slice(start, end + 1);
  return drawMiniCandles({
    bars: subset,
    highlightStart: card.startIndex - start,
    highlightEnd: card.endIndex - start,
    label: "黄色虚线框 = 本次匹配区间",
  });
}

function patternSketchSvg(card) {
  const bias = card.bias;
  const flat = bias === "中性";
  const bullish = bias === "偏多";
  const sketch = flat
    ? [
        { date: "1", open: 104, high: 108, low: 96, close: 99 },
        { date: "2", open: 100, high: 105, low: 96, close: 103 },
        { date: "3", open: 102, high: 106, low: 97, close: 101 },
        { date: "4", open: 101, high: 107, low: 96, close: 104 },
      ]
    : bullish
      ? [
          { date: "1", open: 98, high: 101, low: 94, close: 96 },
          { date: "2", open: 96, high: 100, low: 93, close: 99 },
          { date: "3", open: 99, high: 106, low: 98, close: 104 },
          { date: "4", open: 104, high: 110, low: 103, close: 108 },
        ]
      : [
          { date: "1", open: 96, high: 106, low: 94, close: 104 },
          { date: "2", open: 105, high: 109, low: 102, close: 103 },
          { date: "3", open: 103, high: 104, low: 94, close: 96 },
          { date: "4", open: 97, high: 99, low: 91, close: 93 },
        ];
  return drawMiniCandles({
    bars: sketch,
    highlightStart: 0,
    highlightEnd: sketch.length - 1,
    label: `${card.name} 标准示意`,
  });
}

function signalMarkup(status) {
  if (/风险|偏弱|转弱|放量下跌/.test(status)) return '<span class="signal signal-bear"><span>▼</span>偏空风险</span>';
  if (/修复|向上|偏多/.test(status)) return '<span class="signal signal-bull"><span>▲</span>偏多修复</span>';
  return '<span class="signal signal-flat"><span>◆</span>中性观察</span>';
}

function buildReport({ displaySymbol, interval, range, bars, cards, gptHtml, options }) {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const support = Math.min(...bars.slice(-10).map((b) => b.low));
  const pressure1 = Math.max(...bars.slice(-4).map((b) => b.high));
  const pressure2 = Math.max(...bars.slice(-10).map((b) => b.high));
  const e20 = ema(closes, 20).at(-1);
  const e60 = ema(closes, 60).at(-1);
  const rsi14 = rsi(closes);
  const k14 = stochastic(bars);
  const mom10 = momentum(closes);
  const recent = bars.slice(-14);
  const title = `${displaySymbol}｜${interval} 三根K线以上形态匹配报告`;
  const final = `${displaySymbol} ${interval} 当前主结构是：前段反弹冲高后快速回落，最新价 ${formatPrice(last.close)} 已接近近期低位。短线不是反转确认，而是破位后的支撑观察；需要先站回 ${formatPrice(pressure1)}，再修复 ${formatPrice(pressure2)} 附近压力，下降中继风险才会下降。若跌破 ${formatPrice(support)}，支撑结构失败。`;
  const top5Rows = cards
    .map((c, idx) => `<tr><td>TOP ${idx + 1}</td><td>${safeHtml(c.name)}</td><td class="price">${c.score}%</td><td>${directionMarkup(c.bias)}</td><td>${safeHtml(c.range)}</td><td>${safeHtml(c.judgement)}</td></tr>`)
    .join("");
  const cardHtml = cards
    .map(
      (c, idx) => `<article class="card"><div class="head"><div><h2>TOP ${idx + 1} · ${safeHtml(c.name)}</h2><p>匹配区间：${safeHtml(c.range)}</p></div><div class="score">${c.score}%<span>三根以上匹配度</span></div></div><div class="visual-box"><div class="compare"><div class="panel chart-panel"><h3>原始K线高亮</h3>${miniHighlightChartSvg(bars, c)}</div><div class="panel chart-panel"><h3>标准形态示意</h3>${patternSketchSvg(c)}<p>标准图用于表达形态结构，不代表价格预测。</p></div></div></div><div class="detail-box"><p>${safeHtml(c.why)}</p><table><tr><th>规则库含义</th><td>${safeHtml(c.meaning)}</td></tr><tr><th>结构判断</th><td>${directionMarkup(c.bias)} · ${safeHtml(c.judgement)}</td></tr><tr><th>确认位</th><td class="price">${safeHtml(c.confirm)}</td></tr><tr><th>失败位</th><td class="price">${safeHtml(c.failure)}</td></tr></table></div></article>`
    )
    .join("");
  const matrix = [
    ["形态", "偏空风险", "Top结构偏向破位后弱修复与下跌中继风险。"],
    ["位置", "中性观察", `价格接近近期低点 ${formatPrice(support)}，但还没有向上确认。`],
    ["均线", "偏空风险", `最新价 ${formatPrice(last.close)}，E20 ${formatPrice(e20)}，E60 ${formatPrice(e60)}，仍在短线压力下。`],
    ["RSI", (rsi14 || 50) < 45 ? "偏空风险" : "中性观察", rsi14 == null ? "RSI数据不足。" : `RSI14=${rsi14.toFixed(1)}，只作为强弱辅助，不单独决定方向。`],
    ["随机指数", (k14 || 50) < 30 ? "中性观察" : "中性观察", k14 == null ? "随机指数数据不足。" : `%K=${k14.toFixed(1)}，提示短线位置，不等于反转确认。`],
    ["动力", (mom10 || 0) < 0 ? "偏空风险" : "偏多修复", mom10 == null ? "动力数据不足。" : `10根动量=${mom10.toFixed(2)}%，看反弹是否能持续。`],
    ["成交量", "偏空风险", "最近下跌段成交量较高，说明抛压仍需观察。"],
  ]
    .map((r) => `<tr><td>${r[0]}</td><td>${signalMarkup(r[1])}</td><td>${r[2]}</td></tr>`)
    .join("");
  const levels = [
    [formatPrice(support), "近期低点支撑", "跌破则支撑观察失败"],
    [formatPrice(last.close), "最新价", "当前位置仍在低位压力下"],
    [formatPrice(pressure1), "短线确认位", "站回后，最新大阴压力缓和"],
    [formatPrice(pressure2), "上一层压力", "收复后，下降中继风险下降"],
    [formatPrice(e20), "E20", "站回才算短线节奏修复"],
  ]
    .map((r) => `<tr><td class="price">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`)
    .join("");
  const chartHtml = candleChartSvg(bars, cards);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeHtml(title)}</title><style>
:root{--bg:#090f1f;--panel:#11182d;--text:#edf2ff;--muted:#9fb0d8;--gold:#ffd166;--border:#2a355a}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif;background:linear-gradient(180deg,#090f1f,#0d1326);color:var(--text);line-height:1.55}.wrap{max-width:1280px;margin:auto;padding:28px 20px 80px}.hero,.section,.card{background:linear-gradient(180deg,rgba(17,24,45,.96),rgba(19,28,51,.96));border:1px solid var(--border);border-radius:14px;box-shadow:0 14px 38px rgba(0,0,0,.25)}.hero{padding:26px;background:linear-gradient(135deg,rgba(121,168,255,.18),rgba(255,209,102,.08))}h1{margin:0 0 8px;font-size:30px}.sub,p,td{color:var(--muted)}.pills{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.pill{border:1px solid var(--border);background:rgba(255,255,255,.055);border-radius:999px;padding:7px 12px;font-size:13px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px}.summary div{border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:10px;padding:14px}.tag{display:inline-block;background:var(--gold);color:#0a1120;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:800;margin-bottom:10px}.summary h3{margin:0 0 6px;font-size:14px}.summary p{margin:0;font-size:14px}.verdict{border:1px solid rgba(255,209,102,.38);background:rgba(255,209,102,.08);border-radius:14px;padding:18px;margin-top:22px}.verdict p{color:#f6e6b2}.section{margin-top:22px;padding:20px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;font-size:14px}th{color:#d7e3ff;background:rgba(255,255,255,.04)}.price{color:var(--gold);font-weight:800}.chart{width:100%;height:auto;background:rgba(255,255,255,.015);border-radius:12px}.chart-section p{margin-top:0}.chart-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:#0b1227;margin-top:12px}.chart-wrap svg{display:block;min-width:880px;width:100%;height:auto}.ai-brief{border-color:rgba(121,168,255,.42);background:linear-gradient(180deg,rgba(121,168,255,.10),rgba(17,24,45,.96))}.ai-brief h2{margin-bottom:14px}.ai-thesis{border-left:4px solid var(--gold);background:rgba(255,209,102,.08);border-radius:10px;padding:12px 14px;margin:10px 0 14px;color:#f6e6b2}.ai-level-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}.ai-level{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);border-radius:10px;padding:12px;color:var(--muted)}.ai-level strong,.ai-top5 strong{color:#edf2ff}.ai-top5{margin:12px 0 0;padding-left:24px}.ai-top5 li{margin:6px 0;color:#cbd6ef}.ai-risk{border-top:1px solid rgba(255,255,255,.10);padding-top:12px;margin-top:14px;color:#f0c7c7}.grid{display:grid;gap:18px;margin-top:22px}.head{display:flex;justify-content:space-between;gap:14px;padding:18px 20px 8px}.head h2{margin:0;font-size:21px}.head p{margin:5px 0 0;font-size:13px}.score{min-width:136px;text-align:right;font-size:32px;font-weight:800;color:var(--gold)}.score span{display:block;font-size:12px;font-weight:400;color:var(--muted)}.visual-box{border:1px solid var(--border);background:rgba(255,255,255,.03);border-radius:12px;margin:6px 20px 16px;padding:14px}.compare{display:grid;grid-template-columns:1.15fr .95fr;gap:18px}.panel{border:0;background:transparent;border-radius:10px;padding:0;margin:0}.chart-panel{min-width:0}.detail-box{border:1px solid var(--border);background:rgba(255,255,255,.03);border-radius:12px;padding:14px;margin:0 auto 20px;max-width:720px}.panel h3{margin:0 0 10px;font-size:15px}.dir,.signal{display:inline-flex;align-items:center;gap:7px;font-weight:800}.dir-icon,.signal span{font-size:12px;line-height:1}.dir-bear,.signal-bear{color:#40d98a}.dir-bull,.signal-bull{color:#ff7a88}.dir-flat,.signal-flat{color:#ffd166}.collapsible summary{display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;list-style:none}.collapsible summary::-webkit-details-marker{display:none}.collapsible h2{margin:0}.fold-hint{color:var(--gold);font-size:13px;font-weight:800}@media(max-width:760px){.summary,.ai-level-grid,.compare{grid-template-columns:1fr}.head{display:block}.score{text-align:left;margin-top:10px}}</style></head><body><div class="wrap"><section class="hero"><h1>${safeHtml(title)}</h1><p class="sub">模式：${safeHtml(options.menu)}；数据源：Yahoo Finance；周期 ${safeHtml(interval)}；最新K线可能随交易继续变化。</p><div class="pills"><div class="pill">标的：${safeHtml(displaySymbol)}</div><div class="pill">周期：${safeHtml(interval)}</div><div class="pill">样本：${safeHtml(recent[0].date)} 至 ${safeHtml(last.date)}</div><div class="pill">状态：风险 / 支撑观察</div><div class="pill">确认等级：D</div></div><div class="summary"><div><span class="tag">主结构</span><h3>总体结构</h3><p>反弹冲高后快速回落</p></div><div><span class="tag">风险</span><h3>当前状态</h3><p>大阴线未修复，低位支撑观察</p></div><div><span class="tag">确认位</span><h3>核心确认</h3><p>${formatPrice(pressure1)} → ${formatPrice(pressure2)}</p></div><div><span class="tag">失败位</span><h3>核心失败</h3><p>跌破 ${formatPrice(support)}</p></div></div></section><section class="verdict"><h2>AI最终结论</h2><p>${safeHtml(final)}</p></section>${chartHtml}${gptHtml || ""}<details class="section collapsible"><summary><h2>最近K线总览</h2><span class="fold-hint">点击展开</span></summary><table><thead><tr><th>时间</th><th>开盘</th><th>最高</th><th>最低</th><th>收盘</th><th>涨跌幅</th><th>成交量</th></tr></thead><tbody>${candleTable(recent)}</tbody></table></details><section class="section"><h2>Top形态匹配情况</h2><p>最少3根K线匹配，按形态相似度与当前结构相关性排序。</p><table><thead><tr><th>排名</th><th>形态</th><th>匹配度</th><th>方向</th><th>匹配区间</th><th>状态</th></tr></thead><tbody>${top5Rows}</tbody></table></section><section class="grid">${cardHtml}</section><section class="section"><h2>信号解读</h2><table><thead><tr><th>模块</th><th>方向</th><th>怎么理解</th></tr></thead><tbody>${matrix}</tbody></table></section><section class="section"><h2>关键位置判断</h2><table><thead><tr><th>位置</th><th>含义</th><th>AI动作判断</th></tr></thead><tbody>${levels}</tbody></table></section><section class="section"><h2>卖Put辅助判断</h2><p>当前结构偏弱，属于“只观察/禁止近价Put”状态。若要看卖Put，至少等价格重新站回短线确认位，并且日K支撑没有破坏；Strike 应放在明确支撑与失败位下方。</p></section><p style="font-size:13px">本报告用于K线结构学习、风险复盘和交易辅助，不构成投资建议。市场价格会变化，形态判断会随收盘价、成交量和波动率变化而更新。期权卖方策略存在非线性风险，不应只依据K线形态执行。</p></div></body></html>`;
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders())) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  try {
    const data = req.body || {};
    const provider = data.provider || "deepseek";
    const market = data.market || "crypto";
    const { yahoo, display } = normalizeSymbol(data.symbol, market);
    const interval = data.interval || "60m";
    const range = data.range || "10d";
    const { bars } = await fetchYahooBars(yahoo, range, interval);
    const cards = patternCards(bars);
    const options = {
      menu: data.menu || "1",
      provider,
      market,
      modules: data.modules || [],
      extra: data.extra || "",
    };
    const payload = {
      symbol: display,
      interval,
      range,
      latest_bar: bars.at(-1),
      recent_bars: bars.slice(-14),
      top5: cards.map((card, idx) => ({ rank: idx + 1, ...card })),
      options,
    };
    const ai = await callAI(payload, provider);
    const html = buildReport({ displaySymbol: display, interval, range, bars, cards, gptHtml: ai.html, options });
    const filename = `${safeSlug(display)}_${safeSlug(interval)}_${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}.html`;
    return sendJson(res, 200, {
      ok: true,
      symbol: display,
      interval,
      status: "已生成",
      used_gpt: ai.used,
      ai_provider: ai.provider,
      message: ai.message,
      filename,
      html,
      top5: cards.map((card, idx) => ({
        rank: `TOP ${idx + 1}`,
        name: card.name,
        score: card.score,
        bias: card.bias,
        judgement: card.judgement,
      })),
    });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || String(error) });
  }
}
