const EVENT_PATTERNS = [
  { re: /财报|业绩|earning|季报|年报|指引/i, label: "财报" },
  { re: /FOMC|美联储|利率决议|加息|降息/i, label: "美联储" },
  { re: /非农|NFP|就业报告|ADP/i, label: "就业数据" },
  { re: /\bCPI\b|\bPPI\b|\bPCE\b|通胀数据/i, label: "通胀数据" },
  { re: /\bGDP\b|经济增长/i, label: "GDP" },
  { re: /OPEC|原油库存|EIA/i, label: "能源数据" },
  { re: /杰克逊霍尔|Jackson Hole|央行年会/i, label: "央行会议" },
];

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function scanDecisionEventRisks(items = [], now = Date.now()) {
  if (!Array.isArray(items) || !items.length) return [];
  const results = [];
  const seen = new Set();
  for (const pattern of EVENT_PATTERNS) {
    for (const item of items.filter((entry) => pattern.re.test(entry?.content || ""))) {
      const key = `${pattern.label}:${(item.content || "").slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const time = Date.parse(item.time);
      const hoursAgo = Number.isFinite(time) ? Math.max(0, Math.round((now - time) / 3600000)) : null;
      results.push({
        category: pattern.label,
        time: item.time,
        timeLabel: hoursAgo === null ? "近期" : hoursAgo <= 1 ? "刚刚" : hoursAgo <= 24 ? `${hoursAgo}小时前` : "近期",
        content: (item.content || "").slice(0, 180).trim(),
      });
    }
  }
  return results.slice(0, 12);
}

export function analyzeOptionTemperature(metrics = {}) {
  const iv = finite(metrics.iv);
  const hv = finite(metrics.hv);
  const ivRank = finite(metrics.ivRank);
  const ivPercentile = finite(metrics.ivPercentile);
  const expectedMovePct = finite(metrics.expectedMovePct);
  const premiumSpread = iv !== null && hv !== null ? iv - hv : null;
  let level = "数据不足";
  if (ivRank !== null || ivPercentile !== null || premiumSpread !== null) {
    if ((ivRank ?? -Infinity) >= 80 || (ivPercentile ?? -Infinity) >= 85 || (premiumSpread ?? -Infinity) >= 10) level = "高温";
    else if ((ivRank ?? -Infinity) >= 50 || (ivPercentile ?? -Infinity) >= 60 || (premiumSpread ?? -Infinity) > 0) level = "中温";
    else level = "低温";
  }
  return { level, iv, hv, ivRank, ivPercentile, expectedMovePct, premiumSpread };
}

function classifyRiskScore(riskScore) {
  return {
    riskScore: riskScore.toFixed(1),
    putStance: riskScore >= 7.5 ? "不利" : riskScore >= 6.2 ? "谨慎" : "有利",
    blackSwan: riskScore >= 7.5 ? "🔴 高警戒" : riskScore >= 6.2 ? "🟡 需防范" : "🟢 常规防守",
  };
}

export function adjustRiskWithOptionMetrics(risk, optionMetrics = {}) {
  let riskScore = finite(risk?.riskScore) ?? 5.0;
  const temperature = analyzeOptionTemperature(optionMetrics);
  const putCallVolRatio = finite(optionMetrics.putCallVolRatio);
  const putCallOiRatio = finite(optionMetrics.putCallOiRatio);
  const expectedMovePct = temperature.expectedMovePct ?? finite(optionMetrics.expectedMovePct);
  const optionNotes = [];
  const opportunityNotes = [];

  if (temperature.level === "高温") {
    riskScore -= 0.3;
    opportunityNotes.push("IV溢价处于高温区，权利金补偿较好");
  } else if (temperature.level === "低温") {
    riskScore += 0.4;
    optionNotes.push("IV溢价偏低，权利金补偿不足");
  }

  if (temperature.iv !== null && temperature.hv !== null && temperature.iv < temperature.hv) {
    riskScore += 0.4;
    optionNotes.push("IV低于HV，卖方溢价不足");
  }

  if (putCallVolRatio !== null && putCallVolRatio >= 2.5) {
    riskScore += 0.8;
    optionNotes.push("Put/Call成交量比率极高，疑似防守需求集中");
  } else if (putCallVolRatio !== null && putCallVolRatio >= 1.5) {
    riskScore += 0.5;
    optionNotes.push("Put/Call成交量比率偏高");
  } else if (putCallVolRatio !== null && putCallVolRatio <= 0.7) {
    riskScore -= 0.2;
    opportunityNotes.push("Put/Call成交量比率不高，恐慌对冲压力有限");
  }

  if (putCallOiRatio !== null && putCallOiRatio >= 1.8) {
    riskScore += 0.6;
    optionNotes.push("Put/Call持仓比率极高");
  } else if (putCallOiRatio !== null && putCallOiRatio >= 1.2) {
    riskScore += 0.3;
    optionNotes.push("Put/Call持仓比率偏高");
  }

  if (expectedMovePct !== null && expectedMovePct >= 12) {
    riskScore += 0.7;
    optionNotes.push("Expected Move过高，短期跳动风险大");
  } else if (expectedMovePct !== null && expectedMovePct >= 8) {
    riskScore += 0.4;
    optionNotes.push("Expected Move偏高");
  }

  riskScore = Math.max(1, Math.min(9.5, riskScore));
  return {
    ...risk,
    ...classifyRiskScore(riskScore),
    optionAdjusted: optionNotes.length > 0 || opportunityNotes.length > 0,
    optionNotes,
    opportunityNotes,
    optionTemperature: temperature,
  };
}

export function calculateMarketRisk(signals = {}) {
  const value = (name) => finite(signals[name]?.changePct);
  const last = (name) => finite(signals[name]?.last);
  let riskScore = 5.0;
  const notes = ["模型基准分5.0，默认偏保守但不主动进入谨慎区"];
  const vixChange = value("vix");
  const vixLevel = last("vix");
  if ((vixChange ?? -Infinity) > 8 || ((vixLevel ?? -Infinity) > 20 && (vixChange ?? -Infinity) > 5)) {
    riskScore += 1.2;
    notes.push("VIX快速上升");
  }
  if ((value("tnx") ?? -Infinity) > 1) { riskScore += 0.7; notes.push("10Y收益率上升"); }
  if ((value("dxy") ?? -Infinity) > 0.3) { riskScore += 0.6; notes.push("美元走强"); }
  if ((value("qqq") ?? Infinity) < -1 || (value("spy") ?? Infinity) < -1) { riskScore += 0.9; notes.push("美股大盘走弱"); }
  if ((value("smh") ?? Infinity) < -1 || (value("soxx") ?? Infinity) < -1) { riskScore += 0.7; notes.push("半导体走弱"); }
  if ((value("btc") ?? Infinity) < -2.5) { riskScore += 0.5; notes.push("BTC走弱"); }
  if (value("iwm") !== null && value("spy") !== null && value("iwm") > value("spy")) riskScore -= 0.2;
  if ((value("target") ?? Infinity) < -3) { riskScore += 0.6; notes.push("标的单日跌幅较大"); }
  riskScore = Math.max(1, Math.min(9.5, riskScore));
  return {
    ...classifyRiskScore(riskScore),
    notes,
  };
}

export function adjustRiskWithKline(risk, klineStats, klineStructure = null) {
  let riskScore = finite(risk?.riskScore) ?? 5.0;
  const atrPct = finite(klineStats?.atrPct);
  const d20 = finite(klineStats?.returns?.d20);
  const d5 = finite(klineStats?.returns?.d5);
  const adjustmentNotes = [];
  if (atrPct !== null && atrPct > 8) { riskScore += 1.0; adjustmentNotes.push("ATR极高(>8%)"); }
  else if (atrPct !== null && atrPct > 6) { riskScore += 0.5; adjustmentNotes.push("ATR偏高(>6%)"); }
  if (d20 !== null && d20 < -20) { riskScore += 1.0; adjustmentNotes.push("20日暴跌>20%"); }
  else if (d20 !== null && d20 < -10) { riskScore += 0.5; adjustmentNotes.push("20日跌幅>10%"); }
  if (d5 !== null && d5 < -5) { riskScore += 0.3; adjustmentNotes.push("5日跌幅>5%"); }
  const historicalBear = finite(klineStructure?.historicalTrendStats?.bearProbability);
  const topMatch = klineStructure?.top5?.[0] || null;
  if (historicalBear !== null && historicalBear >= 75) { riskScore += 1.0; adjustmentNotes.push("历史相似样本偏空概率>=75%"); }
  else if (historicalBear !== null && historicalBear >= 60) { riskScore += 0.5; adjustmentNotes.push("历史相似样本偏空概率>=60%"); }
  if (topMatch?.bias === "偏空" && finite(topMatch.score) >= 75) { riskScore += 0.5; adjustmentNotes.push("高匹配度偏空K线形态"); }
  riskScore = Math.max(1, Math.min(9.5, riskScore));
  return {
    ...risk,
    ...classifyRiskScore(riskScore),
    adjusted: adjustmentNotes.length > 0,
    adjustmentNotes,
  };
}

export function evaluateOptionContract({
  spot,
  atr,
  expectedRangeLow,
  targetStrike,
  delta,
  bid,
  ask,
  expiryDate,
  putStance = "有利",
} = {}) {
  const price = finite(spot);
  const dailyAtr = finite(atr);
  const expectedLow = finite(expectedRangeLow);
  const strike = finite(targetStrike);
  const deltaValue = finite(delta);
  const deltaAbs = deltaValue === null ? null : Math.abs(deltaValue);
  const bidValue = finite(bid);
  const askValue = finite(ask);
  const quoteValid = bidValue !== null && bidValue > 0
    && askValue !== null && askValue >= bidValue;
  const mid = quoteValid ? (bidValue + askValue) / 2 : null;
  const spread = quoteValid ? askValue - bidValue : null;
  const spreadPct = mid !== null && mid > 0 ? spread / mid * 100 : null;
  const maxSpread = mid !== null ? Math.max(0.10, mid * 0.15) : null;
  const spreadPass = spread !== null && maxSpread !== null && spread <= maxSpread;
  const expiryTimestamp = Date.parse(String(expiryDate || ""));
  const dte = Number.isFinite(expiryTimestamp)
    ? Math.ceil((expiryTimestamp - Date.now()) / 86400000)
    : null;
  const atrDteMultiplier = dte !== null && dte > 0 ? Math.max(1.5, Math.sqrt(dte)) : 1.5;
  const atrSafeStrike = price !== null && dailyAtr !== null && dailyAtr > 0
    ? price - atrDteMultiplier * dailyAtr
    : null;
  const safetyReferences = [atrSafeStrike, expectedLow].filter((value) => value !== null && value > 0);
  const strictSafeStrike = safetyReferences.length ? Math.min(...safetyReferences) : null;
  const strikePass = strike !== null && strictSafeStrike !== null && strike <= strictSafeStrike;
  const otmPct = price !== null && price > 0 && strike !== null
    ? (price - strike) / price * 100
    : null;
  const collateralAnnualized = mid !== null && strike !== null && strike > 0 && dte !== null && dte > 0
    ? mid / strike * 365 / dte * 100
    : null;
  const netCost = mid !== null && strike !== null ? strike - mid : null;
  const netCostAnnualized = mid !== null && netCost !== null && netCost > 0 && dte !== null && dte > 0
    ? mid / netCost * 365 / dte * 100
    : null;
  const deltaRange = putStance === "谨慎"
    ? { min: 0.08, max: 0.15 }
    : { min: 0.10, max: 0.25 };
  const deltaTooHigh = deltaAbs !== null && deltaAbs > deltaRange.max;
  const deltaTooLow = deltaAbs !== null && deltaAbs < deltaRange.min;
  const deltaPass = deltaAbs !== null && !deltaTooHigh;
  const blockers = [];
  const warnings = [];

  if (putStance === "不利") blockers.push("市场风险规则判定为不利");
  if (!quoteValid) blockers.push("Bid/Ask报价无效");
  else if (!spreadPass) blockers.push("Bid/Ask价差过宽");
  if (deltaAbs === null) blockers.push("Delta缺失");
  else if (deltaTooHigh) blockers.push(`Delta ${deltaAbs.toFixed(3)}高于${deltaRange.max.toFixed(2)}上限`);
  else if (deltaTooLow) warnings.push(`Delta ${deltaAbs.toFixed(3)}低于${deltaRange.min.toFixed(2)}，收益效率偏低`);
  if (strictSafeStrike === null) blockers.push("无法计算严格安全行权价");
  else if (!strikePass) blockers.push(`行权价高于严格安全价${strictSafeStrike.toFixed(2)}`);
  if (dte === null || dte <= 0) blockers.push("到期日无效");

  return {
    approved: blockers.length === 0,
    status: blockers.length ? "暂不卖Put" : warnings.length ? "谨慎卖Put" : "可卖Put",
    blockers,
    warnings,
    delta: deltaAbs,
    deltaRange,
    bid: bidValue,
    ask: askValue,
    mid,
    spread,
    spreadPct,
    maxSpread,
    spreadPass,
    strike,
    spot: price,
    otmPct,
    atrSafeStrike,
    atrDteMultiplier,
    expectedRangeLow: expectedLow,
    strictSafeStrike,
    strikePass,
    dte,
    collateralAnnualized,
    netCostAnnualized,
    netCost,
  };
}

export function assessDecisionReadiness({
  rows = {},
  klineStats,
  klineStructure,
  newsItems = [],
  optionMetrics = {},
  targetStrike,
  delta,
  bid,
  ask,
  expiryDate,
} = {}) {
  const missing = [];
  const quoteKeys = ["target", "qqq", "spy", "vix", "tnx", "dxy"];
  const missingQuotes = quoteKeys.filter((key) => finite(rows[key]?.last) === null || finite(rows[key]?.changePct) === null);
  if (missingQuotes.length) missing.push(`关键行情：${missingQuotes.join("、")}`);
  if (!klineStats) missing.push("标的K线");
  if (!klineStructure?.analysisAngles) missing.push("K线相似度与历史结构判断");
  if (!Array.isArray(newsItems) || !newsItems.length) missing.push("近期新闻");
  const temperature = analyzeOptionTemperature(optionMetrics);
  if (temperature.iv === null || temperature.iv <= 0) missing.push("IV");
  if (temperature.hv === null || temperature.hv <= 0) missing.push("HV");
  if (temperature.ivRank === null && temperature.ivPercentile === null) missing.push("IV Rank或IV Percentile");
  const expectedMove = finite(optionMetrics.expectedMove);
  if ((temperature.expectedMovePct === null || temperature.expectedMovePct <= 0) && (expectedMove === null || expectedMove <= 0)) missing.push("Expected Move");
  const expectedRangeLow = finite(optionMetrics.expectedRangeLow);
  if (expectedRangeLow === null || expectedRangeLow <= 0) missing.push("Expected Range Low");
  const strike = finite(targetStrike);
  const deltaValue = finite(delta);
  const bidValue = finite(bid);
  const askValue = finite(ask);
  const expiryTimestamp = Date.parse(String(expiryDate || ""));
  const expiryValid = Number.isFinite(expiryTimestamp) && expiryTimestamp > Date.now();
  if (strike === null || strike <= 0) missing.push("有效行权价");
  if (deltaValue === null || Math.abs(deltaValue) <= 0 || Math.abs(deltaValue) >= 1) missing.push("有效Delta");
  if (bidValue === null || bidValue <= 0) missing.push("有效Bid");
  if (askValue === null || askValue <= 0 || (bidValue !== null && askValue < bidValue)) missing.push("有效Ask");
  if (!expiryValid) missing.push("有效未来到期日");
  return {
    mode: missing.length ? "precheck" : "full",
    canIssueDecision: missing.length === 0,
    missing,
    temperature,
    components: {
      market: missingQuotes.length === 0,
      kline: !!klineStats && !!klineStructure?.analysisAngles,
      news: Array.isArray(newsItems) && newsItems.length > 0,
      optionTemperature: temperature.iv !== null && temperature.iv > 0
        && temperature.hv !== null && temperature.hv > 0
        && (temperature.ivRank !== null || temperature.ivPercentile !== null)
        && ((temperature.expectedMovePct !== null && temperature.expectedMovePct > 0) || (expectedMove !== null && expectedMove > 0))
        && expectedRangeLow !== null && expectedRangeLow > 0,
      optionContract: strike !== null && strike > 0
        && deltaValue !== null && Math.abs(deltaValue) > 0 && Math.abs(deltaValue) < 1
        && bidValue !== null && bidValue > 0
        && askValue !== null && askValue >= bidValue
        && expiryValid,
    },
  };
}
