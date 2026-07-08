<!-- _coverpage.md -->
<style>
  .cover-title {
    background: linear-gradient(90deg, #2563eb, #7c3aed, #db2777);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    display: inline-block;
    font-family: 'Helvetica Neue', 'Noto Sans SC', sans-serif;
    font-size: 4rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-align: center;
    white-space: nowrap;
    margin-bottom: 12px;
  }

  .sub-quote {
    font-family: 'Noto Sans SC', sans-serif;
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.03em;
    color: #475569;
    line-height: 1.7;
    position: relative;
    display: inline-block;
    margin-top: 8px;
  }

  .sub-quote::after {
    content: "";
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent 20%, #3b82f6 50%, transparent 80%);
    opacity: 0.35;
  }

  .cover-highlight {
    max-width: 780px;
    margin: 22px auto 0;
    padding: 18px 22px;
    border-radius: 16px;
    background: rgba(37, 99, 235, 0.06);
    border: 1px solid rgba(37, 99, 235, 0.12);
    color: #334155;
    line-height: 1.9;
    font-size: 1rem;
  }

  .main-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
    max-width: 860px;
    margin: 34px auto 18px;
  }

  .main-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 24px 22px;
    text-align: left;
    text-decoration: none !important;
    color: #334155 !important;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
    transition: all 0.25s ease;
    min-height: 148px;
    display: block;
  }

  .main-card:hover {
    transform: translateY(-4px);
    border-color: #3b82f6;
    box-shadow: 0 12px 26px rgba(37, 99, 235, 0.18);
  }

  .main-card strong {
    display: block;
    font-size: 1.16rem;
    color: #1e293b;
    margin-bottom: 10px;
  }

  .main-card span {
    display: block;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.75;
  }

  .main-card.weapon-one {
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: white !important;
    border-color: rgba(37, 99, 235, 0.45);
  }

  .main-card.weapon-two {
    background: linear-gradient(135deg, #0f766e, #2563eb);
    color: white !important;
    border-color: rgba(15, 118, 110, 0.45);
  }

  .main-card.weapon-one strong,
  .main-card.weapon-one span,
  .main-card.weapon-two strong,
  .main-card.weapon-two span { color: white; }

  .quick-row {
    max-width: 860px;
    margin: 18px auto 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .quick-link {
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #475569 !important;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none !important;
    transition: all 0.2s ease;
  }

  .quick-link:hover {
    border-color: #3b82f6;
    color: #2563eb !important;
    background: #f8fafc;
  }

  .cover-note {
    color: #64748b;
    font-size: 0.95rem;
    line-height: 1.8;
    max-width: 760px;
    margin: 18px auto 0;
  }

  .site-counter {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    margin: 24px auto 0;
    color: #64748b;
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .site-counter span {
    white-space: nowrap;
  }

  .site-counter strong {
    color: #334155;
    font-weight: 700;
  }

  @media (max-width: 768px) {
    .cover-title {
      font-size: 2.1rem;
      white-space: normal;
      letter-spacing: 0.04em;
    }

    .main-grid {
      grid-template-columns: 1fr;
      max-width: 92%;
      gap: 12px;
      margin-top: 28px;
    }
  }
</style>

<div class="cover-title">十方斋｜复利投资</div>

<!-- ![封面图](/topnew2.jpg)

***

 <span class="sub-quote">站在时间这一边，用AI和数据，重新理解复利投资。</span> -->

<div class="cover-highlight">
  <strong>核心思想：</strong>暴富是概率事件，复利是时间过程。用 ETF 定投建立底仓，用 Sell Put 增强现金流，再用 AI 工具判断市场环境与个股结构。
</div>

<div class="main-grid">
  <a href="https://donew-beta.vercel.app/market-analysis-tool.html" target="_blank" class="main-card weapon-one">
    <strong>⚔️ AI市场风向判断</strong>
    <span>每天先看大环境：利率、黄金、BTC、纳指、风险偏好，到底适不适合执行定投或 Sell Put。</span>
  </a>

  <a href="https://donew-beta.vercel.app/kline-robot.html" target="_blank" class="main-card weapon-two">
    <strong>🧭 单票K线技术判断</strong>
    <span>再看具体标的：K 线结构、动量状态、相似形态、关键确认位和失败位，辅助判断单票风险。</span>
  </a>
</div>

<div class="quick-row">
  <a href="#/docs/复利/ETF定投方法.md" class="quick-link">时间武器一：ETF 定投</a>
  <a href="#/docs/SellPut/how-to-sell-put.md" class="quick-link">时间武器二：Sell Put</a>
  <a href="#/docs/ETF图谱/ETF长期收益图谱.md" class="quick-link">定投ETF收益PK</a>
  <a href="#/docs/other/lingyin-wealth.md" class="quick-link">灵隐寺拜财富众神</a>
  <a href="#/docs/市场/今日.md" class="quick-link">AI每日市场判断</a>
  <a href="#/docs/other/calm-wealth-mindset.md" class="quick-link">心安复利</a>
</div>

<div class="site-counter">
  <span>本站访问 <strong id="busuanzi_value_site_pv">--</strong> 次</span>
  <span>访客 <strong id="busuanzi_value_site_uv">--</strong> 人</span>
</div>
