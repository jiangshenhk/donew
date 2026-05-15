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
    max-width: 720px;
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
    max-width: 760px;
    margin: 22px auto 0;
    padding: 14px 18px;
    border-radius: 14px;
    background: rgba(37, 99, 235, 0.06);
    border: 1px solid rgba(37, 99, 235, 0.12);
    color: #334155;
    line-height: 1.75;
    font-size: 0.95rem;
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

<span class="sub-quote">复利，不只是买入后的等待，更是数学、概率、节奏与纪律。</span>

<div class="cover-highlight">
  <strong>本期专题：</strong>定投是否可以用杠杆ETF？用真实长期定投对比，看普通ETF、2倍ETF、3倍ETF的收益、回撤和仓位选择。
</div>

<div class="btn-grid">
  <a href="#/docs/ETF图谱/ETF长期收益图谱.md" class="cover-btn btn-main">📈 定投是否可以用杠杆ETF？</a>
  <a href="#/docs/ETF图谱/B站ETF视频清单.md" class="cover-btn btn-sub">📚 系列目录</a>
  <a href="#/docs/ETF图谱/杠杆ETF定投前先问五个问题.md" class="cover-btn btn-sub">⚠️ 风险检查</a>
  <a href="#/docs/市场/今日.md" class="cover-btn btn-sub">📊 今日市场</a>
  <a href="#/docs/SellPut/如何SellPut.md" class="cover-btn btn-sub">🧮 Sell Put</a>
  <a href="#/docs/复利/ETF定投方法.md" class="cover-btn btn-sub">🌱 ETF定投方法</a>
</div>

<div class="cover-note">
这里记录长期复利投资、ETF定投、杠杆ETF收益对比、Sell Put 策略，以及每日市场结构判断。核心目标不是追新闻，而是形成可执行、可复盘的投资决策框架。
</div>
