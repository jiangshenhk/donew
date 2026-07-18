# donew 开发接力说明（DEV-README）

这份文件是给“新开的智能体对话 / 新接手的开发者”看的。

目标只有一个：

> 用最少的阅读成本，快速理解 donew 这套工具系统，并且按现有风格继续开发，不乱改、不串层、不误推。

这份文档是 **Codex 与 ChatGPT 共同读取的主开发说明**。两边接手 donew 任务时，都应先读本文件，再按任务类型补读对应目录的 README，避免不同智能体对仓库结构产生两套理解。

---

## 1. 你接手的是一个什么仓库

`donew` 不是单一网页，而是一组相互配合的工具系统，主要包含：

1. K线相识度工具
2. 24小时新闻中心
3. 最新行情中心
4. 自动生成的市场早报 / 晚报
5. 最新每日 / 每周市场情况分析工具
6. 卖 Put 温度判断工具

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

- [scripts/create-tool-scaffold.mjs](/Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/scripts/create-tool-scaffold.mjs)

作用：

- 直接生成新工具的页面、API、README 脚手架

### 必读 3：如果要改线上交互工具

- [kline_robot_vercel/README.md](/Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/kline_robot_vercel/README.md)

作用：

- 理解哪些页面是 Vercel 线上主入口
- 理解页面与 API 的对应关系

---

## 3. 按任务类型选择继续读什么

### A. 改新闻相关

读：

- [jin10news/README.md](/Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/jin10news/README.md)

### B. 改行情相关

读：

- [stockprice/README.md](/Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/stockprice/README.md)

### C. 改自动早报 / 晚报链路

读：

- [docs/市场/README.md](/Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/docs/市场/README.md)

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
- 卖 Put 温度判断：`https://donew-beta.vercel.app/sell-put-tool.html`
- 最新行情管理页：`https://donew-beta.vercel.app/price-test.html`

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

### 约定 2：如果是 K线工具页面改动，要改可见版本号

原因：

- 用户通过版本号确认前端是否刷新成功

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

新开一个对话时，可以直接给它这段：

```text
你先读以下文件，再开始动手：

1. /Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/DEV-README.md

如果是新增工具，再读：
2. /Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/scripts/create-tool-scaffold.mjs
3. /Users/jiangshen/Desktop/Obsidian/网络文章/收集箱/Codex相关/donew/kline_robot_vercel/README.md

按 donew 当前结构工作。
除非我明确要求，否则不要推送、不要部署。
如果递交有冲突，只做小范围递交。
```

---

## 12. 最后一句

如果你只记住一件事：

> **先读 `DEV-README.md`，再决定改哪一层。新增工具优先跑脚手架。**

---

## 13. 工具总览与新增模板

这一章合并了原来的工具总览文档，以后以这里为准。

### 13.1 当前工具全景

| 工具 | 线上入口 | 主要代码位置 | 类型 |
| --- | --- | --- | --- |
| K线相识度 | `https://donew-beta.vercel.app/kline-robot.html` | `kline-robot.html`、`kline_robot_vercel/` | 交互式网页工具 |
| 24小时新闻中心 | `https://donew-beta.vercel.app/jin10-news.html` | `jin10news/`、`kline_robot_vercel/jin10-news.html` | 数据中心 + 展示页 |
| 最新行情中心 | `https://donew-beta.vercel.app/price-test.html` | `stockprice/`、`kline_robot_vercel/api/latest-price.js` | 数据中心 + 管理页 |
| 日报周报自动生成器 | 无独立交互页，走 GitHub Actions | `.github/workflows/generate-market-daily-reports.yml`、`scripts/`、`lib/` | 定时生成器 |
| 最新每日/每周市场情况分析 | `https://donew-beta.vercel.app/market-analysis-tool.html` | `market-analysis-tool.html`、`kline_robot_vercel/market-analysis-tool.html`、`kline_robot_vercel/api/market-report-v2.js` | 交互式网页工具 |
| 卖 Put 温度判断 | `https://donew-beta.vercel.app/sell-put-tool.html` | `sell-put-tool.html`、`kline_robot_vercel/sell-put-tool.html`、`kline_robot_vercel/api/put-rating.js` | 交互式网页工具 |

### 13.2 六个工具分别怎么看

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

#### 卖 Put 温度判断

- 入口页：`https://donew-beta.vercel.app/sell-put-tool.html`
- 前端页面：
  - `sell-put-tool.html`
  - `kline_robot_vercel/sell-put-tool.html`
- 主要 API：
  - `kline_robot_vercel/api/put-rating.js`

这是“截图 OCR + 行情快照 + AI结论”的代表模板。

### 13.3 新增工具先判断类型

#### 类型 A：交互式网页工具

例子：

- K线相识度
- 市场情况分析
- 卖 Put 温度判断

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
