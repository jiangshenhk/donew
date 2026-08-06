# 长线交易 Agent - AI 与决策设计

## 系统角色

AI 是专业长线股票分析师，只根据日线趋势与日线技术指标评分，不引用新闻、基本面或训练记忆中的事件。

## 输入数据

- 标的代码。
- 日线方向和 EMA9、EMA21。
- EMA9、EMA21、EMA55 及价格相对均线位置。
- MACD 的 DIF、DEA、HIST。
- RSI(14)、ATR(14)、量比。
- 支撑位和阻力位。

## 评分含义

| 分数 | 含义 |
| --- | --- |
| 1-3 | 日线空头或趋势不明 |
| 4-6 | 中性，信号不明确 |
| 7-8 | 日线向上，MACD 与 RSI 配合 |
| 9-10 | 日线趋势和多项指标共同确认 |

## 输出契约

AI 必须只返回 JSON：

```json
{
  "score": 7,
  "reasoning": "中文理由，不超过100字"
}
```

程序会把分数限制在 1 至 10，并截断过长理由。解析失败或 AI 调用失败时，评分为 0，不允许开仓。

## 决策边界

- AI 只评分，不能绕过日线多头和技术规则门槛。
- 日线空头时固定记录 `SKIP`。
- 已持有同一标的时不重复开仓。
- 达到最大持仓数后不继续分析新开仓。
- 所有交易均为纸面模拟。

## 对应代码

- Prompt：`scripts/long-term-trader.mjs` 中的 `buildScorePrompt()`。
- AI 调用：`callDeepSeek()` 与 `scoreEntry()`。
- 技术规则：`computeDailyIndicators()` 与 `checkEntryRules()`。
- 仓位和止损止盈：`openPosition()` 与 `calcLongTermStopLevels()`。

