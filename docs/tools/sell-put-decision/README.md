# AI综合卖Put决策

## 工具定位

整合新闻摘要、市场行情、K线技术分析、期权温度四个维度，一次AI调用生成完整的卖Put决策报告。

## 入口

- 页面：`sell-put-decision-tool.html`
- Vercel 页面：`kline_robot_vercel/sell-put-decision-tool.html`
- API：`kline_robot_vercel/api/sell-put-decision.js`

## 与现有工具的关系

这不是替换现有四个工具，而是在它们之上新增的**聚合决策层**：

```
                       ┌─ 新闻 (jin10news 缓存)
                       ├─ 行情 (stockprice 缓存)
sell-put-decision ────┼─ K线形态 (Yahoo Finance)
                       ├─ 期权概览 (Barchart overview)
                       ├─ 期权链自动匹配 (Barchart options/get, 共用 `_lib/barchart-options-chain.js`)
                       └─ AI 综合分析 → 一份决策报告
```

## 处理流程

```
用户输入标的
  → 点击"自动获取期权参数"
  → 前端调用 /api/barchart-overview 填入期权概览（IV/HV 等）
  → 合约字段（行权价/delta/bid/ask/到期日）可留空
  → 点击"生成综合卖Put决策"
  → API 自动从 Barchart 期权链拉取 Delta≈0.15、最近到期(≥5天)的 Put 合约
  → 报告 API 并行拉取：
     1. stockprice/data/latest-price.json（行情快照）
     2. jin10news/data/latest-24h.json（新闻缓存）
     3. Yahoo Finance（K线数据 + ATR 计算）
  → 计算市场风险评分（三灯否决制）
  → 计算 K线技术指标（ATR、SMA、形态检测、支撑/阻力）
  → 按DTE计算ATR安全行权价：现价 - ATR×sqrt(DTE)
  → 组装综合 prompt，一次 AI 调用
  → 返回完整 HTML 报告
```

> 合约字段**支持自动获取**：留空时 API 从 Barchart 期权链自动匹配。手工输入仍可覆盖自动匹配结果。

## 约定

- API 并行加载行情和新闻（`Promise.all`），避免串行等待
- K线数据取最近3个月日线，计算技术指标（SMA5/10/20/50、ATR、量比、形态检测）
- 合约字段缺失时，自动调用 `_lib/barchart-options-chain.js` 从 Barchart 拉取匹配合约
- 截图 OCR 在浏览器本地执行（可选）；API 不读取图片、不调用视觉模型
- 综合决策只调用 DeepSeek；50 秒未返回时直接生成规则版报告
- K 线结构分析最多等待 30 秒；超时后进入完整性预检查
- 规则版不是备用空壳：AI不可用时仍使用市场风险、期权温度、K线结构、新闻事件和具体合约门槛
- API 返回 `timings.dataMs`、`timings.aiMs` 和 `timings.totalMs`，用于定位耗时阶段

## 版本

v2.0.0.9｜2026-07-27｜简化合约输入区
