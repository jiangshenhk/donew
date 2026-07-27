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
                      ├─ 期权数据 (前台自动获取 + 手工校正)
                      └─ AI 综合分析 → 一份决策报告
```

## 处理流程

```
用户输入标的
  → 点击“自动获取期权参数”
  → 前端单独调用 /api/barchart-overview
  → 成功后填入当前标的默认期权参数
  → 可选：点击“手工修改”
     1. 上传/粘贴截图，由浏览器 Tesseract.js 本地 OCR
     2. 或逐项修改字段
  → 点击生成，前端只提交结构化字段，不提交截图
  → 报告 API 并行拉取：
     1. stockprice/data/latest-price.json（行情快照）
     2. jin10news/data/latest-24h.json（新闻缓存）
     3. Yahoo Finance（K线数据 + ATR 计算）
  → 计算市场风险评分（三灯否决制）
     - 基准分5.0
     - VIX需日涨>8%，或VIX>20且日涨>5%，才判定快速上升
     - IV/HV、IV Rank/Percentile、Expected Move、Put/Call结构参与规则版评分
  → 计算 K线技术指标（ATR、SMA、形态检测、支撑/阻力）
  → 按DTE计算ATR安全行权价：现价 - ATR×sqrt(DTE)，最低1.5×ATR
  → 组装综合 prompt，一次 AI 调用
  → 返回完整 HTML 报告
```

## 约定

- API 并行加载行情和新闻（`Promise.all`），避免串行等待
- K线数据取最近3个月日线，计算技术指标（SMA5/10/20/50、ATR、量比、形态检测）
- 未成功点击“自动获取期权参数”时，前端禁止启动报告生成
- “手工修改”是校正入口，不代替自动获取前置步骤
- 切换市场或标的后清除旧期权温度字段，必须重新自动获取
- 截图 OCR 在浏览器本地执行；`sell-put-decision.js` 不读取图片、不调用视觉模型
- 综合决策只调用 DeepSeek；50 秒未返回时直接生成规则版报告，不再串行回退其他模型
- K 线结构分析最多等待 30 秒；超时后进入完整性预检查，避免整次请求撞上 Vercel 120 秒上限
- 规则版不是备用空壳：AI不可用时仍使用市场风险、期权温度、K线结构、新闻事件和具体合约门槛
- AI 结论提取兼容“不建议卖Put、暂时不宜、观望”等保守措辞，避免保守结论被误判为空
- `尾部风险灯号（启发式）`只是风险可视化，不是真正的黑天鹅检测
- API 返回 `timings.dataMs`、`timings.aiMs` 和 `timings.totalMs`，用于定位耗时阶段
- 如果 AI 均不可用，返回规则版报告（含技术指标和行情快照）

## 版本

v2.0.0.9｜2026-07-27｜简化合约输入区
