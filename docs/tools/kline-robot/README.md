# K线相似度工具

## 线上入口

`https://donew-beta.vercel.app/kline-robot.html`

## 功能概述

输入任一美股标的，自动抓取近 3 个月 K线数据，与经典形态库进行特征匹配，结合历史趋势统计和 ABC/2B 结构分析，通过 AI 给出综合解读。

## 代码位置

- 前端：`kline-robot.html`、`kline_robot_vercel/kline-robot.html`
- API：`kline_robot_vercel/api/report.js`
- Cloudflare Worker（K线代理）：`kline_robot_worker/src/worker.js`

## 设计思路

### 数据流

```
用户输入标的 + 参数
  → Cloudflare Worker 代理 Yahoo Finance chart API
  → 前端形态匹配引擎（规则分 + 图形分双维度）
  → 历史趋势统计（相似形态出现后的涨跌概率）
  → ABC/2B 结构分析
  → AI 系统 prompt + JSON payload → DeepSeek/GPT 生成解读
  → 前端展示 HTML 报告 + K线图标注 + 形态卡片
```

### 形态匹配

- **双维度评分**：规则分（价格位置、成交量等）+ 图形分（形态几何特征）
- **最小匹配阈值**：60%，低于阈值不强行套形态
- **确认位/失败位**：直接在 K线图上标注，AI 不重复输出

### ABC/2B 结构

- 检测近似 ABC 三段式回调结构（A段下跌、B段反弹、C段再测）
- 2B 法则：突破前高后快速回落，视为假突破信号
- 历史趋势统计：查找历史上相似结构出现后 N 天的涨跌概率分布

### 降级策略

- Yahoo Finance API 失败 → 回退东财备用数据源
- AI 不可用 → 仅展示规则版形态匹配，不调用 AI

## API

`kline_robot_vercel/api/report.js`

- 参数：`symbol`, `range`, `interval`, `maxMatchBars`, `trendSampleScope`
- 返回：JSON（含 `html` 报告、`cards` 形态卡片、`historicalTrendStats`、`analysisAngles`）
- AI 调用：优先级 DeepSeek → OpenAI 回退

## AI 提示词

见 `docs/tools/kline-robot/README-FOR-AI.md`

## Cloudflare Worker

`kline_robot_worker/` — 代理 Yahoo Finance chart API，绕过浏览器端 CORS 限制。

配置：
```toml
name = "kline-robot"
main = "src/worker.js"
[vars]
OPENAI_MODEL = "gpt-5"
ALLOWED_ORIGIN = "https://jiangshenhk.github.io"
```

## 标准功能

- 新窗口打开报告
- 下载 HTML
- 保存图片（html2canvas → JPG）
- 最近报告自动恢复
- 历史输入记录
