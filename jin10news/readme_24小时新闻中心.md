# 24小时新闻中心（Jin10 News Center）

这个目录负责维护 donew 的“最近24小时 / 48小时市场新闻缓存”。

它不是单纯的网页，而是一个被多个工具复用的数据中心。

---

## 1. 线上相关入口

- 展示页：`https://sellput.top/jin10-news.html`
- 原始 JSON 缓存：`jin10news/data/latest-24h.json`
- Markdown 缓存：`jin10news/data/latest-24h.md`

---

## 2. 这个目录解决什么问题

统一抓取金十搜索中“金十数据整理”的快讯内容，避免：

- 每个页面都单独去抓一次金十；
- 每个工具各自维护一套新闻清洗逻辑；
- AI 工具对同一天的新闻口径不一致。

下游典型使用方：

- 24小时新闻中心页面 `kline_robot_vercel/jin10-news.html`
- 新闻总结 API `vps-backend/src/api/news-summary.js`
- 市场分析 API `vps-backend/src/api/market-report-v2.js`
- 自动日报生成器 `scripts/generate-market-daily-report.mjs`

---

## 3. 目录结构

```text
jin10news/
├── README.md
├── config/
│   └── news-config.json
├── scripts/
│   └── update-jin10-news.js
├── data/
│   ├── latest-24h.json
│   └── latest-24h.md
└── test.html
```

### 关键文件

- `config/news-config.json`
  - 新闻抓取开关、配置入口
- `scripts/update-jin10-news.js`
  - 真正执行抓取、分页、去重、截窗、落地缓存
- `data/latest-24h.json`
  - 给程序和 AI 读的结构化缓存
- `data/latest-24h.md`
  - 给网站文档页和人类直接看的 Markdown 缓存

---

## 4. 处理流程

```text
VPS PM2 node-cron 定时触发
  -> vps-backend/src/services/jin10News.js
  -> 拉取金十搜索结果
  -> 分页抓取
  -> 兼容多种响应结构
  -> 按新闻 ID / 时间 / 正文去重
  -> 只保留最近24小时
  -> 写入 VPS SQLite 新闻缓存
  -> 提供给同源 API 和自动报告任务
```

注意：

- 虽然文件名叫 `latest-24h`，但有些下游工具会再从中取最近 24h 或最近 48h 的子集；
- 也就是说，这里是“统一新闻缓存入口”，不是所有工具都必须按完全同一个时间窗消费。

---

## 5. 自动更新

生产读取与存储由 `vps-backend/src/cron.js`、`vps-backend/src/services/jin10News.js` 和 VPS SQLite 负责。由于金十可能封锁 VPS IP，服务优先读取 GitHub Actions 生成的 `jin10news/data/latest-24h.json`，失败后才尝试 VPS 直连金十。

这只是上游采集回退。浏览器页面不得直接访问 GitHub，必须统一读取 `https://sellput.top/api/news/latest`。

---

## 6. 输出数据约定

`latest-24h.json` 主要用于下游程序读取，建议后续保持这类结构稳定：

```json
{
  "updatedAt": "...",
  "source": "...",
  "sourceLabel": "...",
  "items": [
    {
      "id": "...",
      "time": "...",
      "categories": ["..."],
      "content": "..."
    }
  ]
}
```

不要轻易改这些字段名，否则会影响：

- `api/news-summary.js`
- `api/market-report.js`
- `api/market-report-v2.js`
- `scripts/generate-market-daily-report.mjs`

---

## 7. 外部对接

### 上游

- 金十搜索页 / 金十搜索接口
- GitHub Actions 新闻采集缓存（VPS IP 被限制时使用）

### 下游

- VPS API：`vps-backend/src/api/news-summary.js`
- 市场分析 API：`vps-backend/src/api/market-report-v2.js`
- VPS 自动日报任务

---

## 8. 修改时先看哪里

如果问题是：

### A. 抓不到新闻

先看：

- `vps-backend/src/services/jin10News.js`
- `vps-backend/src/cron.js`
- PM2 服务日志

### B. 页面能打开，但总结内容为空

先看：

- VPS SQLite 新闻缓存
- `vps-backend/src/api/news-summary.js`

### C. 自动日报没有新闻

先看：

- VPS 自动报告任务与日志
- `vps-backend/src/api/market-report-v2.js`

---

## 9. 常见坑

### 坑 1：不要失败时用空数据覆盖旧缓存

当前逻辑是：

- 接口失败、无有效新闻时，应保留旧缓存；
- 不要把 `latest-24h.json` 覆盖成空数组。

### 坑 2：不要只为某个页面改字段

这个目录是“共享新闻底座”。

如果只为了某一个前台页面随意改字段，下游其它工具很容易一起坏。

### 坑 3：不要把 AI 总结逻辑塞回这个目录

这个目录只负责：

- 抓取
- 清洗
- 去重
- 落缓存

AI 总结应放在 API 层，例如：

- `vps-backend/src/api/news-summary.js`

---

## 10. 给后续智能体的扩展模板

如果以后想再做一个“别的新闻源中心”，建议照着这个目录结构复制：

```text
newssource/
├── README.md
├── config/
│   └── source-config.json
├── scripts/
│   └── update-source.js
├── data/
│   ├── latest.json
│   └── latest.md
└── .github/workflows/
    └── update-source.yml
```

标准步骤：

1. 先落地结构化 JSON；
2. 再补一份 Markdown 给人读；
3. 再由 API 层消费；
4. 不要让前端页面直接抓新闻源。
