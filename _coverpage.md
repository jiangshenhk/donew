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
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    max-width: 840px;
    margin: 28px auto 18px;
  }

  .main-card {
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 18px;
    padding: 16px 14px;
    text-align: center;
    text-decoration: none !important;
    color: white !important;
    box-shadow: 0 16px 34px rgba(37, 99, 235, 0.18);
    transition: all 0.25s ease;
    min-height: 92px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .main-card,
  .main-card:hover,
  .main-card:focus,
  .main-card:active,
  .main-card *,
  .main-card:hover *,
  .main-card:focus *,
  .main-card:active * {
    text-decoration: none !important;
    border-bottom: none !important;
    box-shadow: none;
  }

  .main-card::after {
    content: "";
    position: absolute;
    right: -55px;
    bottom: -70px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
  }

  .main-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 22px 46px rgba(37, 99, 235, 0.26) !important;
  }

  .main-card strong {
    display: block;
    font-size: 1.16rem;
    color: white !important;
    margin: 0;
    position: relative;
    z-index: 1;
    line-height: 1.35;
  }

  .main-card span {
    display: block;
    color: rgba(255, 255, 255, 0.92) !important;
    font-size: 0.92rem;
    line-height: 1.75;
    position: relative;
    z-index: 1;
    font-weight: 600;
  }

  .main-card.mindset {
    background: linear-gradient(145deg, #3b82f6 0%, #2563eb 58%, #1d4ed8 100%);
  }

  .main-card.weapon-one {
    background: linear-gradient(145deg, #3b82f6 0%, #2563eb 52%, #7c3aed 100%);
  }

  .main-card.weapon-two {
    background: linear-gradient(145deg, #0f766e 0%, #1379a8 50%, #2563eb 100%);
  }

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
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-width: 94%;
      gap: 10px;
      margin-top: 22px;
    }

    .main-card {
      min-height: 72px;
      padding: 12px 8px;
      border-radius: 14px;
    }

    .main-card strong {
      font-size: 1rem;
    }
  }
</style>

<div class="cover-title">十方斋｜复利投资AI+</div>

<!-- ![封面图](/topnew2.jpg)

***

 <span class="sub-quote">站在时间这一边，用AI和数据，重新理解复利投资。</span> -->
<!-- 
<div class="cover-highlight">
 <strong>核心思想：</strong>暴富是概率事件，复利是时间过程。先把财富观理清楚，再用 AI 工具判断市场环境与个股结构，最后才执行 ETF 定投或 Sell Put。
</div>
-->

<div class="main-grid">
  
  <a href="https://donew-beta.vercel.app/jin10-news.html" target="_blank" class="main-card weapon-two">
    <strong>AI看新闻</strong>
    <!-- <span>判断单票结构：趋势、动量、相似形态、关键位。</span> -->
  </a>
  
  <a href="https://donew-beta.vercel.app/market-analysis-tool.html" target="_blank" class="main-card weapon-one">
    <strong>AI看市场</strong>
  <!--  <span>先看大环境：利率、黄金、BTC、纳指、风险偏好。</span> -->
  </a>

  <a href="https://donew-beta.vercel.app/kline-robot.html" target="_blank" class="main-card weapon-two">
    <strong>AI看K线</strong>
   <!-- <span>判断单票结构：趋势、动量、相似形态、关键位。</span> -->
  </a>

  <a href="#/docs/other/calm-wealth-mindset.md" class="main-card mindset">
    <strong>复利投资</strong>
    <!--  <span>先把底层财富观理清楚：心态平、守正财、博偏财、长积累，做时间的朋友。</span> -->
  </a>
  
</div>

<div class="quick-row">
  <a href="#/docs/复利/定投ETF.md" class="quick-link">小白ETF定投</a>
  <a href="#/docs/ETF图谱/ETF长期收益图谱.md" class="quick-link">定投收益PK</a>
  <a href="#/docs/SellPut/how-to-sell-put.md" class="quick-link">专家另类投资</a>
  <a href="#/docs/other/lingyin-wealth.md" class="quick-link">必需拜财神</a>
</div>

<div class="site-counter">
  <span>本站访问 <strong id="busuanzi_value_site_pv">--</strong> 次</span>
  <span>访客 <strong id="busuanzi_value_site_uv">--</strong> 人</span>
</div>
