<!-- _coverpage.md -->
<style>
  /* 按钮网格容器 */
  .btn-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr); /* 3列布局 */
    gap: 15px;
    max-width: 600px; /* 加宽容器容纳3个按钮 */
    margin: 40px auto;
  }

  /* 所有按钮基础样式 */
  .cover-btn {
    padding: 14px 10px; /* 统一高度 */
    text-align: center;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.3s ease;
    text-decoration: none !important;
    min-height: 46px; /* 确保统一高度 */
    box-sizing: border-box; /* 包含内边距 */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 主按钮样式 */
  .btn-main {
    background: #2563eb; /* 深蓝色背景 */
    color: white !important;
    grid-column: span 1; /* 占1列(与其他按钮相同) */
  }

  /* 次级按钮样式 */
  .btn-sub {
    background: white;
    border: 1px solid #e2e8f0;
    color: #334155 !important;
  }

  /* 悬停效果 - 所有按钮 */
  .cover-btn:hover {
    transform: translateY(-4px); /* 上浮效果 */
    box-shadow: 0 6px 12px rgba(37, 99, 235, 0.25); /* 蓝色阴影 */
  }
  
  /* 主按钮悬停特效 */
  .btn-main:hover {
    background: #1d4ed8; /* 颜色加深 */
  }
  
  /* 次级按钮悬停特效 */
  .btn-sub:hover {
    border-color: #3b82f6; /* 蓝色边框 */
    background: #f8fafc; /* 背景变浅 */
  }
</style>

<!-- 标题区域保持不变 -->
<div style="
  background: linear-gradient(90deg, #6CBEDF, #8A7ECE, #684D9F);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  display: inline-block;
  font-family: 'Helvetica Neue', sans-serif;
  font-size: 5rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-align: center;
  white-space: nowrap;
">沧海一粟</div>

![封面图](/topnew2.jpg)

<span>复利是常识的回报，长期是反人性的胜利</span>

<span>25岁起每月定投2000元（年化9%），67年积累≈800万美元</span>

<!-- 3列网格布局的按钮组 -->
<div class="btn-grid">
  <!-- 第一行 - 3个按钮 -->
  <a href="#/docs/港股/b.md" class="cover-btn btn-main">开始</a>
  <a href="#/docs/港股/盈立证券(香港)开户教程(2025).md" class="cover-btn btn-sub">港美股</a>
  <a href="#/docs/美债/美债投资指南.md" class="cover-btn btn-sub">美债</a>
  
  <!-- 第二行 - 3个按钮 -->
  <a href="#/docs/ETF/美国国债ETF.md" class="cover-btn btn-sub">ETF</a>
  <a href="#/docs/银行卡/香港银行账户介绍.md" class="cover-btn btn-sub">银行卡</a>
  <a href="#/docs/其他/联系.md" class="cover-btn btn-sub">其他</a>
</div>



