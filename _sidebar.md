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
.sidebar-nav > ul > li > p {
  border-left: 3px solid transparent;
  transition: border-color 0.3s ease;
}
.sidebar-nav > ul > li:hover > p { border-left-color: #2563eb; }
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

- <b><font color="blue"><i class="fas fa-compass"></i> 开始这里</font></b>
  - [了解网站](/docs/开始/我在记录什么.md)
  - [复利为王](/docs/开始/神奇的复利效应.md)
  - [两大工具](/docs/开始/为什么我把定投和SellPut放在一起.md)
  - [新手指南](/docs/开始/新手阅读顺序.md)

- <b><font color="blue"><i class="fas fa-chart-line"></i> 市场结构观察</font></b>
  - [📊 今日市场](/docs/市场/今日.md)
  - [📚 历史归档](/docs/市场/历史.md)
  - [每日市场判断怎么看](/docs/市场/每日市场判断怎么看.md)
  - [卖Put评级说明](/docs/市场/卖Put评级说明.md)
  - [QLD卖Put操作框架](/docs/市场/QLD卖Put操作框架.md)
  - [MSTR卖Put操作框架](/docs/市场/MSTR卖Put操作框架.md)
  - [风险评分说明](/docs/市场/风险评分说明.md)

- <b><font color="blue"><i class="fas fa-calculator"></i> Sell Put</font></b>
  - [大师最爱](/docs/SellPut/学习大师如何买股票.md)
  - [何为SellPut](/docs/SellPut/如何SellPut.md)
  - [数学概率](/docs/SellPut/卖PUT策略解析.md)

- <b><font color="blue"><i class="fas fa-seedling"></i> 定投</font></b>
  - [底层逻辑](/docs/复利/定投的底层逻辑.md)
  - [长期持有](/docs/复利/为什么长期持有能产生复利.md)
  - [最爱ETF](/docs/复利/ETF定投方法.md)

- <b><font color="blue"><i class="fas fa-layer-group"></i> 相关ETF</font></b>
  - [港美股基础](/docs/资产与市场/港美股基础.md)
  - [ETF](/docs/资产与市场/ETF.md)
  - [比特币与高波动资产](/docs/资产与市场/比特币与高波动资产.md)
  - [纳指/标普/恒科](/docs/资产与市场/纳指标普恒科.md)

- <b><font color="blue"><i class="fas fa-toolbox"></i> 相关工具</font></b>
  - [港美股券商介绍](/docs/券商与工具/港美股券商介绍.md)
  - [券商开户教程](/docs/券商与工具/券商开户教程.md)
  - [香港银行账户介绍](/docs/券商与工具/香港银行账户介绍.md)
  - [入金与出金说明](/docs/券商与工具/入金与出金说明.md)

- <b><font color="blue"><i class="fas fa-envelope"></i> 其他</font></b>
  - [联系](/docs/其他/联系.md)
