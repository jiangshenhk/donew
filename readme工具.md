# donew 工具总览与新增模板

这份文档给“后续维护代码的智能体 / 人类开发者”看。

目标不是介绍投资逻辑，而是讲清楚：

1. 现在有哪些工具；
2. 每个工具的入口网址在哪里；
3. 代码放在哪一层；
4. 数据是怎么流动的；
5. 如果要继续加一个新工具，应该怎么按当前风格落地。

---

## 1. 当前工具全景

| 工具 | 线上入口 | 主要代码位置 | 类型 |
| --- | --- | --- | --- |
| K线相识度 | `https://donew-beta.vercel.app/kline-robot.html` | `kline-robot.html`、`kline_robot_vercel/` | 交互式网页工具 |
| 24小时新闻中心 | `https://donew-beta.vercel.app/jin10-news.html` | `jin10news/`、`kline_robot_vercel/jin10-news.html` | 数据中心 + 展示页 |
| 最新行情中心 | `https://donew-beta.vercel.app/price-test.html` | `stockprice/`、`kline_robot_vercel/api/latest-price.js` | 数据中心 + 管理页 |
| 日报周报自动生成器 | 无独立交互页，走 GitHub Actions | `.github/workflows/generate-market-daily-reports.yml`、`scripts/`、`lib/` | 定时生成器 |
| 最新每日/每周市场情况分析 | `https://donew-beta.vercel.app/market-analysis-tool.html` | `market-analysis-tool.html`、`kline_robot_vercel/market-analysis-tool.html`、`kline_robot_vercel/api/market-report-v2.js` | 交互式网页工具 |
| 卖 Put 温度判断 | `https://donew-beta.vercel.app/sell-put-tool.html` | `sell-put-tool.html`、`kline_robot_vercel/sell-put-tool.html`、`kline_robot_vercel/api/put-rating.js` | 交互式网页工具 |

---

## 2. 仓库里的四层结构

### A. 根目录静态页面层

典型文件：

- `kline-robot.html`
- `market-analysis-tool.html`
- `sell-put-tool.html`

作用：

- 方便在仓库根目录直接打开；
- 给 GitHub Pages / 本地预览保留镜像；
- 也是 UI 改动时最容易直接看到的文件。

### B. `kline_robot_vercel/` 线上部署层

典型文件：

- `kline_robot_vercel/kline-robot.html`
- `kline_robot_vercel/market-analysis-tool.html`
- `kline_robot_vercel/sell-put-tool.html`
- `kline_robot_vercel/jin10-news.html`
- `kline_robot_vercel/api/*.js`
- `kline_robot_vercel/vercel.json`

作用：

- 这是 `donew-beta.vercel.app` 的核心部署目录；
- 交互工具的前端页面和 API 大多在这里闭环；
- 有需要访问密钥、访问 AI、拼装 HTML 报告的逻辑，优先看这里。

### C. 数据中心层

目录：

- `jin10news/`
- `stockprice/`

作用：

- 独立抓取、清洗、落地缓存；
- 生成供多个工具复用的统一输入；
- 尽量让业务工具“读缓存”，而不是各自乱抓外部源。

### D. 自动生成器层

目录 / 文件：

- `.github/workflows/generate-market-daily-reports.yml`
- `scripts/generate-market-daily-report.mjs`
- `scripts/test-market-daily-report.mjs`
- `scripts/validate-market-report.mjs`
- `lib/market-report-core.mjs`

作用：

- 不是一个交互页，而是一条定时内容生产链；
- 自动生成市场早报 / 晚报，回写到 `docs/市场/`；
- 给 Docsify 首页、历史页、今日页供稿。

---

## 3. 六个工具分别怎么看

### 3.1 K线相识度

- 入口页：`https://donew-beta.vercel.app/kline-robot.html`
- 前端页面：
  - `kline-robot.html`
  - `kline_robot_vercel/kline-robot.html`
- 主要 API：
  - `kline_robot_vercel/api/report.js`
- 主要外部对接：
  - Yahoo Finance chart API
  - 东财备用行情
  - DeepSeek / OpenAI

这一工具是“单标的、单次分析”的代表模板。

### 3.2 24小时新闻中心

- 入口页：`https://donew-beta.vercel.app/jin10-news.html`
- 数据目录：
  - `jin10news/`
- 展示页：
  - `kline_robot_vercel/jin10-news.html`
- 主要 API：
  - `kline_robot_vercel/api/news-summary.js`

这一工具是“先抓缓存，再由页面消费缓存”的代表模板。

### 3.3 最新行情中心

- 管理页：`https://donew-beta.vercel.app/price-test.html`
- 缓存文件：
  - `stockprice/data/latest-price.json`
