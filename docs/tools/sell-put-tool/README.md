# 卖 Put 温度判断工具

## 功能概述

基于 Barchart 截图 OCR 自动提取期权字段（IV、HV、IV Percentile、Expected Move 等），结合行情快照调用 AI 对单一标的的卖 Put 溢价温度进行判断。

## 线上入口

`https://sellput.top/sell-put-tool.html`

## 设计思路

**数据流**：用户上传 Barchart 截图 → Tesseract.js 浏览器端 OCR → 提取字段 + 最新行情快照 → AI 给出温度判断

**评分维度**：
1. IV 溢价（IV Percentile、IV Rank）：高 IV 意味着卖方回报更高
2. Expected Move vs ATR 安全垫：如果预期波动超出 ATR 范围，溢价风险高
3. Put/Call 比率：Put 异常成交量或未平仓量关注门槛
4. 行情背景（价格、涨跌幅、市场趋势）

**截图 OCR**：Tesseract.js 在浏览器本地执行，不耗服务端资源。OCR 结果自动填入手动校对面板，用户可修正后再请求 AI 分析。

## API

`kline_robot_vercel/api/put-rating.js`

- 前端 POST 传入 OCR 字段 + 行情快照 + 用户自定义参数
- 优先调用 OpenAI Vision / GPT 模型
- 失败回退 DeepSeek
- 返回 HTML 报告 + JSON 结构化结果

## 前端入口

- `sell-put-tool.html`（根目录镜像）
- `kline_robot_vercel/sell-put-tool.html`（Vercel 部署）

## 标准功能

- 新窗口打开报告
- 下载 HTML
- 保存为图片（html2canvas）
- 图片分享
