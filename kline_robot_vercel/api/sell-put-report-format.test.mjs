import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeReportSections } from "./sell-put-decision.js";

test("normalizes every report section to the shared structure classes", () => {
  const result = normalizeReportSections(`
    <section class="section">
      <h2>市场环境</h2>
      <p>市场维持谨慎。</p>
      <ul><li><strong>风险：</strong>美元偏强</li></ul>
      <table><tr><td>QQQ</td></tr></table>
    </section>
  `);

  assert.match(result, /class="section report-section"/);
  assert.match(result, /class="section-summary"/);
  assert.match(result, /class="bullet-list"/);
  assert.match(result, /class="report-table"/);
});

test("preserves existing classes while adding the report section class", () => {
  const result = normalizeReportSections(`
    <section class="section hero-judgement">
      <h2>综合结论</h2>
      <p class="section-summary">谨慎卖Put</p>
      <ul class="bullet-list"><li>风险仍在</li></ul>
    </section>
  `);

  assert.match(result, /class="section hero-judgement report-section"/);
  assert.equal((result.match(/section-summary/g) || []).length, 1);
  assert.equal((result.match(/bullet-list/g) || []).length, 1);
});

test("keeps screenshot OCR in the browser and sends only parsed metrics", () => {
  const apiSource = fs.readFileSync(new URL("./sell-put-decision.js", import.meta.url), "utf8");
  const pageSource = fs.readFileSync(new URL("../sell-put-decision-tool.html", import.meta.url), "utf8");

  assert.doesNotMatch(apiSource, /body\.imageDataUrl|input_image/);
  assert.match(pageSource, /id="parseImageBtn"/);
  assert.match(pageSource, /id="fetchOptionMetricsBtn"/);
  assert.match(pageSource, /if \(!optionParametersFetched\)/);
  assert.match(pageSource, /missingRequiredOptionMetrics/);
  assert.doesNotMatch(pageSource, /payload\.imageDataUrl/);
});

test("uses a bounded DeepSeek-only generation chain and reports non-JSON responses clearly", () => {
  const apiSource = fs.readFileSync(new URL("./sell-put-decision.js", import.meta.url), "utf8");
  const pageSource = fs.readFileSync(new URL("../sell-put-decision-tool.html", import.meta.url), "utf8");

  assert.match(apiSource, /K线分析超过30秒/);
  assert.match(apiSource, /\}, 50000\)/);
  assert.doesNotMatch(apiSource, /api\.openai\.com/);
  assert.doesNotMatch(apiSource, /OPENAI_API_KEY/);
  assert.match(apiSource, /timings:\s*\{\s*dataMs:/);
  assert.match(apiSource, /不建议卖\\s\*Put/);
  assert.match(apiSource, /ruleDecisionFromRiskOptionAndContract/);
  assert.match(pageSource, /async function readApiJson/);
  assert.match(pageSource, /报告生成接口/);
  assert.match(pageSource, /v2\.0\.0\.9/);
});
