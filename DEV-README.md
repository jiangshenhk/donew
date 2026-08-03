# donew 开发接力说明（DEV-README）

| | 地址 |
|---|---|
| GitHub | `https://github.com/jiangshenhk/donew` |
| 本地路径 | `/Users/jiangshen/Desktop/Obsidian/学习/收集箱/Codex相关/donew` |
| 线上域名 | **`http://107.175.44.146/`**（VPS 主站） |
| VPS 冗余 | `https://donew-beta.vercel.app/`（Vercel，未主动更新） |

这份文件是给"新开的智能体对话 / 新接手的开发者"看的。

目标只有一个：

> 用最少的阅读成本，快速理解 donew 这套工具系统，并且按现有风格继续开发，不乱改、不串层、不误推。

这份文档是 **Codex 与 ChatGPT 共同读取的主开发说明**。两边接手 donew 任务时，都应先读本文件，再按任务类型补读对应目录的 README，避免不同智能体对仓库结构产生两套理解。

---

## 0. AI 接手快速卡（新对话直接粘贴）

```
项目：donew (github.com/jiangshenhk/donew)
本地：/Users/jiangshen/Desktop/Obsidian/学习/收集箱/Codex相关/donew

当前部署架构（2026-08-03 迁移后）：
主部署 RackNerd VPS 107.175.44.146（Ubuntu 24.04，Node.js + PM2 + Nginx + SQLite）
访问入口：http://107.175.44.146/
VPS 目录：/home/ai_worker/stock_project/（对应仓库 vps-backend/）
重启命令：pm2 restart donew-backend

VPS 代码部署：
ssh ai_worker@107.175.44.146 "cd ~/stock_project && git pull && npm install && pm2 restart donew-backend"

定时任务：行情+新闻每5分钟（PM2 cron），短线每5分钟/长线每日17:00/SellPut每日08:00（系统cron）
环境变量：DEEPSEEK_API_KEY 在 VPS .env（已配），OpenAI 未使用
金十新闻：GitHub Actions抓取 → VPS从GitHub raw读取（绕过IP封锁）

已知约定：改前端改 kline_robot_vercel/*.html，改后端改 vps-backend/src/，改后更新版本号，.env 不提交
```

---

## 1. 你接手的是一个什么仓库

`donew` 不是单一网页，而是一组相互配合的工具系统，主要包含：

1. K线相识度工具
2. 24小时新闻中心
3. 最新行情中心
4. 自动生成的市场早报 / 晚报
5. 最新每日 / 每周市场情况分析工具
6. 卖 Put 温度判断工具
7. 综合卖Put决策工具（新闻+行情+K线+期权四合一）
8. 卖Put标的池扫描工具（Barchart期权溢价批量初筛）
9. Sell Put Agent — 自动卖Put决策引擎（CLI脚本 + 可视化仪表板）

它们之间有共享的数据中心、共享的 AI 接口、共享的前端样式和共享的部署层。

---

## 2. 新对话接手时，先读什么

### 必读 1：本文件里的“工具总览与新增模板”

作用：

- 看懂所有工具的入口网址
- 看懂目录结构
- 看懂处理流程
- 看懂新增工具时该放在哪一层

### 必读 2：如果要新增一个类似工具

- [scripts/create-tool-scaffold.mjs](scripts/create-tool-scaffold.mjs)

作用：

- 直接生成新工具的页面、API、README 脚手架

### 必读 3：如果要改线上交互工具

- [kline_robot_vercel/README.md](kline_robot_vercel/README.md)

作用：

- 理解哪些页面是 Vercel 线上主入口
- 理解页面与 API 的对应关系

---

## 3. 按任务类型选择继续读什么

### A. 改新闻相关

读：

- [jin10news/README.md](jin10news/README.md)

### B. 改行情相关

读：

- [stockprice/README.md](stockprice/README.md)

### C. 改自动早报 / 晚报链路

读：

- [docs/市场/README.md](docs/市场/README.md)

---

## 4. 这套系统的四层结构

### 第一层：根目录静态页面

例如：

- `kline-robot.html`
- `market-analysis-tool.html`
- `sell-put-tool.html`

这层通常用于：

- 根目录镜像
- 本地预览
- GitHub Pages 保底页面

### 第二层：`kline_robot_vercel/` 线上部署层

这是最重要的一层。

这里放：

- 线上页面
- 线上 API
- AI 接口
- 工具主逻辑

### 第三层：数据中心

主要是：

- `jin10news/`
- `stockprice/`

这层只负责：

- 抓数据
- 清洗数据
- 落缓存

不要把业务页面逻辑硬塞进这里。

### 第四层：自动生成器

主要是：

- `.github/workflows/generate-market-daily-reports.yml`
- `scripts/generate-market-daily-report.mjs`
- `lib/market-report-core.mjs`
- `.github/workflows/verify-market-generation-paths.yml`

这层负责定时内容生产。

---

## 5. 沙箱目录：`lucas/`（学习练手，不影响正式项目）

`lucas/` 是作者儿子的个人学习练手目录，**与正式项目严格隔离**。

### 位置

- `lucas/` — 本地预览 / GitHub Pages
- `kline_robot_vercel/lucas/` — Vercel 线上部署（与根目录版本保持一致）

### 约定

