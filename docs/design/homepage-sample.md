# 首页样板｜十方斋 · 心安复利

<style>
  .zen-page {
    --bg: #F6F0E3;
    --paper: #FFF9ED;
    --paper-2: #FBF4E4;
    --ink: #2B2118;
    --muted: #756854;
    --line: #DDD0B8;
    --gold: #B7791F;
    --gold-dark: #8A5A14;
    --cinnabar: #A33A2A;
    --bodhi: #3F6B4F;
    --shadow: rgba(58, 42, 26, 0.10);
    background:
      linear-gradient(rgba(183,121,31,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(183,121,31,0.045) 1px, transparent 1px),
      var(--bg);
    background-size: 26px 26px;
    margin: -32px -32px 0;
    padding: 44px 24px 64px;
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  }

  .zen-shell { max-width: 1120px; margin: 0 auto; }

  .zen-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 36px;
  }

  .zen-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--ink);
  }

  .zen-seal {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #fff;
    background: radial-gradient(circle at 30% 30%, #C7902F, #8A5A14);
    box-shadow: 0 8px 20px rgba(183,121,31,0.22);
    font-weight: 900;
  }

  .zen-login {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .zen-login a {
    text-decoration: none !important;
    border: 1px solid var(--line);
    background: rgba(255,249,237,0.78);
    color: var(--ink) !important;
    padding: 9px 14px;
    border-radius: 999px;
    font-size: 0.88rem;
    font-weight: 700;
  }

  .zen-login a.primary {
    background: var(--gold);
    border-color: var(--gold);
    color: #fff !important;
  }

  .zen-hero {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 24px;
    align-items: stretch;
  }

  .hero-card {
    background: rgba(255,249,237,0.92);
    border: 1px solid var(--line);
    border-radius: 28px;
    padding: 42px;
    box-shadow: 0 20px 50px var(--shadow);
    position: relative;
    overflow: hidden;
  }

  .hero-card::after {
    content: '';
    position: absolute;
    width: 210px;
    height: 210px;
    border-radius: 50%;
    right: -80px;
    top: -80px;
    background: rgba(183,121,31,0.12);
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(63,107,79,0.09);
    color: var(--bodhi);
    border: 1px solid rgba(63,107,79,0.18);
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 0.86rem;
    font-weight: 800;
    margin-bottom: 18px;
  }

  .hero-title {
    font-size: 3.25rem;
    line-height: 1.08;
    margin: 0 0 18px;
    color: var(--ink);
    letter-spacing: -0.04em;
  }

  .hero-title em {
    font-style: normal;
    color: var(--gold-dark);
  }

  .hero-sub {
    color: var(--muted);
    font-size: 1.05rem;
    line-height: 1.95;
    max-width: 640px;
    margin-bottom: 28px;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .hero-actions a {
    text-decoration: none !important;
    padding: 12px 18px;
    border-radius: 14px;
    font-weight: 800;
    transition: all 0.2s ease;
  }

  .hero-actions a.main {
    background: var(--gold);
    color: #fff !important;
    box-shadow: 0 12px 26px rgba(183,121,31,0.22);
  }

  .hero-actions a.ghost {
    background: #fff;
    color: var(--ink) !important;
    border: 1px solid var(--line);
  }

  .hero-actions a:hover { transform: translateY(-2px); }

  .side-card {
    background: linear-gradient(145deg, #3A2A1A, #23180F);
    color: #FFF9ED;
    border-radius: 28px;
    padding: 32px;
    box-shadow: 0 20px 50px rgba(43,33,24,0.20);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 360px;
    position: relative;
    overflow: hidden;
  }

  .side-card::after {
    content: '复';
    position: absolute;
    right: 20px;
    bottom: -28px;
    font-size: 9rem;
    font-weight: 900;
    color: rgba(255,249,237,0.06);
  }

  .side-card h3 { margin: 0 0 14px; color: #FFF9ED; font-size: 1.35rem; }
  .side-card p { color: rgba(255,249,237,0.72); line-height: 1.85; margin: 0; }

  .metric-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 22px;
  }

  .metric {
    border: 1px solid rgba(255,249,237,0.16);
    border-radius: 16px;
    padding: 14px 10px;
    background: rgba(255,249,237,0.06);
  }

  .metric strong { display: block; color: #F6D99A; font-size: 1.35rem; }
  .metric span { font-size: 0.78rem; color: rgba(255,249,237,0.66); }

  .section-title {
    margin: 46px 0 18px;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
  }

  .section-title h2 { margin: 0; color: var(--ink); font-size: 1.55rem; }
  .section-title p { margin: 0; color: var(--muted); font-size: 0.92rem; }

  .path-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }

  .path-card {
    background: rgba(255,249,237,0.92);
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 24px;
    text-decoration: none !important;
    color: var(--ink) !important;
    box-shadow: 0 12px 30px rgba(58,42,26,0.07);
    transition: all 0.22s ease;
  }

  .path-card:hover { transform: translateY(-4px); border-color: rgba(183,121,31,0.55); }
  .path-card .num { color: var(--cinnabar); font-weight: 900; letter-spacing: 0.08em; font-size: 0.86rem; }
  .path-card h3 { margin: 10px 0 8px; font-size: 1.22rem; color: var(--ink); }
  .path-card p { margin: 0; color: var(--muted); line-height: 1.75; font-size: 0.92rem; }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  .tool-card {
    background: rgba(255,249,237,0.86);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 18px;
    color: var(--ink) !important;
    text-decoration: none !important;
    min-height: 122px;
    position: relative;
  }

  .tool-card strong { display: block; margin-bottom: 8px; color: var(--ink); }
  .tool-card span { display: block; color: var(--muted); font-size: 0.86rem; line-height: 1.6; }
  .free-badge {
    display: inline-block;
    margin-top: 12px;
    color: var(--bodhi);
    background: rgba(63,107,79,0.10);
    border: 1px solid rgba(63,107,79,0.18);
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 800;
  }

  .daily-panel {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .daily-card {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 24px;
    box-shadow: 0 12px 30px rgba(58,42,26,0.07);
  }

  .daily-card h3 { margin: 0 0 10px; color: var(--ink); }
  .daily-card p { margin: 0 0 16px; color: var(--muted); line-height: 1.75; }
  .daily-card a { color: var(--gold-dark) !important; font-weight: 900; text-decoration: none !important; }

  @media (max-width: 920px) {
    .zen-hero, .daily-panel { grid-template-columns: 1fr; }
    .path-grid, .tool-grid { grid-template-columns: 1fr 1fr; }
    .hero-title { font-size: 2.45rem; }
  }

  @media (max-width: 620px) {
    .zen-page { margin: -24px -16px 0; padding: 28px 14px 48px; }
    .zen-topbar { align-items: flex-start; flex-direction: column; }
    .hero-card, .side-card { padding: 24px; border-radius: 22px; }
    .hero-title { font-size: 2.05rem; }
    .path-grid, .tool-grid, .metric-row { grid-template-columns: 1fr; }
  }
</style>

<div class="zen-page">
  <div class="zen-shell">

    <div class="zen-topbar">
      <div class="zen-brand">
        <div class="zen-seal">十</div>
        <div>
          <div>十方斋</div>
          <div style="font-size:0.82rem;color:#756854;font-weight:600;letter-spacing:0;">心安复利 · AI投资工具</div>
        </div>
      </div>
      <div class="zen-login">
        <a href="#">登录</a>
        <a href="#" class="primary">免费体验工具</a>
      </div>
    </div>

    <div class="zen-hero">
      <div class="hero-card">
        <div class="eyebrow">普通人的复利投资系统</div>
        <h1 class="hero-title">站在<em>时间</em><br>这一边</h1>
        <div class="hero-sub">
          用 AI 和数据，重新理解复利投资。暴富是概率事件，复利是时间过程。普通人最现实的财富路径，不是寻找一次小概率暴富，而是尽早站到时间这一边。
        </div>
        <div class="hero-actions">
          <a class="main" href="#/docs/other/calm-wealth-mindset.md">开始阅读：心安复利</a>
          <a class="ghost" href="#/docs/市场/今日.md">查看今日市场</a>
        </div>
      </div>

      <div class="side-card">
        <div>
          <h3>一套系统，三层入口</h3>
          <p>先建立佛系复利的底层思想，再用每日市场判断决定风险环境，最后用 AI 工具把分析变成可执行报告。</p>
        </div>
        <div class="metric-row">
          <div class="metric"><strong>1</strong><span>底层思想</span></div>
          <div class="metric"><strong>2</strong><span>时间武器</span></div>
          <div class="metric"><strong>AI</strong><span>工具辅助</span></div>
        </div>
      </div>
    </div>

    <div class="section-title">
      <h2>三条主线</h2>
      <p>思想吸引人，日报留住人，工具转化人。</p>
    </div>

    <div class="path-grid">
      <a class="path-card" href="#/docs/other/calm-wealth-mindset.md">
        <div class="num">01 · 思想</div>
        <h3>佛系复利</h3>
        <p>心态平和、守住正财、长期积累。先把财富观想清楚，再进入具体方法。</p>
      </a>
      <a class="path-card" href="#/docs/市场/今日.md">
        <div class="num">02 · 日常</div>
        <h3>每日市场</h3>
        <p>日报、周报、市场趋势与固定观察池，用来判断当前环境是否适合执行策略。</p>
      </a>
      <a class="path-card" href="#/docs/市场/卖Put评级说明.md">
        <div class="num">03 · 工具</div>
        <h3>AI工具箱</h3>
        <p>K线相似度、AI筛选 Put、ETF收益比较、周报生成。每个工具可免费体验一次。</p>
      </a>
    </div>

    <div class="section-title">
      <h2>两把时间武器</h2>
      <p>不是追一次暴富，而是选择时间的威力。</p>
    </div>

    <div class="daily-panel">
      <div class="daily-card">
        <h3>ETF 定投</h3>
        <p>用持续投入降低择时压力，长期站在资产增长和时间复利的一边。</p>
        <a href="#/docs/复利/ETF定投方法.md">进入 ETF 定投方法 →</a>
      </div>
      <div class="daily-card">
        <h3>Sell Put</h3>
        <p>用愿意接货的价格等待好资产，把等待过程变成权利金现金流。</p>
        <a href="#/docs/SellPut/how-to-sell-put.md">进入 Sell Put 方法 →</a>
      </div>
    </div>

    <div class="section-title">
      <h2>AI 工具箱</h2>
      <p>登录后每个工具可免费体验一次，后续按 AI 调用成本开放额度。</p>
    </div>

    <div class="tool-grid">
      <a class="tool-card" href="#">
        <strong>K线相似度分析</strong>
        <span>判断当前走势更像哪段历史形态，辅助识别启动、震荡、回调或修复。</span>
        <div class="free-badge">免费 1 次</div>
      </a>
      <a class="tool-card" href="#/docs/市场/卖Put评级说明.md">
        <strong>AI 筛选 Put</strong>
        <span>结合市场环境、IV、期权链和风险垫，寻找更合适的卖 Put 位置。</span>
        <div class="free-badge">免费 1 次</div>
      </a>
      <a class="tool-card" href="#/docs/ETF图谱/B站ETF视频清单.md">
        <strong>ETF 收益比较</strong>
        <span>对比普通、2倍、3倍 ETF 的长期收益、回撤和适配人群。</span>
        <div class="free-badge">免费 1 次</div>
      </a>
      <a class="tool-card" href="#/docs/市场/今日.md">
        <strong>AI 市场日报</strong>
        <span>整理今日宏观、指数、板块、风险和卖 Put 环境评分。</span>
        <div class="free-badge">每日更新</div>
      </a>
    </div>

  </div>
</div>
