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
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    max-width: 860px;
    margin: 34px auto 18px;
  }

  .main-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 20px 18px;
    text-align: left;
    text-decoration: none !important;
    color: #334155 !important;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
    transition: all 0.25s ease;
    min-height: 128px;
    display: block;
  }

  .main-card:hover {
    transform: translateY(-4px);
    border-color: #3b82f6;
    box-shadow: 0 12px 26px rgba(37, 99, 235, 0.18);
  }

  .main-card strong {
    display: block;
    font-size: 1.08rem;
    color: #1e293b;
    margin-bottom: 8px;
  }

  .main-card span {
    display: block;
    color: #64748b;
    font-size: 0.9rem;
    line-height: 1.65;
  }

  .main-card.featured {
    background: #2563eb;
    color: white !important;
    border-color: #2563eb;
  }

  .main-card.featured strong,
  .main-card.featured span { color: white; }

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
  <strong>核心思想：</strong>暴富是概率事件，复利是时间过程。普通人最现实的财富路径，不是寻找一次小概率暴富，而是尽早站到时间这一边。
</div>

<div class="main-grid">
  <a href="#/docs/other/calm-wealth-mindset.md" class="main-card featured">
    <strong>心安复利</strong>
    <span>先把底层财富观想清楚：心态平和、守住正财、长期积累，选择时间的威力。</span>
  </a>

  <a href="#/docs/复利/ETF定投方法.md" class="main-card">
    <strong>时间武器一：<br>ETF定投</strong>
    <span>用长期参与和持续投入，降低择时压力，让时间慢慢摊平波动。</span>
  </a>

  <a href="#/docs/SellPut/how-to-sell-put.md" class="main-card">
    <strong>时间武器二：<br>Sell Put</strong>
    <span>用愿意接货的价格等待好资产，把等待过程变成权利金现金流。</span>
  </a>
</div>

<div class="quick-row">
  <a href="#/docs/other/lingyin-wealth.md" class="quick-link">灵隐寺寻找财富之众神</a>
  <a href="#/docs/市场/今日.md" class="quick-link">AI每日市场判断</a>
  <a href="#/docs/市场/卖Put评级说明.md" class="quick-link">AI筛选最佳Put</a>
  <a href="#/docs/ETF图谱/B站ETF视频清单.md" class="quick-link">定投杠杆ETF收益比较</a>
</div>