- **任何开发者 / 智能体不得修改 `lucas/` 以外的任何文件来做 lucas 相关的事情**
- `lucas/` 内的代码不参与正式项目的构建、API、样式、数据缓存等任何流程
- 如果 lucas 需要新增页面，同步更新两个位置：
  1. `lucas/xxx.html`
  2. `kline_robot_vercel/lucas/xxx.html`
- lucas 的页面不应引用正式项目的 API、样式、工具库，除非显式注明

### 当前项目

| 项目 | 线上入口 | 说明 |
| --- | --- | --- |
| 航班实时跟踪 | `https://donew-beta.vercel.app/lucas/lucas_fly.html` | Leaflet + OpenSky API 实时航班面板 |

---

## 6. 当前线上入口

### 工具页

- K线相识度：`https://donew-beta.vercel.app/kline-robot.html`
- 24小时新闻中心：`https://donew-beta.vercel.app/jin10-news.html`
- 最新每日 / 每周市场情况分析：`https://donew-beta.vercel.app/market-analysis-tool.html`
- 综合卖Put决策：`https://donew-beta.vercel.app/sell-put-decision-tool.html`
- 卖Put标的池扫描：`https://donew-beta.vercel.app/sell-put-pool-tool.html`
- 最新行情管理页：`https://donew-beta.vercel.app/price-test.html`

### 本地工具（CLI）

- **Sell Put Agent**：`node scripts/sell-put-agent.mjs daily` — 自动分析交易池标的的卖Put机会，纸面交易 + 可视化仪表板，数据存 `~/.donew-agent/`
  - 文档：`docs/tools/sell-put-agent/README.md`
  - 标的池：`~/.donew-agent/pool.json`（`trading` 交易池 + `watchlist` 扫描池）
  - 行情依赖：`stockprice/config/symbols.json`（GitHub Actions 管理，需与扫描池对齐）

以上正式工具入口统一使用仓库根目录或 `kline_robot_vercel/` 下的 `ai-icon.svg` 作为浏览器标签图标。新增工具时必须在 `<head>` 中同时声明 `rel="icon"` 和 `rel="shortcut icon"`，并使用相对于当前入口页可访问的静态路径。

### Docs / 公共阅读页

- 今日：`https://jiangshenhk.github.io/donew/#/docs/市场/今日.md`
- 历史：`https://jiangshenhk.github.io/donew/#/docs/市场/历史.md`

---

## 7. 开发约定

### 约定 1：不要默认推送

除非用户明确要求：

- 推送
- 部署
- 更新到线上
- commit

否则默认只本地改。

### 约定 2：每次修改页面或API后，必须更新可见版本号

原因：用户通过版本号确认前端是否刷新成功，也便于回退和追溯。每次修改（包括样式、功能、Bug修复）都应递增版本号。

### 约定 3：如果递交有冲突，只做小范围处理

做法：

- 只提交当前任务相关文件
- 不把无关改动一起卷进去
- 小范围 rebase / 合并

### 约定 4：新增工具优先用脚手架

不要从零手写。

优先运行：

```bash
node scripts/create-tool-scaffold.mjs \
  --slug your-tool \
  --title "Your Tool Title" \
  --api your-tool
```

脚手架会自动生成 `docs/tools/<slug>/README.md`。这个 README 是该工具**唯一的文档**，同时包含使用说明和设计思路。

### 约定 5：每工具两个文档：README + README-FOR-AI

每个工具在 `docs/tools/<slug>/` 下应有两份文件：

| 文件 | 受众 | 内容 |
|---|---|---|
| `README.md` | 开发者 / 接手 AI | 功能概述、设计思路、数据流、API 参数、评分逻辑、部署说明 |
| `README-FOR-AI.md` | 喂给 GPT/DeepSeek | 该工具专用的 AI 提示词：输出格式、判断规则、策略口径、素材引用 |

**AI 调用时**，API 代码应读取 `docs/tools/<slug>/README-FOR-AI.md`，将其内容拼入系统 prompt，确保 AI 行为与该工具的设计意图一致。

**现有策略文档的处理**：`docs/SellPut/策略/` 中的文件本质上是 README-FOR-AI，应逐步迁移到对应工具的 `README-FOR-AI.md` 中。日报/晚报生成器已通过 `loadStrategyBaseline()` 读取这些文件作为 AI 提示词，保持现有链路不变。

**文档查找标准路径**：

```
DEV-README.md                    ← 总入口：列所有工具，链接各工具文档
  └─ docs/tools/<slug>/
       ├─ README.md              ← 给开发者/接手AI读：架构、数据流、评分逻辑、API参数
       └─ README-FOR-AI.md       ← 运行时喂给GPT/DeepSeek：输出格式、判断规则、策略口径
```

接手任何工具时：先读 `DEV-README.md` 找工具 → 打开 `docs/tools/<slug>/README.md` 理解架构 → 打开 `README-FOR-AI.md` 理解 AI 行为。

### 约定 6：Vercel Hobby 上限 12 Functions，优先用 action 路由合并

Vercel Hobby 计划每个 Deployment 最多 12 个 Serverless Functions（`api/` 目录下每个 .js 算一个，`_lib/` 不计入）。

新增功能时优先评估是否可以挂到已有 JS 上，通过 `action` 或 `mode` 参数路由，而不是新建文件。

**已合并案例**：

| 文件 | 路由 | 承载功能 |
|---|---|---|
| `news-summary.js` | `mode=news-summary / daily-report / video / article` | 四种 AI 摘要 |
| `market-report-v2.js` | `?action=price / status / refresh / start / stop` + 默认 | 行情管理 + 市场报告 |

