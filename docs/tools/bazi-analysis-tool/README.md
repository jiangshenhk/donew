# 八字命理深度分析

这个目录是由 `scripts/create-tool-scaffold.mjs` 自动生成的示例 README。

## 工具定位

基于中国传统八字命理学，结合人工智能深度分析个人命运、婚姻、事业、健康、风水的综合工具。

## 计划入口

- 页面：`bazi-analysis-tool.html`
- Vercel 页面：`kline_robot_vercel/bazi-analysis-tool.html`
- API：`kline_robot_vercel/api/bazi-analysis.js`

## 当前脚手架已经包含

- 统一页面布局
- `apiBase` 参数兼容
- 最近一次报告自动恢复
- 新窗口打开 / 下载 HTML
- API 的最小返回结构

## 你接下来应该改哪里

### 如果要接真实行情

优先读取：

- `stockprice/data/latest-price.json`

### 如果要接真实新闻

优先读取：

- `jin10news/data/latest-24h.json`

### 如果要接 AI

优先在：

- `kline_robot_vercel/api/bazi-analysis.js`

里完成，不要把密钥放到前端页面。

## 建议扩展顺序

1. 补输入校验
2. 接统一缓存
3. 接 AI / 规则逻辑
4. 补下载图片
5. 补历史记录
6. 补 README 的真实处理流程
