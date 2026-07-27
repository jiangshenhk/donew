# Sell Put Agent — 自动卖Put决策引擎

> CLI 脚本 · `scripts/sell-put-agent.mjs`  
> 数据存储 · `~/.donew-agent/`（独立，不 commit）

## 功能

自动每日/盘中分析 QLD / MSTR / INTC 的卖 Put 机会，纸面模拟交易，跟踪胜率和盈亏。

## 命令速查

```bash
export DEEPSEEK_API_KEY=sk-xxx
node scripts/sell-put-agent.mjs daily     # 每日分析 + 模拟交易
node scripts/sell-put-agent.mjs stats     # 统计面板（终端）
node scripts/sell-put-agent.mjs dashboard # 生成 HTML 仪表板
node scripts/sell-put-agent.mjs report    # 生成 Markdown 日报
node scripts/sell-put-agent.mjs setup     # 安装 launchd 自动运行
node scripts/sell-put-agent.mjs env       # 写入 API Key 到本地文件
node scripts/sell-put-agent.mjs version   # 版本
```

## 数据流

```
Barchart 期权链 → 筛选 DTE 5–25, Δ≈0.15 的 Put
       ↓
Yahoo Finance K线 → ATR / SMA 计算
       ↓
GitHub stockprice → 行情快照 (25 标的)
       ↓
DeepSeek API → 生成决策（可卖/谨慎/不卖）
       ↓
存储 ~/.donew-agent/
  ├─ journal/      # 每次分析的完整记录
  ├─ positions.json # 持仓
  ├─ orders.json    # 交易订单
  ├─ stats.json     # 统计数据
  ├─ experience.json # 历史经验
  ├─ reports/       # Markdown 日报
  ├─ dashboard.html # 可视化仪表板
  └─ .env           # API Key
```

## 决策规则

### 硬规则

| 规则 | 阈值 | 动作 |
|:---|:---|:---|
| 行权价 > ATR安全行权价 | — | 强制降级（可卖→谨慎） |
| 总回撤 | ≥ 20% | 停止开仓 |
| 连续亏损 | ≥ 3 笔 | 暂停开仓 |
| 最大持仓 | 3 笔 | 阻断 |
| 同标的不重复 | 已有持仓 | 跳过 |

### 提前平仓

| 触发条件 | 阈值 | 动作 |
|:---|:---|:---|
| 权利金衰减到 | < 20% 原始 | 自动平仓赢 |
| 剩余 DTE ≤ 2 且权利金 < 50% | — | 自动平仓赢 |
| 权利金 > 3x 原始 | — | 止损信号 |

### 开仓条件

- AI 结论 = "可卖Put"（"谨慎/暂不"不执行）
- 行权价 ≤ ATR安全行权价
- 风控关卡全部通过

## 自动化部署

```bash
node scripts/sell-put-agent.mjs setup    # 生成 launchd plist
launchctl load ~/Library/LaunchAgents/com.donew.sellput.plist  # 启用
```

**运行时间**：每晚 21:30 – 04:30（美股盘），每 15 分钟一次，共 29 次。

## 仪表板

打开 `~/.donew-agent/dashboard.html`，四个标签页：
- **持仓**：当前仓位 + 资金总览 + 已结算
- **交易明细**：开仓/平仓/取消记录
- **判断日志**：每次分析 + 筛选 + 分页
- **统计**：数据面板 + 月度日历 + 按标的

## 文件结构

```
scripts/sell-put-agent.mjs          # 单文件 Agent (~1900 行)
kline_robot_vercel/api/_lib/
  └─ barchart-options-chain.js      # Barchart 期权链模块（Agent 和 API 共用）
```

## 版本

v0.3.0 · 2026-07-27
