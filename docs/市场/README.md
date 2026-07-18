# 市场日报 / 周报自动生成链路说明

这个目录同时承接两件事：

1. 自动生成器的产物落地；
2. Docsify / 网站公开阅读入口。

所以不要把它理解成“只是存 Markdown 的地方”。

---

## 1. 它对应的不是单独一个网页工具

这里对应的是一条自动化链路：

```text
GitHub Actions
  -> scripts/generate-market-daily-report.mjs
  -> lib/market-report-core.mjs
  -> Vercel AI 接口 / 新闻缓存 / 行情缓存
  -> 输出到 docs/市场/
```

相关公开入口：

- 今日汇总页：`https://jiangshenhk.github.io/donew/#/docs/市场/今日.md`
- 历史页：`https://jiangshenhk.github.io/donew/#/docs/市场/历史.md`
- 前台即时工具页：`https://donew-beta.vercel.app/market-analysis-tool.html`

注意：

- `market-analysis-tool.html` 是“手工即时生成工具”
- 本目录对应的是“自动化定时生成器”

两者会复用相近的逻辑和内容模板，但不是一回事。

---

## 2. 关键文件

### 本目录产物

- `每日市场早报.md`
- `每日市场晚报.md`
- `今日.md`
- `历史.md`
- `data/latest-morning.json`
- `data/latest-evening.json`

### 上游脚本

- `.github/workflows/generate-market-daily-reports.yml`
- `scripts/generate-market-daily-report.mjs`
- `scripts/test-market-daily-report.mjs`
- `scripts/validate-market-report.mjs`
- `lib/market-report-core.mjs`

### 内容基线

- `docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md`

这个文件是“生成模板和策略基线”，不是普通参考文档。

---

## 3. 自动化处理流程

```text
工作流按时间触发
  -> 判断当前生成 morning 还是 evening
  -> 校验策略基线文档是否存在
  -> 读取新闻缓存 jin10news/data/latest-24h.json
  -> 读取行情缓存 stockprice/data/latest-price.json
  -> 由 market-report-core.mjs 组装 prompt
  -> 调用 /api/news-summary 的 daily-report 模式
  -> 产出 Markdown
  -> validate-market-report.mjs 校验关键结构
  -> 写回 docs/市场/
  -> 更新 今日.md / 历史.md
  -> commit 回 main
```

---

## 4. 工作流触发时间

工作流文件：

- `.github/workflows/generate-market-daily-reports.yml`

当前调度：

- 工作日早报
- 工作日晚报
- 支持 `workflow_dispatch` 手动指定 `morning` / `evening`

如果以后新增“周报自动生成器”，建议直接沿用这一套：

- `generate-xxx.mjs`
- `test-xxx.mjs`
- `validate-xxx.mjs`
- `README.md`

---

## 5. 输入依赖

### 新闻

- `jin10news/data/latest-24h.json`

脚本内部会再做最近 48 小时窗口筛选。

### 行情

- `stockprice/data/latest-price.json`

### 模板 / 策略基线

- `docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md`

---

## 6. 输出规则

自动生成器至少会写这些文件：

### 固定文件

- `每日市场早报.md`
- `每日市场晚报.md`

### 带日期归档

- `YYYY-MM-DD市场结构日报(早报).md`
- `YYYY-MM-DD市场结构日报(晚报).md`

### 汇总文件

- `今日.md`
- `历史.md`

### 状态文件

- `data/latest-morning.json`
- `data/latest-evening.json`

---

## 7. 为什么有“测试脚本 + 校验脚本”

### `generate-market-daily-report.mjs`

真正负责生成内容。

### `test-market-daily-report.mjs`

把生成和校验串起来跑一遍。

### `validate-market-report.mjs`

检查最低结构要求，例如：

- 关键章节是否存在
- 关键标的是否出现
- 关键逻辑（如黑天鹅、大跌风险）是否没有丢

这套设计是为了让后续智能体改 prompt 或改格式时，不会无声把链路改坏。

---

## 8. 和前台“市场情况分析工具”的关系

### 自动生成器

- 定时生成；
- 回写 `docs/市场/`；
- 主要服务公开阅读页与历史归档。

### `market-analysis-tool.html`

- 用户手工点击即时生成；
- API 在 `kline_robot_vercel/api/market-report-v2.js`；
- 主要服务“此刻临时看一眼市场”。

两者关系：

- 都依赖新闻和行情中心；
- 都依赖同一套市场分析框架；
- 但一个重“自动沉淀”，一个重“即时交互”。

---

## 9. 修改时先看哪里

### A. 自动早报 / 晚报没生成

先看：

- `generate-market-daily-reports.yml`
- Actions 日志

### B. 报告结构不对

先看：

- `lib/market-report-core.mjs`
- `scripts/validate-market-report.mjs`

### C. 内容方向不对

先看：

- `docs/SellPut/日报周报/策略_每日市场判断怎么看GPT提示词.md`
- `scripts/generate-market-daily-report.mjs`

### D. 行情或新闻缺失

先看：

- `stockprice/data/latest-price.json`
- `jin10news/data/latest-24h.json`

---

## 10. 给后续智能体的扩展模板

如果你想新增一个同风格自动生成器，比如“每周复盘”：

建议最少新增：

```text
scripts/generate-weekly-review.mjs
scripts/test-weekly-review.mjs
scripts/validate-weekly-review.mjs
lib/weekly-review-core.mjs
.github/workflows/generate-weekly-review.yml
docs/市场/README.md
```

推荐顺序：

1. 先把输入源定好；
2. 再把 prompt 组装抽到 `lib/*-core.mjs`；
3. 再补 `validate-*.mjs`；
4. 最后接入工作流。