- 读取 API：
  - `kline_robot_vercel/api/latest-price.js`
  - 根目录还有 `api/latest-price.js` / `api/price-status.js` 这类兼容接口

这一工具本质上不是给普通用户直接分析用，而是给别的工具统一喂行情。

### 3.4 日报周报自动生成器

- 没有单独交互页；
- 输出结果写入：
  - `docs/市场/每日市场早报.md`
  - `docs/市场/每日市场晚报.md`
  - `docs/市场/今日.md`
  - `docs/市场/历史.md`

这一工具是“定时生成型工具”的模板。

### 3.5 最新每日/每周市场情况分析

- 入口页：`https://donew-beta.vercel.app/market-analysis-tool.html`
- 前端页面：
  - `market-analysis-tool.html`
  - `kline_robot_vercel/market-analysis-tool.html`
- 主要 API：
  - `kline_robot_vercel/api/market-report-v2.js`

这一工具是“多资产快照 + AI整理 + HTML/Markdown展示”的代表模板。

### 3.6 卖 Put 温度判断

- 入口页：`https://donew-beta.vercel.app/sell-put-tool.html`
- 前端页面：
  - `sell-put-tool.html`
  - `kline_robot_vercel/sell-put-tool.html`
- 主要 API：
  - `kline_robot_vercel/api/put-rating.js`

这一工具是“截图 OCR + 行情快照 + AI结论”的代表模板。

---

## 4. 共享处理逻辑

### 4.1 统一行情来源

当前推荐优先级：

1. `stockprice/data/latest-price.json`
2. 由 Vercel API / 页面读取该缓存
3. 只有必须单独拉取时，才走工具自己的外部源

原因：

- 避免每个工具重复限流；
- 避免同一时刻多工具读出不同价格口径；
- 让“行情时间”和“缓存时间”都能统一展示。

### 4.2 统一新闻来源

新闻中心先落地到：

- `jin10news/data/latest-24h.json`
- `jin10news/data/latest-24h.md`

其他工具如果要用新闻，优先读这个缓存，而不是自己再去抓金十。

### 4.3 统一 AI 调用方式

当前主要走：

- DeepSeek
- OpenAI（部分接口 / 备用）

建议：

- 需要密钥的逻辑都放在 `kline_robot_vercel/api/*.js`
- 静态 HTML 页面只负责收集参数、发请求、显示结果

### 4.4 统一“浏览器上次报告恢复”

现在几个交互页都支持把最近一次生成结果写入 `localStorage`。

新增工具如果是“生成型工具”，建议也照这个模式做：

- 成功生成后缓存最近一份报告；
- 页面加载时尝试恢复；
- 页面上明确显示：
  - 原生成时间
  - 浏览器保存时间（如果两者不同）

---

## 5. 新增一个类似工具时，推荐照抄的模板

下面是最重要的部分。

如果你要加一个“风格一致的新工具”，建议按这个顺序做。

### 5.1 先判断你要加的是哪一类

#### 类型 A：交互式网页工具

例子：

- K线相识度
- 市场情况分析
- 卖 Put 温度判断

特征：

- 用户打开网页，输入参数，点击生成；
- 结果通常是 HTML 报告；
- 需要配套一个或多个 API。

#### 类型 B：数据中心

例子：

- 24小时新闻中心
- 最新行情中心

特征：

- 先定时抓取，落缓存；
- 多个工具共享这份缓存；
- 可能有测试页 / 管理页，但核心不是前台交互。

#### 类型 C：自动生成器

例子：

- 日报 / 晚报自动生成器

特征：

- 定时运行；
- 产物是 Markdown / JSON / Docs 页面；
- 重点是工作流稳定，不是前台即时交互。

---

## 6. 新增交互式网页工具的标准落地模板

假设我们要新增一个工具：`alpha-risk-tool`

### 6.0 直接用脚手架程序

仓库已经提供了一个可直接运行的脚手架：

```bash
node scripts/create-tool-scaffold.mjs \
  --slug alpha-risk-tool \
  --title "AI Alpha Risk" \
  --api alpha-risk \
  --description "判断某个标的当前是否进入 alpha 风险区。"
```

这条命令会自动生成：

```text
alpha-risk-tool.html
kline_robot_vercel/alpha-risk-tool.html
kline_robot_vercel/api/alpha-risk.js
docs/tools/alpha-risk-tool/README.md
```

也就是说，后续智能体不需要再从零手写文件结构，先跑脚手架，再把生成内容改成真实业务逻辑即可。

### 6.1 推荐文件结构

```text
donew/
├── alpha-risk-tool.html
├── kline_robot_vercel/
│   ├── alpha-risk-tool.html
│   ├── api/
│   │   └── alpha-risk.js
│   └── README.md
└── readme工具.md
```

### 6.2 推荐处理流程

