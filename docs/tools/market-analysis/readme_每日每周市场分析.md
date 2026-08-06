# 最新每日/每周市场情况分析

## 功能定位

这是用户手工触发的即时市场分析工具。它聚合最新行情、市场新闻和卖 Put 风险框架，生成今日市场分析或本周周报，并提供 HTML、Markdown、图片和归档功能。

它与自动早报/晚报生成器共享分析原则，但不是同一个执行入口：本工具服务即时查询，自动生成器负责定时写入网站文档。

## 入口与代码

- 线上入口：`https://sellput.top/market-analysis-tool.html`
- 前端源文件：`kline_robot_vercel/market-analysis-tool.html`
- 根目录镜像：`market-analysis-tool.html`
- 生产 API：`vps-backend/src/api/market-report-v2.js`
- AI 与报告设计：`docs/tools/market-analysis/设计_每日每周市场分析.md`
- 自动报告说明：`docs/市场/readme_日报周报自动生成器.md`

## 处理流程

```text
用户选择今日分析或本周周报
  -> 页面请求 /api/market-report-v2
  -> API 读取 VPS 行情缓存与新闻缓存
  -> 按市场判断策略基线组装提示词
  -> DeepSeek 生成结构化分析
  -> 服务端生成 HTML 与 Markdown
  -> 页面显示、归档或导出报告
```

## 外部对接

- 行情：`GET https://sellput.top/api/stock/prices`
- 新闻：`GET https://sellput.top/api/news/latest`
- AI：DeepSeek API
- 策略基线：`docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md`

## 修改要求

- 修改页面时同步根目录与 `kline_robot_vercel/` 两份 HTML，并升级可见版本号。
- 行情缺失必须标记为未取到，不能用 `0` 代替。
- 修改报告章节或风险口径时，同时检查自动报告链路和 `scripts/validate-market-report.mjs`。
- 页面只访问 `sellput.top` 同源 API，不直接访问 GitHub 数据文件或第三方行情源。