**模式**：在 handler 入口处判断 `req.query.action` 或 `req.body.mode`，分派到不同逻辑分支后提前 return。

### 约定 7：部署时 Push 到 GitHub，VPS 自动生效

推送代码到 GitHub 后，SSH 到 VPS 执行：

```bash
ssh ai_worker@107.175.44.146
cd /home/ai_worker/stock_project && git pull && npm install && pm2 restart donew-backend
```

VPS 是主部署层，Vercel 仅作为冗余 CDN 保留。推送后不再需要 `vercel --prod`。

### 约定 8：标的池体系

完整的标的分类体系在：

```
docs/SellPut/策略/02_标的池子/
├── 核心标的池.md          # 可交易的核心标的
├── ETF标的池.md           # ETF 观察池
├── AI_ETF观察池.md       # AI 主线观察
├── 热门股观察池.md        # 高波动个股观察
└── 禁用与暂停标的池.md    # 不可交易标的
```

市场报告 API 默认读取的"当前关注标的"放在：

```
docs/SellPut/sell-put-focus.json
```

这个 JSON 是 **`02_标的池子/` 中当前活跃交易候选的子集**，所有市场报告 API、AI 分析和策略矩阵都从这个文件读取默认标的列表。

如果你想换一批标的来分析：
- 临时：URL 加 `?focus=TSLA,AAPL,NVDA`
- 永久：编辑 `sell-put-focus.json`
- 完整分类：看 `02_标的池子/` 目录

---

## 8. 新增一个类似工具的标准动作

如果你要加一个新工具，推荐按这个顺序：

1. 先读本文件的“工具总览与新增模板”
2. 跑脚手架
3. 补前端输入项
4. 补 API 业务逻辑
5. 如果需要，接统一行情缓存 `stockprice/data/latest-price.json`
6. 如果需要，接统一新闻缓存 `jin10news/data/latest-24h.json`
7. 补 README
8. 如涉及 K线工具页风格，更新可见版本号

---

## 9. 统一脚手架命令

示例：

```bash
node scripts/create-tool-scaffold.mjs \
  --slug alpha-risk-tool \
  --title "AI Alpha Risk" \
  --api alpha-risk \
  --description "判断当前标的是否进入 alpha 风险区。"
```

会自动生成：

```text
alpha-risk-tool.html
kline_robot_vercel/alpha-risk-tool.html
kline_robot_vercel/api/alpha-risk.js
docs/tools/alpha-risk-tool/README.md
```

---

## 10. 页面 UI 与结果页风格基准

新增工具时，页面风格、控件规格、结果页样式，统一参考：

