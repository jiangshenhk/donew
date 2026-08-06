# AI综合卖Put决策

## 工具定位

整合新闻摘要、市场行情、K线相似度与技术分析、期权温度及具体合约门槛。三个分析模块可并行执行，最终由统一规则引擎裁决并生成完整卖Put决策报告。

## 入口

- 页面：`sell-put-decision-tool.html`
- VPS 页面镜像：`kline_robot_vercel/sell-put-decision-tool.html`
- 生产 API：`vps-backend/src/api/sell-put-decision.js`

## 与现有工具的关系

这不是替换现有四个工具，而是在它们之上新增的**聚合决策层**：

```
                       ┌─ 新闻 (jin10news 缓存)
                       ├─ 行情 (stockprice 缓存)
sell-put-decision ────┼─ K线形态 (Yahoo Finance)
                       ├─ 期权概览 (Barchart overview)
                       ├─ 期权链自动匹配 (Barchart options/get, 共用 `_lib/barchart-options-chain.js`)
                       └─ 三个分析模块 + 统一规则裁决 → 一份决策报告
```

## 处理流程

```
用户输入标的
  → 点击"自动获取期权参数"
  → 前端调用 /api/barchart-overview 填入期权概览（IV/HV 等）
  → 合约字段（行权价/delta/bid/ask/到期日）可留空
  → 点击"生成综合卖Put决策"
  → API 自动从 Barchart 期权链拉取 Delta≈0.15、最近到期(≥5天)的 Put 合约
  → prepare 阶段加载：
     1. stockprice/data/latest-price.json（行情快照）
     2. jin10news/data/latest-24h.json（新闻缓存）
     3. 期权温度与新闻事件预分析
  → 前端并行请求三个模块：
     1. 市场与黑天鹅风险
     2. K线相似度、历史条件样本、ABC/2B结构、ATR与支撑阻力
     3. 期权温度与具体合约
  → finalize 阶段使用K线模块实际ATR重新计算合约硬门槛
  → 执行关键数据完整性检查；不完整时只输出预检查，不伪造完整结论
  → 统一规则引擎裁决，AI只能补充解释或收紧结论，不能绕过硬门槛
  → 返回固定六节 HTML 报告
```

> 合约字段**支持自动获取**：留空时 API 从 Barchart 期权链自动匹配。手工输入仍可覆盖自动匹配结果。

## 约定

- API 并行加载行情和新闻（`Promise.all`），避免串行等待
- K线数据取最近3个月日线，计算技术指标（SMA5/10/20/50、ATR、量比、形态检测）
- 合约字段缺失时，自动调用 `_lib/barchart-options-chain.js` 从 Barchart 拉取匹配合约
- 截图 OCR 在浏览器本地执行（可选）；API 不读取图片、不调用视觉模型
- 三个分析模块分别调用 DeepSeek；单模块失败时只将该模块降级为规则版
- K 线结构分析最多等待 30 秒；超时后进入完整性预检查
- 规则版不是备用空壳：AI不可用时仍使用市场风险、期权温度、K线结构、新闻事件和具体合约门槛
- 最终裁决重新使用真实 ATR、DTE、Delta、Bid/Ask 和 Expected Range，不依赖模块完成顺序
- 报告固定包含：综合结论、市场环境、期权温度、K线技术信号、综合建议、未来关注清单，以及折叠的数据来源与时间
- API 返回模块状态、警告和总耗时，前端展示模块进度

## 版本

v2.1.1｜2026-08-06 01:56｜恢复完整四维决策与六节报告