```text
用户打开页面
  -> 前端收集参数
  -> 调用 /api/alpha-risk
  -> API 读取统一缓存 / 外部数据
  -> API 调用 AI 或规则引擎
  -> API 返回 html / markdown / meta
  -> 前端展示、下载、缓存上次报告
```

### 6.3 最小 API 返回结构

```json
{
  "ok": true,
  "filename": "alpha-risk-report.html",
  "generatedAt": "2026-07-18T10:00:00.000Z",
  "html": "<html>...</html>",
  "markdown": "# 报告标题",
  "status": "已生成",
  "message": "已生成报告。"
}
```

### 6.4 前端建议统一保留的能力

- 新窗口打开报告
- 下载 HTML
- 下载图片
- 最近一次报告自动恢复
- 明确显示生成时间
- 历史输入记录（如果适合）

### 6.5 页面命名建议

- 页面：`xxx-tool.html`
- API：`kline_robot_vercel/api/xxx.js`
- 本地存储 key：`xxxLatestReport.v1`
- README：写在对应目录 README 里，并在本总览里补一行

---

## 7. 新增数据中心的标准落地模板

假设新增一个“宏观事件缓存中心”：`macroevents`

### 7.1 推荐文件结构

```text
donew/
├── macroevents/
│   ├── README.md
│   ├── config/
│   │   └── events-config.json
│   ├── scripts/
│   │   └── update-events.js
│   └── data/
│       ├── latest-events.json
│       └── latest-events.md
└── .github/workflows/
    └── update-macroevents.yml
```

### 7.2 推荐处理流程

```text
GitHub Actions 定时触发
  -> scripts/update-events.js
  -> 读取外部源
  -> 清洗 / 去重 / 截窗
  -> 写入 data/latest-events.json
  -> commit 回 main
  -> 交互页 / API 读取这份缓存
```

### 7.3 数据中心 README 至少要写清楚

- 缓存文件是什么
- 配置文件是什么
- 更新脚本是什么
- 工作流文件是什么
- 出错时保留旧数据还是覆盖
- 下游哪些工具在读它

---

## 8. 新增自动生成器的标准落地模板

假设新增一个“每周复盘生成器”：`weekly-review`

### 8.1 推荐文件结构

```text
donew/
├── scripts/
│   ├── generate-weekly-review.mjs
│   ├── test-weekly-review.mjs
│   └── validate-weekly-review.mjs
├── lib/
│   └── weekly-review-core.mjs
├── docs/市场/
│   └── README.md
└── .github/workflows/
    └── generate-weekly-review.yml
```

### 8.2 推荐处理流程

```text
定时工作流触发
  -> 组装输入（新闻 / 行情 / 基线策略）
  -> 调用 AI
  -> 验证关键章节
  -> 写入 docs 产物
  -> 更新今日页 / 历史页
  -> commit 回 main
```

### 8.3 自动生成器必须有的三层文件

- `generate-*.mjs`：真正生产内容
- `test-*.mjs`：生成后马上跑一遍验证
- `validate-*.mjs`：检查最低结构要求

这样后续别人改 prompt、改产出格式时，至少不会把整条链路悄悄改坏。

---

## 9. README 应该怎么写，才方便智能体接手

每个 README 至少包含以下章节：

1. 这个工具 / 目录是干什么的
2. 线上入口网址
3. 关键文件列表
4. 处理流程
5. 外部对接
6. 输入 / 输出
7. 定时任务或部署方式
8. 修改时先看哪里
9. 常见坑 / 不要误改的点

推荐写法：

```text
先给“这是什么”
再给“入口和代码在哪”
再给“数据怎么流”
最后给“怎么照着扩展”
```

不要只写一句“这是某某工具”，那种 README 对后续维护基本没帮助。

---

## 10. 当前仓库新增工具的统一约定

### 命名

- 页面文件：`xxx-tool.html`
- 数据目录：`xxxcenter/` 或 `xxxdata/`
- API：`kline_robot_vercel/api/xxx.js`
- 定时任务：`.github/workflows/update-xxx.yml` 或 `generate-xxx.yml`

### 结果落地

- 缓存型数据：放 `data/`
- 人读的报告：放 `docs/市场/` 或对应专题目录
- 技术说明：放各目录 `README.md`

### 修改优先级

如果一个功能同时有根目录页面和 `kline_robot_vercel/` 页面：

1. 先确认线上实际走的是哪一份；
2. 如需保持一致，成对修改；
3. 页面改动后，记得更新可见版本号，方便确认前端是否真的刷新。

---

## 11. 建议后续继续补充的 README

当前最值得保持持续更新的是：

- `kline_robot_vercel/README.md`
- `jin10news/README.md`
- `stockprice/README.md`
- `docs/市场/README.md`

这四份加上本文件，已经足够让另一个智能体快速理解整个 donew 工具体系。
