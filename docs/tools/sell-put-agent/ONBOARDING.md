# Sell Put Agent — 新对话速查卡片

> 给下一个 AI 对话的入门信息，5 分钟理解项目全貌后即可开工。

## 项目定位

本地 CLI 工具，每天美股时段自动分析标的池的卖 Put 机会，纸面模拟交易，跟踪胜率和盈亏。同时驱动一个可视化仪表板（静态 HTML）。

## 核心文件

| 文件 | 作用 |
|:---|:---|
| `scripts/sell-put-agent.mjs` | **唯一主文件** (~2500 行)，所有功能都在这里 |
| `kline_robot_vercel/api/_lib/barchart-options-chain.js` | Barchart 期权链获取模块（Agent 和 Web API 共用） |
| `docs/tools/sell-put-agent/README.md` | 完整功能文档 |
| `AGENTS.md` | 给 AI 的协作规则（结论前置、主动反问等） |
| `DEV-README.md` | 项目开发规则（四层结构、7 工具全景、脚手架） |

## 数据存储（不在 Git 中）

```
~/.donew-agent/
  ├─ pool.json          # 统一标的池 { trading: [...], watchlist: [...] }
  ├─ journal/           # 每次分析记录 ({date}_{symbol}_{timestamp}.json)
  ├─ positions.json     # 持仓
  ├─ orders.json        # 交易订单
  ├─ stats.json         # 统计
  ├─ scan-result.json   # 扫描结果缓存
  ├─ kline/             # K线数据
  ├─ dashboard.html     # 可视化仪表板（静态 HTML，数据内嵌 JSON）
  └─ .env               # DEEPSEEK_API_KEY
```

## 标的池体系

| 池 | 配置键 | 用途 | CLI 管理命令 |
|:---|:---|:---|:---|
| **交易池** | `pool.json → trading` | 可自动开仓的标的 | `symbols add/remove/list` |
| **扫描池** | `pool.json → watchlist` | IV溢价排名观察（应包含交易池） | `watchlist add/remove/list` |
| **行情中心** | `stockprice/config/symbols.json` | 实时价格/K线数据源 | 编辑仓库文件 |

## Agent 的命令模式

```bash
node scripts/sell-put-agent.mjs daily        # 拉数据→AI决策→开仓→记录
node scripts/sell-put-agent.mjs stats        # 终端统计面板
node scripts/sell-put-agent.mjs scan         # 扫描 IV 溢价排名
node scripts/sell-put-agent.mjs dashboard    # 生成 HTML 仪表板
node scripts/sell-put-agent.mjs report       # Markdown 日报
node scripts/sell-put-agent.mjs symbols      # 管理交易池
node scripts/sell-put-agent.mjs watchlist    # 管理扫描池
node scripts/sell-put-agent.mjs setup        # 安装 launchd 自动运行
node scripts/sell-put-agent.mjs env          # 写入 API Key
```

## 数据流

```
Barchart 期权链 → 筛选匹配 Put 合约
       ↓
Yahoo Finance K线 → ATR / SMA
       ↓
GitHub stockprice → 行情快照
       ↓
DeepSeek API → 生成决策（可卖Put / 谨慎卖Put / 暂不卖Put）
       ↓
存储到 ~/.donew-agent/ 各文件
       ↓
Dashboard 生成时嵌入所有数据为内联 JSON
```

## 关键约束

- **不要创建新的 Serverless Function**：Vercel Hobby 限制 12 个函数。新 API 加 `action`/`mode` 参数复用已有 JS。
- **`_lib/` 不算 Function**：共享模块放这里。
- **Agent 是单文件**：`scripts/sell-put-agent.mjs`，不要拆成多文件除非必须。
- **Dashboard 是静态 HTML**：数据内嵌 JSON，打开 `~/.donew-agent/dashboard.html` 即可。file:// 下不能跨域 fetch。
- **修改后更新版本号**：Agent 头部注释和 `showVersion()`、Dashboard HTML 的 `<h1>` 版本都要更新。
- **不要修改旧代码**：改 web 工具前先读 `AGENTS.md` 和 `DEV-README.md`。

## 风控硬规则

| 规则 | 阈值 |
|:---|:---|
| 行权价 > ATR安全行权价 | 强制降级（可卖→谨慎） |
| 总回撤 | ≥ 20% 停止开仓 |
| 连续亏损 | ≥ 3 笔暂停 |
| 最大持仓 | 3 笔 |
| 总资金上限 | 单笔 ≤ 50% × 剩余资金 |
| 同标的不重复 | 已有持仓则跳过 |

## 常见开发场景

### 场景 1：修改开仓规则
改 `scripts/sell-put-agent.mjs` 中的 `checkRiskGates()`、`willOpen` 判断、或 `CONFIG` 对象。

### 场景 2：修改 Dashboard 页面
在 `buildDashboardHtml()` 函数中修改 HTML/CSS/JS 内联模板字符串。运行 `node scripts/sell-put-agent.mjs dashboard` 测试。

### 场景 3：修改期权链获取
Agent 自有实现：`fetchOptionsChain()` 函数（约 Line 180）。
共用模块：`kline_robot_vercel/api/_lib/barchart-options-chain.js`。
⚠️ 两边都要改，字段名不同（`strike` vs `strikePrice`）。

### 场景 4：调试
- 语法检查：`node --check scripts/sell-put-agent.mjs`
- 单功能测试：逐个命令运行
- Dashboard JS 错误：打开 `~/.donew-agent/dashboard.html` 按 F12 看控制台
- 数据验证：`node -e "..."` 直接读 `~/.donew-agent/*.json`

## 环境变量

- `DEEPSEEK_API_KEY`：必需。可选存 `~/.donew-agent/.env`（`node scripts/sell-put-agent.mjs env`）
- launchd 自动运行时会从 `.env` 文件读取

## 版本

v0.4.0 · 2026-07-28
