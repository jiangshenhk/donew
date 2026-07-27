# kline_robot_vercel 部署层说明

这个目录是 donew 线上交互工具的主部署层。

如果你是在改下面这些线上工具，通常首先应该看这里：

- K线相识度：`https://donew-beta.vercel.app/kline-robot.html`
- 24小时新闻中心：`https://donew-beta.vercel.app/jin10-news.html`
- 最新每日/每周市场情况分析：`https://donew-beta.vercel.app/market-analysis-tool.html`
- 卖 Put 温度判断：`https://donew-beta.vercel.app/sell-put-tool.html`
- 最新行情管理页：`https://donew-beta.vercel.app/price-test.html`

---

## 1. 目录定位

`kline_robot_vercel/` 不是单一工具目录，而是一个“交互页 + API”的集合部署层。

可以理解为：

```text
Vercel 前端页面
  + Vercel Serverless API
  + 对共享缓存 / AI / 外部源的访问层
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
- 核心 API：`api/report.js`

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
- 核心 API：`api/news-summary.js`

处理流程：

```text
页面发起生成请求
  -> API 先读取 GitHub 上的 jin10news/data/latest-24h.json
  -> 压缩筛选要点
  -> 调用 DeepSeek / OpenAI
  -> 返回 Markdown 报告
```

### 3.3 最新每日/每周市场情况分析

- 页面：`market-analysis-tool.html`
- 核心 API：`api/market-report-v2.js`

处理流程：

```text
用户点击“今日最新分析 / 本周周报”
  -> API 读取统一行情快照 + 新闻缓存
  -> 生成结构化市场分析 Markdown
  -> 页面渲染 HTML / Markdown
  -> 支持下载、归档、恢复浏览器上次报告
```

### 3.4 卖 Put 温度判断

- 页面：`sell-put-tool.html`
- 核心 API：`api/put-rating.js`

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
- 核心 API：`api/sell-put-decision.js`
- 期权概览 API：`api/barchart-overview.js`

处理流程：

```text
输入当前标的
  -> 点击“自动获取期权参数”
  -> 前端单独调用 barchart-overview 并填入默认值
  -> 需要校正时点击“手工修改”
     -> 上传/粘贴截图由浏览器 Tesseract.js 本地识别
     -> 或逐项手工修改
  -> 参数确认后点击生成
  -> sell-put-decision API 只接收结构化字段，不接收图片
  -> 并行读取行情、新闻、K线，再生成综合报告
```

前端门槛：

- 未成功点击“自动获取期权参数”时，不启动报告 API。
- 切换市场或标的后，清除旧期权温度字段并要求重新获取。
- 自动获取是默认值来源，“手工修改”只负责校正。

### 3.6 最新行情管理页

- 页面：`price-test.html`
- 读取 API：`api/latest-price.js`
- 控制接口：
  - `api/price-status.js`
  - `api/price-control.js`
  - `api/price-refresh.js`

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

配置文件：

- `vercel.json`

当前重点函数已设置较长 `maxDuration`：

- `api/report.js`
- `api/put-rating.js`
- `api/news-summary.js`
- `api/market-report-v2.js`

这说明这些接口本身就是“生成型 API”，不要随意把它们改成很短的超时模型。

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

Vercel 目录:
  kline_robot_vercel/new-tool.html
  kline_robot_vercel/api/new-tool.js
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
