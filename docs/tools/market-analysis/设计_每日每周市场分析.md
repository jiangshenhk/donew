# 市场分析报告 — AI 提示词

## 策略基线（系统角色）

> 运行时从 sellput.top 文档路径读取：`docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md`

该文件是完整的 AI 系统提示词，包含：
- 角色定位：卖Put交易者市场分析助手
- 固定输出结构：11 个章节（市场在交易什么 → 策略矩阵 → 资产联动 → 卖Put策略等）
- 三灯否决制：VIX/QQQ均线/事件日历硬规则
- 盘前vs盘后日报区别
- 周报要求

## 用户数据

```
## 本次重点分析标的
{focusSymbols}

请在第 9 节重点分析以上标的的卖 Put 可行性。

### 重点标的行情数据
{focusData}

## 当前时间与报告参数
- 生成时间：{now}
- 报告类型：日报/周报
- 市场阶段：{marketPhase}

## 行情快照表
| 标的 | 最新价 | 日变化 | 相对5日线 | 相对10日线 | 相对20日线 |
|...(所有跟踪标的)

## 风险评分与执行等级
- 风险评分：X/10
- 风向灯号：🟢/🟡/🔴
- 执行等级：正常/谨慎/暂停
- 卖Put环境：有利/谨慎/不利

## 卖Put候选标的
{targets}

## 最近新闻
{newsItems}
```

## 输出要求

- 固定 11 节结构
- 策略矩阵表
- 卖Put动作建议（可卖Put/谨慎卖Put/暂不卖Put）
- 含 HTML 标签（class = `section-title`, `metric-grid` 等）

## 调用方式

- 生产文件: `vps-backend/src/api/market-report-v2.js`
- 策略基线通过 `loadStrategyBaseline()` 从 sellput.top 文档路径读取
- 支持手工网页生成 + VPS 定时自动生成双链路
- DeepSeek / OpenAI 双路由