- [https://donew-beta.vercel.app/kline-robot.html](https://donew-beta.vercel.app/kline-robot.html)

这是当前 donew 最成熟的交互页基准。

### 9.1 页面整体风格

默认遵守：

- 正常页面背景以浅色 / 白色为主
- 左侧是控制面板
- 右侧是结果区
- 结果报告本身可以使用深色底
- 不要把整个页面都做成深色，除非用户明确要求

### 9.2 控件风格

控件尽量和 `kline-robot.html` 保持一致：

- 输入框高度、圆角、边框粗细一致
- Tab 按钮风格一致
- 主按钮使用统一的蓝色实底
- 次按钮使用浅底 + 深色文字
- 按钮不要忽大忽小
- 同一行按钮高度必须统一
- 文本大小不要忽大忽小

### 9.3 标准页面功能

一个“生成型工具”默认应该尽量具备以下标准功能：

1. 新窗口打开报告
2. 下载 HTML
3. 下载图片
4. 图片共享
5. 可见版本号
6. 访问次数
7. 返回十方斋首页

说明：

- `kline-robot.html` 本身目前缺少“图片共享”
- 以后新增工具时，建议把“图片共享”补成标准功能
- 如果旧工具后续重构，也可以向这个标准靠齐
- 图片导出不要直接截 `doc.body`。报告 HTML 应有 `.page` 内容容器；前端导出时用 `doc.querySelector(".page") || doc.body` 作为 html2canvas 目标，并在截图前临时把 iframe 高度撑到 `content.scrollHeight + 40`，截图后用 `finally` 恢复原高度，避免只截可见区域或出现顶部/底部大空白。

### 9.4 结果页风格

结果页默认参考 `kline-robot.html`：

- 右侧结果区先显示摘要卡片
- 再显示操作按钮
- 再显示完整报告预览
- 报告预览适合深色底
- 重要结论、关键标签可以高亮
- 普通正文不要全篇高亮

### 9.5 字体与颜色规则

默认规则：

- 普通正文：白色 / 浅灰
- 次要说明：灰色
- 重点结论：黄色
- 上涨 / 偏多：绿色
- 下跌 / 偏空：红色
- 中性 / 观察：黄色或中性色

注意：

- 不能整段都变成黄色
- 黄色应该只给真正结论性内容
- 表格里的代码、普通字段不要全部黄字加粗
- 结果页必须区分“标题、重点句、正文、数据、警示”

### 9.6 标准体验要求

新增工具如果是“报告型工具”，默认应该支持：

- 最近一次报告自动恢复
- 明确显示原生成时间
- 必要时显示浏览器保存时间
- 新窗口打开后的报告样式和内嵌预览保持一致

### 9.7 开发时不要随便发明新风格

优先级：

1. 先复用 `kline-robot.html` 的布局和按钮风格
2. 再做少量必要改动
3. 不要每个工具重新发明一套视觉系统

如果用户没有明确要求新风格，就默认“与 K线相识度工具一致”。

---

## 11. 推荐给新对话直接复制的提示词

给新智能体对话时，直接发以下内容：

```text
仓库：https://github.com/jiangshenhk/donew
本地：/Users/jiangshen/Desktop/Obsidian/学习/收集箱/Codex相关/donew

我要修改这个工具：https://donew-beta.vercel.app/sell-put-decision-tool.html

你先读：
1. DEV-README.md 第 13 章确认工具名称和文档位置
2. 打开对应的 README.md 理解架构和数据流
3. 打开对应的 README-FOR-AI.md 理解 AI 提示词和行为约束

遵守 DEV-README 全部约定：不要默认推送、改后更新版本号、不加新 API 文件（用 action 路由）、推送后 vercel --prod --yes。
```

把 `sell-put-decision-tool.html` 替换成实际要改的工具入口。

---

## 12. 最后一句

如果你只记住一件事：

> **先读 `DEV-README.md`，再决定改哪一层。新增工具优先跑脚手架。**

---

## 13. 工具总览与新增模板

这一章合并了原来的工具总览文档，以后以这里为准。

### 13.1 当前工具全景

| 工具 | 入口 | API | README | README-FOR-AI | 类型 |
| --- | --- | --- | --- | --- | --- |
| K线相识度 | `kline-robot.html` | `report.js` | `docs/tools/kline-robot/README.md` | `docs/tools/kline-robot/README-FOR-AI.md` | 交互式 |
| 24小时新闻中心 | `jin10-news.html` | `news-summary.js` | `jin10news/README.md` | `docs/tools/jin10-news/README-FOR-AI.md` | 数据中心 |
| 最新行情中心 | `price-test.html` | `market-report-v2.js` | `stockprice/README.md` | —（无 AI） | 数据中心 |
| 日报/晚报自动生成 | Actions | `news-summary.js` | `docs/市场/README.md` | `docs/tools/jin10-news/README-FOR-AI.md` | 定时生成 |
| 每日/周市场分析 | `market-analysis-tool.html` | `market-report-v2.js` | `docs/市场/README.md` | `docs/tools/market-analysis/README-FOR-AI.md` | 交互式 |
| 综合卖Put决策 | `sell-put-decision-tool.html` | `sell-put-decision.js` | `docs/tools/sell-put-tool/README.md` | `docs/tools/sell-put-tool/README-FOR-AI.md` | 交互式 |
| 综合卖Put决策 | `sell-put-decision-tool.html` | `sell-put-decision.js` | `docs/tools/sell-put-decision/README.md` | `docs/tools/sell-put-decision/README-FOR-AI.md` | 交互式 |
| 卖Put标的池扫描 | `sell-put-pool-tool.html` | `barchart-overview.js` | `docs/tools/sell-put-pool-tool/README.md` | —（无 AI） | 批量初筛 |
| 八字命理分析 | `bazi-analysis-tool.html` | `bazi-analysis.js` | `docs/tools/bazi-analysis-tool/README.md` | `docs/tools/bazi-analysis-tool/README-FOR-AI.md` | 交互式 |
| 内容总结分析 | `video-summary-tool.html` | `news-summary.js` | `docs/tools/video-summary-tool/README.md` | `docs/tools/video-summary-tool/README-FOR-AI.md` | 交互式 |
| Sell Put Agent | `scripts/sell-put-agent.mjs` | —（CLI） | `docs/tools/sell-put-agent/README.md` | —（内嵌 prompt） | CLI 自动 |
| 短线K线交易机器人 | `scripts/short-term-trader.mjs` | —（CLI） | `docs/tools/short-term-trader/README.md` | `docs/tools/short-term-trader/README-FOR-AI.md` | CLI 自动 |

### 13.2 十个工具分别怎么看

#### K线相识度

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

这是“单标的、单次分析”的代表模板。

#### 24小时新闻中心

- 入口页：`https://donew-beta.vercel.app/jin10-news.html`
- 数据目录：
  - `jin10news/`
- 展示页：
  - `kline_robot_vercel/jin10-news.html`
- 主要 API：
  - `kline_robot_vercel/api/news-summary.js`

这是“先抓缓存，再由页面消费缓存”的代表模板。

#### 最新行情中心

- 管理页：`https://donew-beta.vercel.app/price-test.html`
- 缓存文件：
  - `stockprice/data/latest-price.json`
- 读取 API：
  - `kline_robot_vercel/api/latest-price.js`

本质上是统一行情底座，不是普通分析页。

#### 日报周报自动生成器

- 没有单独交互页
- 结果写入：
  - `docs/市场/每日市场早报.md`
  - `docs/市场/每日市场晚报.md`
  - `docs/市场/今日.md`
  - `docs/市场/历史.md`

这是“定时生成型工具”的模板。

#### 最新每日/每周市场情况分析

- 入口页：`https://donew-beta.vercel.app/market-analysis-tool.html`
- 前端页面：
  - `market-analysis-tool.html`
  - `kline_robot_vercel/market-analysis-tool.html`
- 主要 API：
  - `kline_robot_vercel/api/market-report-v2.js`

这是“多资产快照 + AI整理 + HTML/Markdown展示”的代表模板。

#### 市场报告的双入口共用关系

“最新每日 / 每周市场情况分析”和“日报 / 晚报自动生成器”不是两套互不相关的工具，而是 **同一套市场判断思路，在两个执行位置使用**：

```text
同一套策略基线 / 市场判断原则 / 风险字段
  ├── 网页手工生成：market-analysis-tool.html -> /api/market-report-v2
  └── 自动生成：GitHub Actions -> scripts/generate-market-daily-report.mjs
```

两条链路的职责不同：

- 网页手工生成：用户即时点击，生成每日 / 每周市场分析，重点是交互与即时展示。
- 自动生成：按计划运行，生成早报 / 晚报并写入 `docs/市场/`，重点是稳定落地和历史记录。

开发要求：

- 两条链路应共享同一套核心判断思路、关键字段和策略口径。
- 可以有不同的执行入口和输出格式，但不能出现相互矛盾的市场结论标准。
- 修改市场报告规则、风险列、黑天鹅判断、卖 Put 动作约束时，必须同时检查手工与自动两条链路。
- 使用 `.github/workflows/verify-market-generation-paths.yml` 做双链路结构校验，避免只修好网页或只修好自动生成。
- 不要让网页 API 依赖一个看似废弃的 `_old` 文件；正式入口应保持依赖关系清晰、可独立部署。

#### 卖 Put 温度判断 ⚠️ 已暂停维护

> 功能已被 [综合卖Put决策](#35-综合卖-put-决策) 完全覆盖。该工具保留但不再更新。
- 入口页：`https://donew-beta.vercel.app/sell-put-tool.html`
- 前端页面：
  - `sell-put-tool.html`
  - `kline_robot_vercel/sell-put-tool.html`
- 主要 API：
  - `kline_robot_vercel/api/put-rating.js`

这是“截图 OCR + 行情快照 + AI结论”的代表模板。

#### 综合卖Put决策

- 入口页：`https://donew-beta.vercel.app/sell-put-decision-tool.html`
- 前端页面：
  - `sell-put-decision-tool.html`
  - `kline_robot_vercel/sell-put-decision-tool.html`
- 主要 API：
  - `kline_robot_vercel/api/sell-put-decision.js`
  - `kline_robot_vercel/api/_lib/sell-put-decision-core.js`（完整性、期权温度、市场/K线风险、事件扫描）
  - `kline_robot_vercel/api/report.js` 的 `analyzeKlineStructure()`（共享K线相似度、历史样本、ABC/2B结构）
  - `kline_robot_vercel/api/put-rating.js` 的 `analyzePutRatingSnapshot()`（与独立卖Put温度工具共享市场和期权温度判断）
  - `kline_robot_vercel/api/news-summary.js` 的 `loadRecentMarketNews()` / `analyzeDecisionNews()`（与新闻中心共享24小时读取、相关性筛选和事件扫描）
  - `kline_robot_vercel/api/options-ranking.js`（美股热门期权标的榜，辅助选择输入代码）
  - `kline_robot_vercel/api/options-signals.js`（Barchart延迟IV异动与异常成交榜）
  - `kline_robot_vercel/api/barchart-overview.js`（按单一美股代码读取Barchart期权概览）
- 策略文档：
  - `docs/SellPut/SellPut策略/sell-put-decision-tool.md`
- 数据依赖：
  - `stockprice/data/latest-price.json`（统一行情底座）
  - `jin10news/data/latest-24h.json`（新闻缓存，用于事件风险扫描和 AI 上下文）
  - K线工具共享引擎（底层行情由 `report.js` 统一处理）
  - Barchart Options Overview 免费网页（优先按标的读取期权概览，通常延迟约25至30分钟）
  - 浏览器端 Tesseract.js（用户在“手工修改”中主动识别截图；图片不进入生成 API）
  - DeepSeek（AI 综合判断生成报告；本工具不调用 OpenAI）
  - Webull Options Total Volume Ranking 公开页（热门期权标的候选榜）
- 核心逻辑：
  - 严格完整性门槛：关键行情、相关新闻、K线结构、期权温度、具体合约缺一项就只输出预检查；行权价和权利金必须为正数，到期日必须是未来有效日期
  - Barchart字段映射：支持 IV/IV变化/HV/Percentile/Rank/IV高低点及日期/Expected Move与DTE和Range/Put-Call比率/成交量/持仓量
  - 期权参数前置流程：用户必须先点击“自动获取期权参数”，前端单独调用 `/api/barchart-overview?symbol=QLD` 并填入当前标的默认值；未成功执行该步骤时，前端禁止启动报告生成
  - 手工校正入口：“手工修改”是文字链接，展开后提供站外 Barchart 参数页、上传/粘贴截图、本地 OCR 和逐项输入；截图只在浏览器中处理，不随 `/api/sell-put-decision` 请求上传
  - 标的隔离：切换市场、输入新标的、载入历史参数或从热门榜选择标的后，前端清除旧期权温度字段并要求重新自动获取，避免串用上一只标的数据
  - 期权数据溯源：报告的期权温度数据块记录 Barchart 来源、数据获取时间和延迟说明；10分钟内成功结果可由服务实例缓存复用
  - 旧输入兼容：具体合约字段留空时，可从补充说明中的“行权价、中间价、到期日”自动提取
  - 四维数据聚合：行情快照 + 24小时相关新闻 + K线相似度/历史样本/ABC结构 + 前台已确认的Barchart标的级期权概览
  - 三层风险：大盘环境 + ATR/趋势/跌幅 + K线历史偏空概率/高匹配偏空形态
  - 事件风险：代码扫描24小时相关新闻；AI不得凭训练记忆补未来事件日期
  - 结论一致性：AI只能比规则底线更谨慎，冲突或无标准结论时使用规则版
  - 规则版完整输出：AI不可用或结论冲突时，仍展示共享K线相似度/历史样本、24小时相关新闻、期权温度和合约安全垫
  - 报告时间：预检查、规则版和AI版标题下均显示精确到秒的香港时间
  - 行情优先级：当前输入标的优先复用K线分析链路取得的最新行情；取不到完整价格、昨收和涨跌幅时，回退到 `stockprice/data/latest-price.json`。其余市场背景代码统一读取行情中心
  - 六节结构化报告：综合结论 → 市场环境 → 期权温度解读 → K线技术信号 → 综合卖Put建议 → 未来关注清单
  - K线技术信号固定前两行：第一行以“趋势：”展示均线和强弱，第二行以“典型K线匹配：”展示共享K线引擎返回的形态、匹配度和方向；服务端会补齐AI遗漏的第二行
  - 结论措辞固定为"可卖Put / 谨慎卖Put / 暂不卖Put"，不会输出股票买卖建议
  - 标准功能：新窗口打开、下载 HTML、保存图片（html2canvas）、图片分享、历史报告导入对比、最近报告自动恢复
  - 页面入口固定为“自动获取期权参数”按钮 + “手工修改”链接；自动获取与报告生成是两个独立请求，生成接口只接收结构化字段，不负责Barchart读取或截图解析
  - 生成等待提示：报告预览区显示已用时间和当前预计阶段，工具栏下方不重复显示同一行状态；由于后端是单次 HTTP 请求，不把时间推测表述为服务端真实进度
  - 热门期权榜：标的输入框旁可打开候选榜，点击代码直接填入；三个榜单统一采用“原始数据 → 搜索/按列多选筛选 → 排序 → 分页 → 渲染”的本地处理管线
  - IV与异常成交：同一弹窗分为“成交量Top 100 / IV异动 / 异常成交”三个标签，支持列头升降序、逐列筛选、每页数量和翻页，避免把不同信号混为一个排名
  - 榜单后续操作：每行提供“本站分析”（携带 `symbol` 打开综合卖Put决策页）和“网上行情”（打开 Yahoo Finance）两个独立链接

##### 热门期权标的榜数据约定

- 接口：`GET /api/options-ranking?limit=100`
- 主数据源：`https://www.webull.com/quote/us/options`
- 排名粒度：按股票/ETF标的汇总，不是单张期权合约排名
- Webull 页面使用的 `totalVolume` 分页接口每页返回50名；后端并行读取前两页，合并为真实Top 100
- 如果外部接口实际返回不足100名，接口会返回真实 `count` 并设置 `publicSourceLimit: true`，前端必须如实显示实际数量，不得补齐、复制或伪称100名
- 原始字段：期权总成交量、未平仓量、Call/Put成交量比、Call/Put OI比、标的价格与涨跌
- Call占比是推算值：`Call/Put ÷ (1 + Call/Put) × 100%`，界面必须同时保留原始 Call/Put 比率
- Webull公开榜不提供IV异动字段。没有第二个可靠数据源前，不增加或推测“IV异动排行”
- 服务端内存缓存10分钟，并设置 CDN 缓存头；`force=1` 只用于用户主动刷新
- 外部页面结构变化或限流时，接口应明确返回失败，不使用旧值冒充实时榜单

##### IV异动与异常成交榜数据约定

- 接口：
  - `GET /api/options-signals?type=iv-change`
  - `GET /api/options-signals?type=unusual-volume`
- 数据源：
  - `https://www.barchart.com/options/volatility-percent-change/increase`
  - `https://www.barchart.com/options/volume-change/stocks`
- 后端先访问公开页面建立免费会话，再携带Cookie与XSRF凭证读取页面自身的数据接口；不保存用户账号、密码或长期会话
- 免费榜单当前返回前20条，并返回源内 `totalAvailable`。前端必须显示“免费显示前20”，不能伪称完整榜单
- Barchart公开期权数据通常延迟约25至30分钟；前端必须明确显示延迟说明和本次抓取时间
- IV异动字段：标的、期权合约、Call/Put、到期日、DTE、行权价、当前IV、IV变化、成交量、Delta
- 异常成交字段：标的、期权总成交量、相对月均成交量变化、Put/Call成交量、Put/Call比率、IV Rank、标的涨跌
- IV升高不等于看涨，也不等于适合卖Put；异常成交可能来自保护性Put、事件对冲或投机。这里只提供候选筛选，最终仍由卖Put决策流程判断
- 服务端内存缓存10分钟；外部会话建立失败或接口返回401时明确报错，不回填猜测值

这是“四维数据聚合 + 共享子工具判断 + 单次AI综合”的代表模板，也是在现有工具之上的聚合决策层，不替换原有独立工具。聚合工具不得复制一套简化版子工具算法；应优先调用各独立工具导出的结构化函数。

#### 卖Put标的池扫描

- 入口页：`https://donew-beta.vercel.app/sell-put-pool-tool.html`
- 前端页面：
  - `sell-put-pool-tool.html`
  - `kline_robot_vercel/sell-put-pool-tool.html`
- 复用 API：
  - `GET /api/barchart-overview?symbols=QLD,MSTR,INTC`
- 详细说明：
  - `docs/tools/sell-put-pool-tool/README.md`

这是卖Put流程的第一层批量候选筛选：

- 只使用Barchart标的级期权概览进行溢价排序，不在这一层混入新闻、K线或具体合约结论。
- 排序维度包括IV-HV、IV Rank、IV Percentile、Expected Move、Put/Call结构、成交量和Open Interest。
- 高IV若同时伴随极端Expected Move或Put成交拥挤，标记为“高风险恐慌溢价”，不能当作普通卖方优势。
- 点击候选后跳转到 `sell-put-decision-tool.html?symbol=XXX`，再进行新闻、行情、K线、期权和具体合约的完整判断。
- 批量接口最多接收12个去重后的美股代码，并逐个读取；单个失败只进入错误列表，不把缺失值写成0。
- Barchart页面未直接渲染完整概览时，接口复用该页面建立的Cookie/XSRF会话读取同源Quotes数据；仍缺少的字段保持为空并在评分中降级。
- 页面保存最近一次扫描报告，并提供新窗口、HTML、JPG和图片分享。

#### 八字命理分析

- 入口页：`https://donew-beta.vercel.app/bazi-analysis-tool.html`
- 前端页面：
  - `bazi-analysis-tool.html`
  - `kline_robot_vercel/bazi-analysis-tool.html`
- 主要 API：
  - `kline_robot_vercel/api/bazi-analysis.js`
- 详细说明：
  - `docs/tools/bazi-analysis-tool/README.md`

基于中国传统八字命理学的 AI 分析工具。八字排盘在浏览器端纯前端计算，AI 分析通过 DeepSeek 增强。报告含命理综合评分、八字排盘、五行旺衰、大运走势、流年简析。支持 120 秒超时自动解锁。

#### 内容总结分析（视频/文章）

- 入口页：`https://donew-beta.vercel.app/video-summary-tool.html`
- 前端页面：
  - `video-summary-tool.html`
  - `kline_robot_vercel/video-summary-tool.html`
- 共用 API：
  - `kline_robot_vercel/api/news-summary.js`（`mode=video` / `mode=article`）
- 详细说明：
  - `docs/tools/video-summary-tool/README.md`

支持 YouTube、B站视频字幕提取和网页文章的 AI 总结分析。平台自动识别，生成结构化摘要，含内容概览、核心要点、关键结论和 AI 深度分析（机会信号、风险提示、背景补充、延伸思考）。

#### 短线K线交易机器人

- 入口：`node scripts/short-term-trader.mjs run`
- CLI 脚本：
  - `scripts/short-term-trader.mjs`
- 主要依赖：
  - Yahoo Finance 5分钟K线数据
  - DeepSeek Chat API（纯技术面分析）
- 数据存储：`~/.donew-trader/`（独立于仓库）
- 核心逻辑：
  - 每5分钟拉取 QQQ/IBIT/MSTR 的5分钟K线，计算技术指标（EMA/MACD/RSI/ATR/价位），DeepSeek 生成 BUY/HOLD 信号，模拟下单和成交
  - 仅做多，入场需置信度 ≥ 60，止盈止损由 AI 每笔交易时确定
  - 风险规则：同标的不重复、最大 3 笔持仓、非美股交易时段跳过
  - 仪表板：持仓/交易记录/信号日志/统计/K线图 五标签页
  - 自动化：launchd 每5分钟运行，脚本内判断美股交易时段
  - 模拟成交：下根K线价格执行，止盈止损触及后按穿透价平仓

### 13.3 新增工具先判断类型

#### 类型 A：交互式网页工具

例子：

- K线相识度
- 市场情况分析
- 卖 Put 温度判断
- 综合卖Put决策
- 卖Put标的池扫描
- 八字命理分析
- 内容总结分析

特征：

- 用户打开网页，输入参数，点击生成
- 结果通常是 HTML 报告
- 需要配套一个或多个 API

#### 类型 B：数据中心

例子：

- 24小时新闻中心
- 最新行情中心

特征：

- 先定时抓取，落缓存
- 多个工具共享同一份缓存
- 可能有测试页 / 管理页，但核心不是前台交互

#### 类型 C：自动生成器

例子：

- 日报 / 晚报自动生成器

特征：

- 定时运行
- 产物是 Markdown / JSON / Docs 页面
- 重点是工作流稳定，不是前台即时交互

### 13.4 新增交互式网页工具的标准模板

假设新增一个工具：`alpha-risk-tool`

#### 13.4.1 直接用脚手架程序

```bash
node scripts/create-tool-scaffold.mjs \
  --slug alpha-risk-tool \
  --title "AI Alpha Risk" \
  --api alpha-risk \
  --description "判断某个标的当前是否进入 alpha 风险区。"
```

会自动生成：

```text
alpha-risk-tool.html
kline_robot_vercel/alpha-risk-tool.html
kline_robot_vercel/api/alpha-risk.js
docs/tools/alpha-risk-tool/README.md
```

#### 13.4.2 推荐处理流程

```text
用户打开页面
  -> 前端收集参数
  -> 调用 /api/alpha-risk
  -> API 读取统一缓存 / 外部数据
  -> API 调用 AI 或规则引擎
  -> API 返回 html / markdown / meta
  -> 前端展示、下载、缓存上次报告
```

#### 13.4.3 最小 API 返回结构

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

#### 13.4.4 前端建议统一保留的能力

- 新窗口打开报告
- 下载 HTML
- 下载图片
- 图片共享
- 最近一次报告自动恢复
- 明确显示生成时间
- 历史输入记录（如果适合）

### 13.5 新增数据中心的标准模板

假设新增一个“宏观事件缓存中心”：`macroevents`

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

处理流程：

```text
GitHub Actions 定时触发
  -> scripts/update-events.js
  -> 读取外部源
  -> 清洗 / 去重 / 截窗
  -> 写入 data/latest-events.json
  -> commit 回 main
  -> 交互页 / API 读取这份缓存
```

### 13.6 新增自动生成器的标准模板

假设新增一个“每周复盘生成器”：`weekly-review`

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

处理流程：

```text
定时工作流触发
  -> 组装输入（新闻 / 行情 / 基线策略）
  -> 调用 AI
  -> 验证关键章节
  -> 写入 docs 产物
  -> 更新今日页 / 历史页
  -> commit 回 main
```

### 13.7 当前仓库新增工具的统一约定

#### 命名

- 页面文件：`xxx-tool.html`
- 数据目录：`xxxcenter/` 或 `xxxdata/`
- API：`kline_robot_vercel/api/xxx.js`
- 定时任务：`.github/workflows/update-xxx.yml` 或 `generate-xxx.yml`

#### 结果落地

- 缓存型数据：放 `data/`
- 人读的报告：放 `docs/市场/` 或对应专题目录
- 技术说明：放各目录 `README.md`

#### 修改优先级

如果一个功能同时有根目录页面和 `kline_robot_vercel/` 页面：

1. 先确认线上实际走的是哪一份
2. 如需保持一致，成对修改
3. 页面改动后，记得更新可见版本号，方便确认前端是否真的刷新


如果一个市场报告规则同时用于网页手工生成和日报 / 晚报自动生成：

1. 先确认两条真实调用链。
2. 同步检查策略字段、风险列和输出口径。
3. 分别验证网页手工生成与 GitHub Actions 自动生成。
4. 任何一条链路失败，都不能视为任务完成。

---

## 14. 部署说明

donew 当前部署架构：

```text
                    donew 仓库 (github.com/jiangshenhk/donew)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  RackNerd VPS (主)        Vercel (冗余)      Cloudflare Workers
  Nginx + PM2 + Cron        静态页面托管          K线代理 Worker
  107.175.44.146            donew-beta.vercel.app
  ├── 前端页面 (所有工具)
  ├── API /api/ai/* (6个AI接口)
  ├── API /api/stock/* (行情)
  ├── API /api/news/* (新闻)
  ├── 交易机器人 (短线/长线/SellPut)
  └── SQLite 数据存储
```

### 14.1 VPS — 主部署层（前端 + 后端 + 定时任务）

**线上地址**：`http://107.175.44.146`

**项目目录**：`/home/ai_worker/stock_project/`（对应仓库 `vps-backend/`）

这是项目的核心部署层，承载全部工具前端、API 和定时任务。

**部署流程**：

```bash
# 1. SSH 到 VPS
ssh ai_worker@107.175.44.146

# 2. 拉取最新代码
cd /home/ai_worker/stock_project
git pull

# 3. 安装依赖
npm install

# 4. 重启服务
pm2 restart donew-backend
pm2 logs donew-backend
```

**Cron 定时任务**：
| 任务 | 频率 | 脚本 |
|---|---|---|
| 行情抓取 | 每 5 分钟 | PM2 内置 cron |
| 金十新闻 | 每 5 分钟 | PM2 内置 cron |
| 短线K线交易 | 每 5 分钟 | 系统 cron |
| 长线趋势交易 | 每日 17:00 HK | 系统 cron |
| SellPut 纸面 | 每日 08:00 HK | 系统 cron |
| 市场周报 | 周六 09:00 HK | 系统 cron（`run-weekly-report.sh`，走 VPS 本地 AI 端点） |

**环境变量**（`/home/ai_worker/stock_project/.env`）：
| 变量名 | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API Key（必填） |
| `DEEPSEEK_MODEL` | 默认模型（deepseek-v4-flash） |
| `OPENAI_API_KEY` | OpenAI API Key（可选） |
| `ALLOWED_ORIGINS` | CORS 允许的源 |
| `PORT` | 服务端口（默认 3000） |
| `NEWS_SUMMARY_API` | 日报/晚报/周报 AI 端点（VPS 本地 `http://127.0.0.1:3000/api/ai/news-summary`） |

### 14.2 Vercel — 前端 CDN（冗余，待退役）

**线上域名**：`https://donew-beta.vercel.app`

**对应目录**：`kline_robot_vercel/`

当前仅保留静态页面托管，所有 API 调用已指向 VPS。浏览器 HTTPS→HTTP 混合内容限制，推荐直接使用 VPS 访问。

### 14.3 Cloudflare Workers — K线代理

**配置文件**：`kline_robot_worker/wrangler.toml`

### 14.4 GitHub Actions — 数据管道（冗余）

5 个流水线负责定时抓数据、生成报告，与 VPS cron 并行运行（双冗余）。

### 14.5 GitHub Pages — 已迁移

静态文档站已迁移到 VPS `http://107.175.44.146/docs/`。GitHub Pages 域名 `jiangshenhk.github.io/donew` 保留但不更新。
