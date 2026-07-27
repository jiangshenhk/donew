import test from "node:test";
import assert from "node:assert/strict";
import { parseBarchartOverviewHtml } from "./barchart-overview.js";

test("parses option overview rows even when navigation contains Options Overview first", () => {
  const html = `
    <nav><a>Options Overview History</a></nav>
    ${"x".repeat(42000)}
    <section>
      <h2>Options Overview</h2>
      <ul>
        <li><span class="left">Implied Volatility</span><span class="right">49.20% (+0.29%)</span></li>
        <li><span class="left">Historical Volatility</span><span class="right">53.55%</span></li>
        <li><span class="left">IV Percentile</span><span class="right">89%</span></li>
        <li><span class="left">IV Rank</span><span class="right">66.28%</span></li>
        <li><span class="left">IV High</span><span class="right">60.85% on 03/30/26</span></li>
        <li><span class="left">IV Low</span><span class="right">26.32% on 08/12/25</span></li>
        <li><span class="left">Expected Move (DTE 27)</span><span class="right">7.74 (9.32%)</span></li>
        <li><span class="left">Put/Call Vol Ratio</span><span class="right">0.87</span></li>
        <li><span class="left">Today's Volume</span><span class="right">757</span></li>
        <li><span class="left">Volume Avg (30-Day)</span><span class="right">1,350</span></li>
        <li><span class="left">Put/Call OI Ratio</span><span class="right">0.34</span></li>
        <li><span class="left">Today's Open Interest</span><span class="right">45,448</span></li>
        <li><span class="left">Open Int (30-Day)</span><span class="right">48,690</span></li>
        <li><span class="left">Expected Range</span><span class="right">75.27 to 90.74</span></li>
      </ul>
    </section>
  `;

  const metrics = parseBarchartOverviewHtml(html);

  assert.equal(metrics.expectedMove, "7.74");
  assert.equal(metrics.expectedMovePct, "9.32");
  assert.equal(metrics.expectedMoveDte, "27");
  assert.equal(metrics.expectedRangeLow, "75.27");
  assert.equal(metrics.expectedRangeHigh, "90.74");
});
