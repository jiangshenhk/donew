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
                      ├─ 期权数据 (截图 OCR 或手动录入)
                      └─ AI 综合分析 → 一份决策报告
```

## 处理流程

```
用户输入标的 + 可选截图/期权数据
  → API 并行拉取：
     1. stockprice/data/latest-price.json（行情快照）
     2. jin10news/data/latest-24h.json（新闻缓存）
     3. Yahoo Finance（K线数据 + ATR 计算）
  → 如果上传了截图，调用 OpenAI Vision 做 OCR
  → 计算市场风险评分（三灯否决制）
  → 计算 K线技术指标（ATR、SMA、形态检测、支撑/阻力）
  → 组装综合 prompt，一次 AI 调用
  → 返回完整 HTML 报告
```

## 约定

- API 并行加载行情和新闻（`Promise.all`），避免串行等待
- K线数据取最近3个月日线，计算技术指标（SMA5/10/20/50、ATR、量比、形态检测）
- 截图 OCR 走 OpenAI Vision，仅当未手动录入字段时触发
- AI 优先 DeepSeek，回退 GPT
- 如果 AI 均不可用，返回规则版报告（含技术指标和行情快照）

## 版本

v1.0.0｜2026-07-21
