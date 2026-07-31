# Sell Put Agent — 自动卖Put决策引擎

> CLI 脚本 · `scripts/sell-put-agent.mjs`  
> 数据存储 · `~/.donew-agent/`（独立，不 commit）

## 功能

自动每日/盘中分析交易池标的的卖 Put 机会，纸面模拟交易，跟踪胜率和盈亏。

## 标的池体系

| 池 | 存储 | 用途 | 管理方式 |
|:---|:---|:---|:---|
| **交易池** | `pool.json` → `trading` | 可自动开仓的标的 | `symbols add/remove/list` |
| **扫描池** | `pool.json` → `watchlist` | IV溢价排名观察 | `watchlist add/remove/list` |
| **行情中心** | `stockprice/config/symbols.json` | 实时价格/K线数据源 | GitHub Actions 管理 |

> 交易池 ⊆ 扫描池：交易池的标的必须也在扫描池中才能获取完整数据。

## 命令速查

```bash
export DEEPSEEK_API_KEY=sk-xxx
node scripts/sell-put-agent.mjs daily        # 每日分析 + 模拟交易
node scripts/sell-put-agent.mjs stats        # 统计面板（终端）
node scripts/sell-put-agent.mjs scan         # 扫描 IV 溢价排名
node scripts/sell-put-agent.mjs dashboard    # 生成 HTML 仪表板
node scripts/sell-put-agent.mjs report       # 生成 Markdown 日报
node scripts/sell-put-agent.mjs symbols      # 管理交易池 (list/add/remove)
node scripts/sell-put-agent.mjs watchlist    # 管理扫描池 (list/add/remove)
node scripts/sell-put-agent.mjs setup        # 安装 launchd 自动运行
node scripts/sell-put-agent.mjs env          # 写入 API Key 到本地文件
node scripts/sell-put-agent.mjs version      # 版本
```

## 数据流

```
Barchart 期权链 → 筛选 DTE 5–25, Δ≈0.15 的 Put
       ↓
Yahoo Finance K线 → ATR / SMA 计算
       ↓
GitHub stockprice → 行情快照
       ↓
DeepSeek API → 生成决策（可卖/谨慎/不卖）
       ↓
存储 ~/.donew-agent/
  ├─ pool.json          # 统一标的池配置（交易 + 扫描）
  ├─ journal/           # 每次分析的完整记录
  ├─ positions.json     # 持仓
  ├─ orders.json        # 交易订单
  ├─ stats.json         # 统计数据
  ├─ scan-result.json   # 扫描结果缓存
  ├─ kline/             # K线数据缓存（每标的）
  ├─ reports/           # Markdown 日报
  ├─ dashboard.html     # 可视化仪表板
  └─ .env               # API Key
```

## 决策规则

### 硬规则

| 规则 | 阈值 | 动作 |
|:---|:---|:---|
| 行权价 > ATR安全行权价 | — | 强制降级（可卖→谨慎） |
| 总回撤 | ≥ 20% | 停止开仓 |
| 连续亏损 | ≥ 3 笔 | 暂停开仓 |
| 最大持仓 | 3 笔 | 阻断 |
| 总资金超限 | 已占用 + 新仓 > 总资金 | 减少或跳过 |
| 同标的不重复 | 已有持仓 | 跳过 |

### 提前平仓

| 触发条件 | 阈值 | 动作 |
|:---|:---|:---|
| 权利金衰减到 | < 20% 原始 | 自动平仓赢 |
| 剩余 DTE ≤ 2 且权利金 < 50% | — | 自动平仓赢 |
| 权利金 > 2x 原始 | — | 止损信号 |

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

打开 `~/.donew-agent/dashboard.html`，七个标签页：
- **持仓**：当前仓位 + 资金总览 + 已结算 + 浮盈
- **交易明细**：开仓/平仓记录
- **判断日志**：每次分析 + 筛选/分页/年化
- **统计**：数据面板 + 月度日历 + 收益百分比
- **标的扫描**：IV溢价排名，手动刷新
- **K线**：蜡烛图 + 交易标注
- **设置**：交易池/扫描池管理

## 文件结构

```
scripts/sell-put-agent.mjs              # 单文件 Agent (~2400 行)
kline_robot_vercel/api/_lib/
  └─ barchart-options-chain.js          # Barchart 期权链模块（Agent 和 API 共用）

部署依赖（Agent 本身不直接修改）：
stockprice/config/symbols.json          # 行情中心标的列表（GitHub Actions 驱动）
```

## 版本

v0.4.0 · 2026-07-28

## 与 Web 工具（sell-put-decision-tool.html）差异

Agent 是 CLI 自动化版本，Web 工具是浏览器交互版，两者共享同一套策略逻辑，但实现上有以下差异：

### 当前已对齐的差异（2026-07-29）

| 差异项 | Web 工具 | Agent（已对齐） |
|:---|:---|:---|
| 期权概览字段 | IV Rank / IV% / HV / PCR / Expected Move / Volume/OI | 已增加，全部传入 AI |
| ATR 安全价乘数 | `max(1.5, √DTE)` | 已对齐 `max(1.5, √DTE)` |
| 严格安全价 | `min(ATR安全价, Expected Range Low)` | 已对齐 |
| 硬降级门槛 | strike > 安全价 → 阻断 | 已对齐（>安全价→谨慎，>5%→暂不） |
| 期权温度规则 | IV% > 70% 且 IV-HV 倒挂 → 中温 | 已对齐 |

### 尚未对齐的差异

| 差异项 | Web 工具 | Agent | 影响 |
|:---|:---|:---|:---|
| 多资产行情 | QQQ/SMH/SPY/BTC/10Y/VIX 全量 | 仅 VIX | 跨资产联动判断缺失 |
| K 线形态 | 10+ 形态检测 + 历史样本概率 | 仅 SMA 均线 + ATR | 技术面精细化信号缺失 |
| 事件风险 | 新闻按类别分类 + 日期验证 | 仅标题列表 | 依赖 AI 训练记忆补事件 |
| 风险评估 | 3 层量化叠加 + AI 校验 | AI 全权 + 1 条硬降级 | 无规则引擎兜底 |
| Delta 区间 | 硬约束 0.08-0.25（依环境） | 无硬约束 | 可能选中高 Delta 合约 |
| 价差检查 | >Mid×15% → 阻断 | 无硬检查 | 可能接受低流动性合约 |
| 数据完整性 | 缺关键数据 → 只出预检查 | 无类似检查 | 可能基于残缺数据做判断 |

> 注：以上差异为设计取舍，自动化追求速度与简洁，Web 工具追求完整度与严谨性。Agent 的 AI 提示词已加入 Web 工具的关键推理规则，差异主要在传入数据量而非逻辑。各标的含有的专题符号说明详见配置的后续维护。
