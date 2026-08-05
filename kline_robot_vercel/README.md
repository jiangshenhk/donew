# kline_robot_vercel 部署层说明

这个目录是 donew 线上交互工具的主部署层。

如果你是在改下面这些线上工具，通常首先应该看这里：

- K线相识度：`https://sellput.top/kline-robot.html`
- 24小时新闻中心：`https://sellput.top/jin10-news.html`
- 最新每日/每周市场情况分析：`https://sellput.top/market-analysis-tool.html`
- 综合卖Put决策：`https://sellput.top/sell-put-decision-tool.html`
- 卖Put标的池扫描：`https://sellput.top/sell-put-pool-tool.html`
- 最新行情管理页：`https://sellput.top/price-test.html`

> **Sell Put Agent** 是 VPS 后台任务（核心脚本为 `scripts/sell-put-agent.mjs`），不属于网页工具。文档见 `docs/tools/sell-put-agent/README.md`。
> 标的池配置：`~/.donew-agent/pool.json`（`trading` 交易池 + `watchlist` 扫描池）。行情中心标的在 `stockprice/config/symbols.json`。

---

## 1. 目录定位

`kline_robot_vercel/` 不是单一工具目录。它保留了历史目录名，当前主要是 sellput.top 的静态交互页集合及旧 API 兼容镜像。

可以理解为：

```text
sellput.top 静态工具页面
  -> 同源 /api/*
  -> vps-backend/src/routes/*
  -> vps-backend/src/api/*
  -> SQLite / AI / 外部数据源
```

---

## 2. 目录结构

```text
kline_robot_vercel/
├── README.md
├── vercel.json
├── index.html
├── kline-robot.html
├── market-analysis-tool.html
├── sell-put-tool.html
├── jin10-news.html
├── price-test.html
├── market-widget.js
├── api/
│   ├── report.js
│   ├── news-summary.js
│   ├── market-report-v2.js
│   ├── put-rating.js
│   ├── latest-price.js
│   ├── price-status.js
│   ├── price-control.js
│   └── price-refresh.js
├── data/
│   ├── latest-price.json
│   └── price-config.json
└── scripts/
    └── update-price.js
```

---

## 3. 页面与 API 对应关系

### 3.1 K线相识度

- 页面：`kline-robot.html`
- 生产 API：`vps-backend/src/api/report.js`
- 兼容镜像：`api/report.js`

处理流程：

```text
用户输入标的 / 周期 / 样本范围
  -> 页面 POST /api/report
  -> API 拉 K线、做形态匹配、可选 AI 解释
  -> 返回完整 HTML 报告
  -> 页面支持新窗口打开、下载 HTML、下载图片、恢复上次报告
```

### 3.2 24小时新闻中心

- 页面：`jin10-news.html`
- 生产 API：`vps-backend/src/api/news-summary.js`

处理流程：

```text
页面发起生成请求
  -> VPS API 读取 SQLite 新闻缓存
  -> 压缩筛选要点
  -> 按各工具配置调用 DeepSeek 或 OpenAI
  -> 返回 Markdown 报告
```

### 3.3 最新每日/每周市场情况分析

- 页面：`market-analysis-tool.html`
- 生产 API：`vps-backend/src/api/market-report-v2.js`

处理流程：

```text
用户点击“今日最新分析 / 本周周报”
  -> API 读取统一行情快照 + 新闻缓存
  -> 生成结构化市场分析 Markdown
  -> 页面渲染 HTML / Markdown
  -> 支持下载、归档、恢复浏览器上次报告
```

### 3.4 卖 Put 温度判断 ⚠️ 已暂停维护

