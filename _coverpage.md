<!-- _coverpage.md -->
<style>
.cover-main {
  color: #172033;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.92));
}
.home-shell {
  width: min(860px, calc(100vw - 48px));
  margin: 0 auto;
  padding: 28px 0 18px;
  text-align: left;
}
.home-hero {
  display: block;
}
.home-kicker {
  display: inline-flex;
  margin-bottom: 18px;
  padding: 6px 10px;
  border: 1px solid #dbe4f0;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}
.home-title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(42px, 5vw, 64px);
  line-height: 1.02;
  font-weight: 850;
  letter-spacing: 0;
}
.home-title span {
  color: #2563eb;
}
.home-subtitle {
  max-width: 720px;
  margin: 18px 0 0;
  color: #475569;
  font-size: 18px;
  line-height: 1.8;
}
.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}
.home-action {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #1e293b !important;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none !important;
}
.home-action:hover {
  border-color: #2563eb;
  color: #2563eb !important;
}
.home-action.primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff !important;
}
.market-panel {
  margin-top: 24px;
  padding: 22px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}
.panel-label {
  color: #2563eb;
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0.04em;
}
.panel-title {
  margin: 10px 0 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.35;
  font-weight: 850;
}
.panel-text {
  margin: 12px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.75;
}
.panel-list {
  display: grid;
  gap: 0;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}
.panel-list li {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
  border-top: 1px solid #e2e8f0;
  color: #334155;
  font-size: 14px;
}
.panel-list strong {
  color: #0f172a;
  white-space: nowrap;
}
.channel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 26px;
}
.channel-card {
  min-height: 118px;
  padding: 16px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  color: #334155 !important;
  text-decoration: none !important;
}
.channel-card:hover {
  border-color: #2563eb;
  background: #fff;
}
.channel-card strong {
  display: block;
  color: #0f172a;
  font-size: 15px;
  margin-bottom: 8px;
}
.channel-card span {
  display: block;
  color: #64748b;
  font-size: 13px;
  line-height: 1.65;
}
.site-counter {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}
.site-counter span {
  white-space: nowrap;
}
.site-counter strong {
  color: #334155;
  font-weight: 800;
}
@media (max-width: 900px) {
  .home-shell { padding-top: 24px; }
  .channel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .home-shell { width: min(92vw, 420px); }
  .home-title { font-size: 42px; }
  .home-subtitle { font-size: 16px; }
  .home-actions { flex-direction: column; }
  .home-action { justify-content: center; width: 100%; }
  .market-panel { padding: 18px; }
  .channel-grid { grid-template-columns: 1fr; }
  .site-counter { flex-direction: column; gap: 2px; }
}
</style>
<div class="home-shell"><div class="home-hero"><div><div class="home-kicker">AI 市场判断 · ETF 定投 · Sell Put</div><h1 class="home-title">十方斋<br><span>复利投资</span></h1><p class="home-subtitle">用 AI 和数据记录每日市场结构，整理 ETF 定投、Sell Put 与长期复利方法。暴富是概率事件，复利是时间过程。</p><div class="home-actions"><a href="#/docs/市场/今日.md" class="home-action primary">今日市场判断</a><a href="#/docs/ETF图谱/ETF长期收益图谱.md" class="home-action">ETF 图谱</a><a href="#/docs/市场/卖Put评级说明.md" class="home-action">AI 筛选 Put</a></div></div><div class="market-panel"><div class="panel-label">TODAY</div><h2 class="panel-title">先判断环境，再执行策略</h2><p class="panel-text">每日市场日报不预测明天涨跌，而是判断当前更适合进攻、观望还是防守。</p><ul class="panel-list"><li><span>市场环境</span><strong>risk-on / 分化 / 防守</strong></li><li><span>执行重点</span><strong>远 OTM / 小仓 / 分批</strong></li><li><span>风险检查</span><strong>10Y · 油价 · VIX · BTC</strong></li></ul></div></div><div class="channel-grid"><a href="#/docs/sections/compound.md" class="channel-card"><strong>心安复利</strong><span>财富观、复利方法与佛学心态，先把长期方向想清楚。</span></a><a href="#/docs/sections/etf-dca.md" class="channel-card"><strong>ETF 定投</strong><span>指数、ETF、杠杆 ETF 和长期定投图谱。</span></a><a href="#/docs/sections/sell-put.md" class="channel-card"><strong>Sell Put</strong><span>把愿意接货的价格，变成有纪律的等待计划。</span></a><a href="#/docs/sections/market-ai.md" class="channel-card"><strong>AI 市场判断</strong><span>跟踪市场结构、风险分数和可执行环境。</span></a></div><div class="site-counter"><span>本站访问 <strong id="busuanzi_value_site_pv">--</strong> 次</span><span>访客 <strong id="busuanzi_value_site_uv">--</strong> 人</span></div></div>
