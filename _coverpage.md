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
  
 
   /* 主标题样式（第一行） */
  .core-quote {
    /* 字体选择：思源黑体 → 适合严肃内容 */
    font-family: 'Noto Sans SC', serif;
    /* 字体大小：根据封面图高度调整，建议占页面高度15%-20% */
    font-size: 2.8rem;
    /* 字重：600（半粗）→ 平衡优雅与易读 */
    font-weight: 600;
    /* 字间距：0.05em → 避免过紧 */
    letter-spacing: 0.05em;
    /* 颜色：深灰蓝（#2D3748）→ 专业感强，比纯黑柔和 */
    color: #2D3748;
    /* 行高：1.3 → 优化长句间距 */
    line-height: 1.3;
    /* 下边距：与下方副标题分隔 */
    margin-bottom: 0.8rem;
    /* 文字阴影：轻微提升层次感 */
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  /* 副标题样式（第二行） */
  .sub-quote {
    /* 字体选择：思源黑体（无衬线）→ 现代简洁 */
    font-family: 'Noto Sans SC', sans-serif;
    /* 字体大小：主标题的60% → 保持层级 */
    font-size: 1rem;
    /* 字重：400（常规）→ 自然不生硬 */
    font-weight: 400;
    /* 字间距：0.03em → 更紧凑 */
    letter-spacing: 0.03em;
    /* 颜色：中灰（#4A5568）→ 辅助信息弱化 */
    color: #4A5568;
    /* 行高：1.6 → 提升数字可读性 */
    line-height: 1.6;
    /* 文字阴影：更浅 → 保持轻盈 */
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }
 
  /*  添加文字渐变（主标题） */
.core-quote {
  background: linear-gradient(135deg, #2D3748 0%, #4A5568 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* 添加下划线装饰（副标题数字部分） */
.sub-quote {
  position: relative;
  display: inline-block;
}
.sub-quote::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent 30%, #4299E1 50%, transparent 70%);
  opacity: 0.3;
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
">十方斋 |复利</div>

![封面图](/topnew2.jpg)

***
<span class="sub-quote">25岁起每月定投2000元（年化9%），67年积累≈800万</span>

<span class="sub-quote">复利是反人性的胜利</span>



<!-- 3列网格布局的按钮组 -->
<div class="btn-grid">
  <!-- 第一行 - 3个按钮 -->
  <a href="#/docs/复利/神奇的复利效应.md" class="cover-btn btn-main">开始</a>
  <a href="#/docs/港股/b.md" class="cover-btn btn-sub">港美股</a>
  <a href="#/docs/美债/美债投资指南.md" class="cover-btn btn-sub">美债</a>
  
  <!-- 第二行 - 3个按钮 -->
  <a href="#/docs/ETF/美国国债ETF.md" class="cover-btn btn-sub">ETF</a>
  <a href="#/docs/银行卡/香港银行账户介绍.md" class="cover-btn btn-sub">银行卡</a>
  <a href="#/docs/其他/联系.md" class="cover-btn btn-sub">其他</a>
</div>



