<!-- docs/_sidebar.md -->

<style>
.sidebar-title {
  font-size: 34px;
  font-weight: 800;
  background-image: linear-gradient(to right, #2563eb, #7c3aed, #db2777);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 1px;
  transition: all 0.3s ease;
}

.sidebar-title:hover { letter-spacing: 2px; }

.sidebar-icon {
  width: 100px;
  height: 20px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
  transition: transform 0.3s ease, filter 0.3s ease;
}

.sidebar-icon:hover {
  transform: scale(1.05);
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
}

.sidebar-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  width: 100%;
  transition: all 0.3s ease;
}

.app-nav a,
.sidebar-nav li a { transition: all 0.2s ease; }

.sidebar-nav li a:hover {
  transform: translateX(4px);
  color: #2563eb !important;
}

.sidebar-nav > ul > li { position: relative; }
.sidebar-nav > ul > li > p,
.sidebar-nav > ul > li > a {
  border-left: 3px solid transparent;
  transition: border-color 0.3s ease;
}
.sidebar-nav > ul > li:hover > p,
.sidebar-nav > ul > li:hover > a { border-left-color: #2563eb; }
.sidebar-nav li li { margin-left: 8px; }

.sidebar-nav hr {
  margin: 12px 0;
  border: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, #7c3aed, transparent);
}

.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-track { background: #f5f5f5; border-radius: 4px; }
.sidebar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #2563eb, #7c3aed); border-radius: 4px; }
.sidebar::-webkit-scrollbar-thumb:hover { background: linear-gradient(to bottom, #7c3aed, #2563eb); }

@media (max-width: 768px) {
  .sidebar-title { font-size: 1.5rem; padding: 0.8rem 1.2rem; }
  .sidebar-icon { width: 80px; height: 16px; }
  .sidebar-nav li a:hover { transform: translateX(2px); }
}
</style>

<a href="#/" class="sidebar-link"><span class="sidebar-title">十方斋</span></a>
<img src="icon.jpg" alt="十方斋图标" class="sidebar-icon"> 

---

- **[🔥 热门栏目](/docs/sections/hot.md)**
  - [用AI判断今日市场趋势](/docs/市场/今日.md)
  - [杠杆ETF定投收益比较结果惊人](/docs/ETF图谱/B站ETF视频清单.md)
  - [大佬偏爱卖Put而不直接买股](/docs/SellPut/how-to-sell-put.md)

- **[🌿 心安复利](/docs/sections/compound.md)**
  - [树立正确的财富观](/docs/other/calm-wealth-mindset.md)
  - [真复利投资法](/docs/开始/神奇的复利效应.md)
  - [灵隐寺财富之旅](/docs/other/lingyin-wealth.md)
  - [新手阅读顺序](/docs/开始/新手阅读顺序.md)
  
- **[📈 方法一：ETF定投](/docs/sections/etf-dca.md)**
  - [ETF定投大法](/docs/复利/ETF定投方法.md)
  - [如何选择ETF标的](/docs/复利/how-to-choose-etf-for-dca.md)
  - [如何看待指数回撤](/docs/复利/how-to-handle-etf-drawdown.md)

- **[💰 方法二：卖Put收利息](/docs/sections/sell-put.md)**
  - [大佬偏爱卖Put](/docs/SellPut/how-to-sell-put.md)
  - [用AI筛选Put](/docs/市场/卖Put评级说明.md)
  - [QLD操作框架](/docs/市场/QLD卖Put操作框架.md)

- **[🤖 AI市场趋势判断](/docs/sections/market-ai.md)**
  - [今日市场趋势](/docs/市场/今日.md)
  - [历史市场趋势](/docs/市场/历史.md)
  - [怎么看市场日报](/docs/市场/每日市场判断怎么看.md)

- **[✉️ 联系](/docs/other/contact.md)**
  - [联系我](/docs/other/contact.md)
