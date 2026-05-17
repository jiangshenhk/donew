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

  .btn-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    max-width: 760px;
    margin: 40px auto 18px;
  }

  .cover-btn {
    padding: 15px 12px;
    text-align: center;
    border-radius: 12px;
    font-weight: 700;
    transition: all 0.25s ease;
    text-decoration: none !important;
    min-height: 48px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  }

  .btn-main {
    background: #2563eb;
    color: white !important;
  }

  .btn-sub {
    background: white;
    border: 1px solid #e2e8f0;
    color: #334155 !important;
  }

  .cover-btn:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
  }

  .btn-main:hover { background: #1d4ed8; }
  .btn-sub:hover { border-color: #3b82f6; background: #f8fafc; }

  .cover-note {
    color: #64748b;
    font-size: 0.95rem;
    line-height: 1.8;
    max-width: 760px;
    margin: 14px auto 0;
  }

  .cover-highlight {
    max-width: 780px;
    margin: 22px auto 0;
    padding: 16px 20px;
    border-radius: 14px;
    background: rgba(37, 99, 235, 0.06);
    border: 1px solid rgba(37, 99, 235, 0.12);
    color: #334155;
    line-height: 1.85;
    font-size: 0.96rem;
  }

  @media (max-width: 768px) {
    .cover-title {
      font-size: 2.1rem;
      white-space: normal;
      letter-spacing: 0.04em;
    }

    .btn-grid {
      grid-template-columns: 1fr;
      max-width: 92%;
      gap: 10px;
      margin-top: 28px;
    }
  }
</style>

<div class="cover-title">十方斋｜复利投资</div>

![封面图](/topnew2.jpg)

***

<span class="sub-quote">用AI和数据，重新理解复利投资。</span>

<div class="cover-highlight">
  <strong>本站底层思想：</strong>暴富是概率事件，复利是时间过程。普通人最现实的财富路径，不是天天寻找那一次小概率暴富，而是尽早站到时间这一边。我的两把时间武器，是 <strong>ETF 定投</strong> 和 <strong>Sell Put</strong>；AI 和数据，则用来辅助判断风险环境和执行纪律。
</div>

<div class="btn-grid">
  <a href="#/docs/other/calm-wealth-mindset.md" class="cover-btn btn-main">心安复利</a>
  <a href="#/docs/市场/今日.md" class="cover-btn btn-sub">今日市场分析</a>
  <a href="#/docs/复利/ETF定投方法.md" class="cover-btn btn-sub">ETF定投大法</a>
  <a href="#/docs/ETF图谱/ETF长期收益图谱.md" class="cover-btn btn-sub">定投也能用杠杆</a>
  <a href="#/docs/SellPut/how-to-sell-put.md" class="cover-btn btn-sub">卖Put收高利息</a>
  <a href="#/docs/市场/卖Put评级说明.md" class="cover-btn btn-sub">用AI筛选Put</a>
</div>

<div class="cover-note">
建议阅读顺序：先看“心安复利”，理解为什么普通人要选择时间的威力；再看 ETF 定投和 Sell Put 两个方法；最后用每日市场分析和 AI 筛选 Put 辅助执行。
</div>