> 已被 [综合卖Put决策](#35-综合卖-put-决策) 完全覆盖。
- 页面：`sell-put-tool.html`
- 生产 API：`vps-backend/src/api/put-rating.js`

处理流程：

```text
用户上传 Barchart 截图 + 输入标的
  -> 前端 OCR / 手动校对 IV、HV 等字段
  -> API 读取统一行情快照
  -> AI / 规则判断当前卖 Put 是否有利
  -> 返回完整 HTML 报告
```

### 3.5 综合卖 Put 决策

- 页面：`sell-put-decision-tool.html`
- 生产 API：`vps-backend/src/api/sell-put-decision.js`
- 综合决策只调用 DeepSeek；K线分析最多30秒、DeepSeek最多50秒，超时后返回预检查或规则版
- 期权概览 API：`vps-backend/src/api/barchart-overview.js`
- 期权链自动获取：`vps-backend/src/api/_lib/barchart-options-chain.js`（与 Agent 共用）

处理流程：

```text
输入当前标的
  -> 点击"自动获取期权参数"
  -> 前端调用 barchart-overview 获取 IV/HV 等概览数据
  -> 合约字段（行权价/delta/bid/ask/到期日）留空即可
  -> 点击"生成综合卖Put决策"
  -> API 自动从 Barchart 拉取 Delta≈0.15、最近到期的 Put 合约
  -> 并行读取行情、新闻、K线 → DeepSeek 生成综合报告
```

> 合约字段现在支持**自动获取**：留空时 API 会从 Barchart 期权链自动匹配最佳合约（delta≈0.15，到期≥5天）。手工输入仍可覆盖自动匹配结果。

### 3.6 最新行情管理页

- 页面：`price-test.html`
- 读取 API：`vps-backend/src/api/latest-price.js`
- 控制接口：
  - `vps-backend/src/api/price-status.js`
  - `vps-backend/src/api/price-control.js`
  - `vps-backend/src/api/price-refresh.js`

这部分偏管理 / 调试用途。

---

## 4. 外部对接

### AI

- DeepSeek
- OpenAI Responses API

### 数据

- `stockprice/data/latest-price.json`
- `jin10news/data/latest-24h.json`
- Yahoo Finance chart API（K线工具）
- 东财备用行情（K线工具部分场景）

### OCR / 截图输入

- 卖 Put 温度判断前端页面支持截图解析
- 综合卖Put决策页的截图只在“手工修改”中由浏览器本地识别；报告 API 不接收图片

---

## 5. 部署配置

- 唯一生产域名：`https://sellput.top`
- 生产后端：`vps-backend/`
- 路由注册：`vps-backend/src/routes/`
- 进程与定时任务：PM2 / VPS cron

`vercel.json` 与本目录 `api/` 仅为旧部署兼容材料，不是当前生产配置。生成型 API 可能耗时较长，不要随意缩短前端或反向代理超时。

---

## 6. 修改时优先看哪里

### 页面样式 / 按钮 / 浏览器缓存恢复

先看对应的 `*.html`

### AI 输出不对

先看对应 `api/*.js`

### 行情不对

先确认是不是 `stockprice/data/latest-price.json` 源头就不对；
如果缓存是对的，再看消费 API。

### 新闻不对

先看 `jin10news/data/latest-24h.json`；
再看 `api/news-summary.js` 或 `api/market-report-v2.js`

---

## 7. 新增一个类似页面时，推荐复制的最小组合

如果要在这层新增一个工具，建议最少创建：

```text
根目录:
  new-tool.html

VPS 页面镜像与生产 API:
  kline_robot_vercel/new-tool.html
  vps-backend/src/api/new-tool.js
  vps-backend/src/routes/new-tool.js
  docs/tools/new-tool/README.md
```

最方便的做法不是手工建，而是直接运行：

```bash
node scripts/create-tool-scaffold.mjs \
  --slug new-tool \
  --title "AI New Tool" \
  --api new-tool
```

它会自动按 donew 当前风格生成页面、API 和工具 README。

---

## 8. 常见坑

### 坑 1：只改根目录页面，不改 `kline_robot_vercel/`

很多线上页面实际走的是这里，不是仓库根目录版本。

### 坑 2：把密钥逻辑写进前端

需要访问密钥的逻辑必须放在 `api/*.js`。

### 坑 3：页面直接抓外部新闻 / 外部行情

除非确实需要单标的实时拉取，否则优先读统一缓存。

### 坑 4：改页面不改可见版本号

对于 K线工具这类页面，版本号本身就是“线上是否刷新成功”的验证点。
