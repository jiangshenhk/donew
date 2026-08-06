import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync(new URL("./sell-put-decision.js", import.meta.url), "utf8");
const pageSource = fs.readFileSync(
  new URL("../../../kline_robot_vercel/sell-put-decision-tool.html", import.meta.url),
  "utf8",
);
const aiRoutesSource = fs.readFileSync(new URL("../routes/ai.js", import.meta.url), "utf8");
const reportContractSource = fs.readFileSync(
  new URL("../../../docs/tools/sell-put-decision/设计_综合卖Put决策.md", import.meta.url),
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

test("module contracts preserve the historical report depth", () => {
  assert.match(apiSource, /"details": \[/);
  assert.match(apiSource, /"panicPremiumReason"/);
  assert.match(apiSource, /"crashRiskReason"/);
  assert.match(apiSource, /"premiumWorthReason"/);
  assert.match(apiSource, /"ifMustOperate"/);
  assert.match(apiSource, /"strikeRange"/);
  assert.match(apiSource, /"improvementSignals"/);
  assert.match(apiSource, /"deteriorationSignals"/);
  assert.match(apiSource, /detailList\(marketResult\.details/);
  assert.match(apiSource, /detailList\(optionResult\.details/);
  assert.match(apiSource, /detailList\(klineResult\.details/);
});

test("the browser checks every module response before finalizing", () => {
  assert.match(pageSource, /v2\.1\.3｜2026-08-06 16:10/);
  assert.match(pageSource, /if \(response\.ok && json\.ok\) return json/);
  assert.match(pageSource, /async function postDecision/);
  assert.match(pageSource, /action: 'status'/);
  assert.match(pageSource, /await wait\(2000\)/);
  assert.match(pageSource, /Promise\.all\(/);
  assert.match(pageSource, /runModule\('market'/);
  assert.match(pageSource, /runModule\('kline'/);
  assert.match(pageSource, /runModule\('option'/);
});

test("long-running modules use background execution and polling", () => {
  assert.match(apiSource, /if \(action === "status"\) return handleTaskStatus/);
  assert.match(apiSource, /runModuleInBackground\(task, moduleName\)/);
  assert.match(apiSource, /status: "running"/);
  assert.match(apiSource, /done: Object\.values\(modules\)\.every/);
});

test("VPS routing does not double-count handlers that secure themselves", () => {
  assert.match(aiRoutesSource, /function adaptAiRoute\(handler, handlerHasSecurityCheck = true\)/);
  assert.match(aiRoutesSource, /if \(!handlerHasSecurityCheck && !securityCheck\(req, res\)\) return/);
  assert.match(aiRoutesSource, /adaptAiRoute\(barchartOverviewHandler, false\)/);
});

test("the maintenance document preserves the report content contract", () => {
  assert.match(reportContractSource, /报告格式唯一规范源/);
  assert.match(reportContractSource, /这是不是恐慌溢价/);
  assert.match(reportContractSource, /未来3-5个交易日的大跌\/跳空风险/);
  assert.match(reportContractSource, /权利金值不值得冒尾部风险/);
  assert.match(reportContractSource, /市场环境与黑天鹅风险/);
  assert.match(reportContractSource, /期权温度解读/);
  assert.match(reportContractSource, /K线技术信号/);
  assert.match(reportContractSource, /综合卖Put建议/);
  assert.match(reportContractSource, /未来3-5个交易日关注清单/);
});
