import test from "node:test";
import assert from "node:assert/strict";
import {
  assessDecisionReadiness,
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
    targetStrike: 94,
    delta: -0.15,
    bid: 1,
    ask: 1.1,
    expiryDate: futureDate(),
    putStance: "有利",
  });

  assert.equal(result.approved, true);
  assert.equal(result.status, "可卖Put");
  assert.equal(result.strictSafeStrike, 95);
  assert.equal(result.strikePass, true);
  assert.ok(result.collateralAnnualized > 0);
  assert.ok(result.netCostAnnualized > result.collateralAnnualized);
});

test("contract gate blocks a wide spread", () => {
  const result = evaluateOptionContract({
    spot: 100,
    atr: 2,
    expectedRangeLow: 95,
    targetStrike: 94,
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
    targetStrike: 94,
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
    targetStrike: 94,
    delta: -0.12,
    bid: 1,
    ask: 1.1,
    expiryDate: futureDate(),
    putStance: "不利",
  });

  assert.equal(result.approved, false);
  assert.match(result.blockers.join(" "), /市场风险规则判定为不利/);
});
