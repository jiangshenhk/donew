<!-- docs/_sidebar.md -->

<style>
/* 标题渐变色 - 增强视觉效果 */
.sidebar-title {
  font-size: 38px;
  font-weight: bold;
  background-image: linear-gradient(
    to right,
    #4a46e5,
    #7b68ee,
    #e6007e
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 1px;
  transition: all 0.3s ease;
}

.sidebar-title:hover {
  letter-spacing: 2px;
}

/* 图片样式 - 增加过渡效果 */
.sidebar-icon {
  width: 100px;
  height: 20px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  transition: transform 0.3s ease, filter 0.3s ease;
}

.sidebar-icon:hover {
  transform: scale(1.05);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

/* 链接容器 */
.sidebar-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  width: 100%;
  transition: all 0.3s ease;
}

/* 导航菜单样式优化 */
.app-nav a, 
.sidebar-nav li a {
  transition: all 0.2s ease;
}

.sidebar-nav li a:hover {
  transform: translateX(4px);
  color: #e6007e !important;
}

/* 一级菜单项样式 - 增加左侧装饰条 */
.sidebar-nav > ul > li {
  position: relative;
}

.sidebar-nav > ul > li > p {
  border-left: 3px solid transparent;
  transition: border-color 0.3s ease;
}

.sidebar-nav > ul > li:hover > p {
  border-left-color: #e6007e;
}

/* 二级菜单项缩进优化 */
.sidebar-nav li li {
  margin-left: 8px;
}

/* 分隔线美化 */
.sidebar-nav hr {
  margin: 12px 0;
  border: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, #7b68ee, transparent);
}

/* 滚动条美化（仅 WebKit 浏览器） */
.sidebar::-webkit-scrollbar {
  width: 4px;
}

.sidebar::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #4a46e5, #e6007e);
  border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #e6007e, #4a46e5);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .sidebar-title {
    font-size: 1.5rem;
    padding: 0.8rem 1.2rem;
  }
  
  .sidebar-icon {
    width: 80px;
    height: 16px;
  }
  
  .sidebar-nav li a:hover {
    transform: translateX(2px);
  }
}
</style>

<a href="#/" class="sidebar-link"><span class="sidebar-title"> 十方斋</span></a>
<img src="icon.jpg" alt="十方斋图标" class="sidebar-icon"> 

---

- <b><font color="blue"><i class="fas fa-business-time"></i> 开始这里</font></b>
  - [我在记录什么](/docs/开始/我在记录什么.md)
  - [什么是复利](/docs/开始/神奇的复利效应.md)
  - [为什么我把定投和SellPut放在一起](/docs/开始/为什么我把定投和SellPut放在一起.md)
  - [新手阅读顺序](/docs/开始/新手阅读顺序.md) 

- <b><font color="blue"><i class="fas fa-chart-line"></i> 长期复利框架</font></b> 
  - [定投的底层逻辑](/docs/复利/定投的底层逻辑.md)
  - [为什么长期持有能产生复利](/docs/复利/为什么长期持有能产生复利.md)
  - [ETF定投方法](/docs/复利/ETF定投方法.md)
  
- <b><font color="blue"><i class="fas fa-chart-line"></i>Sell Put策略</font></b> 
  - [投资大师竟然是这么“买”股票的！](/docs/SellPut/学习大师如何买股票.md)
  - [如何Sell Put?](/docs/SellPut/如何SellPut.md)
  - [SellPut和定投结合](/docs/SellPut/SellPut和定投结合.md)
  <!-- - [行权价怎么选](/docs/SellPut/行权价怎么选.md) -->
  <!-- - [安全垫怎么计算](/docs/SellPut/安全垫怎么计算.md) -->
  <!-- - [年化收益怎么判断](/docs/SellPut/年化收益怎么判断.md) -->
  <!-- - [什么情况下提前买回](/docs/SellPut/什么情况下提前买回.md) -->
  <!-- - [Sell Put 风险与边界](/docs/SellPut/SellPut风险与边界.md) -->
 
- <b><font color="blue"><i class="fas fa-chart-line"></i>市场结构观察</font></b> 
  - [每日市场判断怎么看](/docs/市场/每日市场判断怎么看.md)
  - [📊 今日市场](/docs/市场/今日.md)
  - [📚 历史归档](/docs/市场/历史.md)

- <b><font color="blue"><i class="fas fa-chart-line"></i> 资产与市场</font></b> 
  - [港美股基础](/docs/资产与市场/港美股基础.md)
  - [ETF](/docs/资产与市场/ETF.md)
  - [美债投资指南](/docs/资产与市场/美债投资指南.md)
  - [黄金与避险资产](/docs/资产与市场/黄金与避险资产.md)
  - [比特币与高波动资产](/docs/资产与市场/比特币与高波动资产.md)
  - [纳指/标普/恒科](/docs/资产与市场/纳指标普恒科.md)
    

- <b><font color="blue"><i class="fas fa-chart-line"></i> 券商与工具</font></b>  
  - [港美股券商介绍](/docs/券商与工具/港美股券商介绍.md)  
  - [券商开户教程](/docs/券商与工具/券商开户教程.md)  
  - [香港银行账户介绍](/docs/券商与工具/香港银行账户介绍.md)
  - [入金与出金说明](/docs/券商与工具/入金与出金说明.md)

- <b><font color="blue"><i class="fas fa-chart-line"></i> 其他</font></b>  
  - [联系](/docs/其他/联系.md)
