import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustRiskWithOptionMetrics,
  assessDecisionReadiness,
  calculateMarketRisk,
  evaluateOptionContract,
} from "./sell-put-decision-core.js";

function futureDate(days = 30) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

test("complete decision now requires Delta, Bid, Ask and Expected Range Low", () => {
  const result = assessDecisionReadiness({
    rows: Object.fromEntries(["target", "qqq", "spy", "vix", "tnx", "dxy"].map((key) => [key, { last: 100, changePct: 1 }])),
    klineStats: { atr: 2 },
    klineStructure: { analysisAngles: {} },
    newsItems: [{ content: "market update" }],
    optionMetrics: { iv: 40, hv: 30, ivRank: 60, expectedMove: 5, expectedRangeLow: 92 },
    targetStrike: 90,
    delta: -0.15,
    bid: 1.2,
    ask: 1.3,
    expiryDate: futureDate(),
  });

  assert.equal(result.canIssueDecision, true);
  assert.equal(result.components.optionContract, true);
});

test("contract gate approves a liquid contract below strict safety reference", () => {
  const result = evaluateOptionContract({
    spot: 100,
    atr: 2,
    expectedRangeLow: 95,
    targetStrike: 88,
    delta: -0.15,
    bid: 1,
    ask: 1.1,
    expiryDate: futureDate(),
    putStance: "有利",
  });

  assert.equal(result.approved, true);
  assert.equal(result.status, "可卖Put");
  assert.ok(result.strictSafeStrike < 90);
  assert.equal(result.strikePass, true);
  assert.ok(result.collateralAnnualized > 0);
  assert.ok(result.netCostAnnualized > result.collateralAnnualized);
});

test("contract gate blocks a wide spread", () => {
  const result = evaluateOptionContract({
    spot: 100,
    atr: 2,
    expectedRangeLow: 95,
    targetStrike: 88,
    delta: 0.15,
    bid: 0.5,
    ask: 1.5,
    expiryDate: futureDate(),
    putStance: "有利",
  });

  assert.equal(result.approved, false);
  assert.match(result.blockers.join(" "), /价差过宽/);
});

test("cautious market uses a lower Delta ceiling", () => {
  const result = evaluateOptionContract({
    spot: 100,
    atr: 2,
    expectedRangeLow: 95,
    targetStrike: 88,
    delta: -0.2,
    bid: 1,
    ask: 1.1,
    expiryDate: futureDate(),
    putStance: "谨慎",
  });

  assert.equal(result.approved, false);
  assert.match(result.blockers.join(" "), /0.15上限/);
});

test("unfavorable market always blocks automated execution", () => {
  const result = evaluateOptionContract({
    spot: 100,
    atr: 2,
    expectedRangeLow: 95,
    targetStrike: 88,
    delta: -0.12,
    bid: 1,
    ask: 1.1,
    expiryDate: futureDate(),
    putStance: "不利",
  });

  assert.equal(result.approved, false);
  assert.match(result.blockers.join(" "), /市场风险规则判定为不利/);
});

test("VIX must clear the higher quick-rise threshold or high-level condition", () => {
  const normal = calculateMarketRisk({ vix: { last: 16, changePct: 6 } });
  const highLevel = calculateMarketRisk({ vix: { last: 22, changePct: 6 } });
  const fastRise = calculateMarketRisk({ vix: { last: 16, changePct: 9 } });

  assert.doesNotMatch(normal.notes.join(" "), /VIX快速上升/);
  assert.match(highLevel.notes.join(" "), /VIX快速上升/);
  assert.match(fastRise.notes.join(" "), /VIX快速上升/);
});

test("option temperature and Put/Call structure adjust the rule risk", () => {
  const base = calculateMarketRisk({});
  const lowPremium = adjustRiskWithOptionMetrics(base, { iv: 30, hv: 40, ivRank: 20, putCallVolRatio: 0.6 });
  const putHedge = adjustRiskWithOptionMetrics(base, { iv: 80, hv: 60, ivRank: 90, putCallVolRatio: 2.8, putCallOiRatio: 2, expectedMovePct: 13 });

  assert.ok(Number(lowPremium.riskScore) > Number(base.riskScore));
  assert.match(lowPremium.optionNotes.join(" "), /IV低于HV/);
  assert.ok(Number(putHedge.riskScore) > Number(base.riskScore));
  assert.match(putHedge.optionNotes.join(" "), /Put\/Call/);
});
