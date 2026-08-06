# Long-Term Trader - 长线交易 Agent

## 功能定位

这是基于日线趋势、日线技术指标和 DeepSeek 评分的自动纸面交易 Agent。它按市场筛选标的，记录开仓、平仓、信号和统计数据，并生成独立 HTML 仪表板。

## 入口与存储

- 主程序：`scripts/long-term-trader.mjs`
- 运行：`node scripts/long-term-trader.mjs run`
- 美股模式：`node scripts/long-term-trader.mjs run us`
- 港股模式：`node scripts/long-term-trader.mjs run hk`
- 本地数据：`~/.donew-trader-long/`，不提交到 Git
- 调度包装：`run-long-trader.sh`
- AI 设计：`docs/tools/long-term-trader/设计_长线交易Agent.md`

## 处理流程

```text
读取标的与持仓配置
  -> Yahoo Finance 获取最近3个月日线
  -> 检查已有持仓的 ATR 止损/止盈
  -> 计算 EMA9/21/55、MACD、RSI、ATR、量比和关键价位
  -> 日线多头与技术规则过滤
  -> DeepSeek 对通过或待观察标的评分
  -> 分数及规则满足时建立纸面仓位
  -> 保存信号、订单、持仓、K线与统计
  -> 更新仪表板并发送 ntfy 通知
```

## 核心规则

- 日线多头：`EMA9 > EMA21` 且价格高于 `EMA9`。
- 入场技术规则：EMA 必须通过，MACD、RSI、EMA、量比四项至少通过三项。
- AI 评分达到程序阈值后才允许开仓，规则不通过时 AI 不能越权开仓。
- 止损距离为 `max(3 x ATR / 入场价, 3%)`，止盈为风险距离的两倍。
- 使用纸面交易，不连接真实券商下单。

## 外部对接

- 日线行情：Yahoo Finance chart API。
- AI：DeepSeek Chat API，环境变量 `DEEPSEEK_API_KEY`。
- 通知：ntfy。
- 定时运行：VPS 系统调度，当前约定为香港时间每日 17:00。

## 修改要求

- Prompt、评分阈值或规则变化时同步更新设计文档。
- 不提交 `~/.donew-trader-long/` 下的持仓、密钥和运行数据。
- 不把 AI 评分当作硬规则的替代品。
- 调整默认标的、仓位或风险参数时，检查已有持仓数据的向后兼容。

## 可靠性机制（v2.0.5）

| 机制 | 说明 |
|:---|:---|
| **运行锁** | `~/.donew-trader-long/long-term-trader.lock`，内容为 `pid/mode/startedAt`。`run` / `dashboard` 写入前先拿锁，防止并发写坏文件。锁仅在同 pid 且未超时（10 分钟）时有效；进程不存在或超时后自动清理。 |
| **原子写** | `saveJson` / `atomicWriteText` 先写临时文件再 `rename` 覆盖，中断不会产生半截 JSON 或 HTML。适用于 `positions/orders/stats/signals/kline/dashboard.html`。 |
| **统一超时** | `fetchWithTimeout(url, options, timeoutMs, label)`：Yahoo 15s、DeepSeek 30s、ntfy 10s。超时报错带 label（如 `Yahoo K线超时(15000ms)`），脚本不会卡死。 |
| **K线新鲜度前置** | 日线最后一个 bar 距今 >4 天视为过期（周末/节假日宽限）。过期时不生成 BUY、不开仓，dashboard 标注 `旧K线 / 仅供历史查看`。 |
| **数据来源元数据** | K线缓存、信号文件、dashboard 数据写入 `source / fetchedAt / lastDataTime / ok / error / stale / staleReason`。 |

## 版本

v2.0.5 · 2026-08-06 · 运行锁 / 原子写 / Yahoo超时 / K线新鲜度前置

