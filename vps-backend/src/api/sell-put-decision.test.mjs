import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync(new URL("./sell-put-decision.js", import.meta.url), "utf8");
const pageSource = fs.readFileSync(
  new URL("../../../kline_robot_vercel/sell-put-decision-tool.html", import.meta.url),
  "utf8",
);

test("finalize applies the strict completeness and contract gates", () => {
  assert.match(apiSource, /assessDecisionReadiness\s*\(\s*\{/);
  assert.match(apiSource, /atr:\s*task\.klineStats\?\.atr/);
  assert.match(apiSource, /if \(!readiness\.canIssueDecision\)/);
  assert.match(apiSource, /optionResult\.contractApproved = contractDecision\.approved/);
});

test("the K-line module keeps similarity and structure evidence", () => {
  assert.match(apiSource, /formatKlineStructure\(klineStructure\)/);
  assert.match(apiSource, /共享K线相似度引擎/);
  assert.match(apiSource, /历史条件样本与ABC\/2B结构/);
});

test("missing market data is not converted to zero", () => {
  assert.match(apiSource, /不得把“未取到”解释为0/);
  assert.doesNotMatch(apiSource, /changePct\s*\|\|\s*["']0/);
  assert.doesNotMatch(apiSource, /weightedIv/);
});

test("the final report retains all six decision sections", () => {
  for (const heading of [
    "1. 综合结论",
    "2. 市场环境与黑天鹅风险",
    "3. 期权温度解读",
    "4. K线技术信号",
    "5. 综合卖Put建议",
    "6. 未来3-5个交易日关注清单",
  ]) {
    assert.match(apiSource, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(apiSource, /<summary>数据来源与时间<\/summary>/);
});

test("the browser checks every module response before finalizing", () => {
  assert.match(pageSource, /v2\.1\.1｜2026-08-06 01:56/);
  assert.match(pageSource, /if \(!response\.ok \|\| !json\.ok\)/);
  assert.match(pageSource, /Promise\.allSettled/);
  assert.match(pageSource, /runModule\('market'/);
  assert.match(pageSource, /runModule\('kline'/);
  assert.match(pageSource, /runModule\('option'/);
});
