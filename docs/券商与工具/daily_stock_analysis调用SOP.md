# daily_stock_analysis 调用 SOP

> 项目来源：<https://github.com/ZhuLinsen/daily_stock_analysis>  
> 定位：用 AI 大模型把行情、K 线、新闻、公告、基本面和自选股数据整理成每日股票分析报告。  
> 使用原则：只作为研究和复盘工具，不直接作为下单指令。

---

## 一、我们为什么用它

`daily_stock_analysis` 适合做三件事：

1. 每天自动分析固定股票池；
2. 汇总行情、新闻、公告、技术指标和风险点；
3. 输出 Markdown 报告、Web 看板或推送到企业微信、飞书、Telegram、Discord、Slack、邮件。

它不适合直接替代我们的 Sell Put 判断。我们的执行顺序仍然是：

```text
市场风向判断
-> 个股动量与 ABC 结构判断
-> 期权链参数判断
-> 最终是否卖 Put
```

`daily_stock_analysis` 只能作为前两步的辅助数据源，尤其是新闻面、催化因素、风险提醒、技术趋势摘要。

---

## 二、项目许可与风险边界

该项目公开在 GitHub，许可证为 MIT License。代码层面可以使用、复制、修改和二次开发，但要保留原始版权和许可声明。

使用时必须注意：

- 项目 README 明确声明：仅供学习和研究，不构成投资建议；
- 行情、新闻、资金流和基本面数据来自第三方源，可能延迟、缺失或变更；
- 大模型输出可能幻觉，不能把“买入、卖出、观望”等标签直接当交易指令；
- 如果用于商业报告、收费社群、自动交易或投顾场景，要额外检查数据源服务条款和合规要求。

---

## 三、推荐部署方式

### 方式 A：GitHub Actions 定时跑

适合不想维护服务器，只想每天自动生成报告。

基本流程：

```text
1. Fork 原仓库
2. 在 GitHub Secrets 里配置 API Key 和股票池
3. 启用 Actions
4. 手动 Run workflow 测试
5. 后续工作日自动运行
```

项目默认支持工作日北京时间 18:00 自动执行，也可以手动触发。

### 方式 B：本地运行

适合我们在本机或服务器上手动调用。

```powershell
git clone https://github.com/ZhuLinsen/daily_stock_analysis.git
cd daily_stock_analysis
pip install -r requirements.txt
copy .env.example .env
```

编辑 `.env` 后运行：

```powershell
python main.py
```

常用命令：

```powershell
python main.py --debug
python main.py --dry-run
python main.py --stocks QLD,MSTR,INTC,EEM
python main.py --market-review
python main.py --webui
python main.py --serve-only
```

### 方式 C：WebUI / API 调用

适合把它当成一个本地分析服务。

```powershell
python main.py --webui
```

默认访问：

```text
http://127.0.0.1:8000
```

如果未来要接入我们自己的自动化脚本，优先考虑：

```text
本地脚本 -> 调用 daily_stock_analysis API/WebUI -> 保存 Markdown 报告 -> 再交给我们的 Sell Put SOP 复核
```

---

## 四、最低配置

至少需要一个可用的大模型 Key。

常见配置项：

| 配置项 | 用途 | 是否必需 |
|---|---|---|
| `STOCK_LIST` | 自选股列表，例如 `QLD,MSTR,INTC,EEM` | 必需 |
| `ANSPIRE_API_KEYS` | 大模型与搜索服务，中文新闻较友好 | 推荐 |
| `AIHUBMIX_KEY` | 多模型聚合服务 | 推荐 |
| `GEMINI_API_KEY` | Gemini | 可选 |
| `OPENAI_API_KEY` | OpenAI 或兼容服务 | 可选 |
| `OPENAI_BASE_URL` | OpenAI 兼容接口地址 | 可选 |
| `OPENAI_MODEL` | 指定模型 | 可选 |
| `SERPAPI_API_KEYS` | 新闻搜索补强 | 推荐 |
| `TAVILY_API_KEYS` | 通用搜索补强 | 可选 |
| `WECHAT_WEBHOOK_URL` | 企业微信推送 | 可选 |
| `FEISHU_WEBHOOK_URL` | 飞书推送 | 可选 |
| `EMAIL_SENDER` / `EMAIL_PASSWORD` | 邮件推送 | 可选 |

我们的优先配置：

```text
STOCK_LIST=QLD,EEM,TQQQ,GDX,ARKK,IBIT,SOFI,RIVN,SMCI,INTC,MSTR,MARA,RIOT,IONQ,HOOD,PLTR
```

固定排除：

```text
CRCL
```

---

## 五、我们每天怎么调用

### 5.1 先跑市场与自选股分析

```powershell
python main.py --stocks QLD,EEM,TQQQ,GDX,ARKK,IBIT,SOFI,RIVN,SMCI,INTC,MSTR,MARA,RIOT,IONQ,HOOD,PLTR
```

如果只想看大盘：

```powershell
python main.py --market-review
```

如果要先测试配置，不真正推送：

```powershell
python main.py --dry-run --stocks QLD,MSTR,INTC,EEM
```

### 5.2 保存输出

每天输出优先保存为 Markdown，文件名建议：

```text
outputs/daily_stock_analysis/YYYY-MM-DD_daily_stock_analysis.md
```

报告里至少保留：

- 每个标的的结论；
- 评分；
- 趋势判断；
- 新闻与催化因素；
- 风险警报；
- 技术面摘要；
- 数据生成时间；
- 使用的数据源或缺失字段说明。

### 5.3 再交给我们的 Sell Put SOP

拿到报告后，不直接下单，而是把它作为输入交给：

```text
docs/SellPut/策略/操作策略_每日卖Put执行总控.md
```

复核顺序：

```text
1. 用 daily_stock_analysis 看新闻、事件、风险点
2. 用我们的市场风向 SOP 判断今天能不能做
3. 用我们的动量与 ABC 结构 SOP 判断哪个标的能做
4. 用 Barchart / 券商期权链确认 Delta、IV、OI、价差和年化
5. 最后输出是否卖 Put、卖哪个 Strike、几张、失效条件
```

---

## 六、接入我们的判断框架

### 6.1 可以直接引用的字段

| daily_stock_analysis 输出 | 我们怎么用 |
|---|---|
| 核心结论 | 作为初筛，不作为最终交易结论 |
| 评分 | 只作为风险温度计 |
| 趋势方向 | 辅助动量判断 |
| 买卖点位 | 不直接采用，只作为支撑/压力参考 |
| 风险警报 | 必须进入今日风险列表 |
| 催化因素 | 用于判断顺风还是事件风险 |
| 新闻摘要 | 辅助市场风向判断 |
| 技术指标 | 与我们自己的 K 线/均线/ABC 判断交叉验证 |

### 6.2 不能直接采用的字段

以下内容必须人工复核：

- “买入 / 卖出 / 观望”；
- “建议买点 / 卖点”；
- 任何具体交易建议；
- 未注明来源的新闻判断；
- 没有期权链数据支持的 Sell Put 推断；
- 没有 Delta、IV、OI、Bid/Ask 的期权结论。

---

## 七、给 AI 的标准调用提示词

每天跑完 `daily_stock_analysis` 后，把输出 Markdown 发给 AI，并使用下面提示词：

```text
请把这份 daily_stock_analysis 报告作为辅助输入，不要把其中的买入、卖出、观望结论直接当作交易指令。

请根据我们的《操作策略_每日卖Put执行总控.md》重新判断：

1. 今日市场风向是否允许 Sell Put；
2. QLD、EEM、TQQQ、GDX、ARKK、IBIT、SOFI、RIVN、SMCI、INTC、MSTR、MARA、RIOT、IONQ、HOOD、PLTR 哪些可以进入技术结构判断；
3. 每个候选标的的新闻面、事件风险、板块风险、技术趋势是否支持卖 Put；
4. 哪些标的必须排除；
5. 哪些标的需要等期权链数据复核；
6. 如果缺少 Delta、IV、OI、Bid/Ask、Expected Move，请明确标注“待券商端复核”，不要自行猜测；
7. 最后只输出符合我们 SOP 的 Sell Put 候选，不要照抄 daily_stock_analysis 的交易结论。

请按以下顺序输出：

一、今日市场总览
二、daily_stock_analysis 中有用的信息
三、需要剔除或降权的信息
四、逐个标的进入/不进入候选的理由
五、需要补充的期权链字段
六、最终 Sell Put 候选与失效条件
```

---

## 八、输出模板

```markdown
# YYYY-MM-DD daily_stock_analysis 辅助复盘

## 一、原始报告摘要

- 数据生成时间：
- 股票池：
- 使用模型：
- 数据源：
- 缺失字段：

## 二、市场风向辅助信息

| 项目 | 结论 | 对 Sell Put 的影响 |
|---|---|---|
| 大盘 |  |  |
| 科技 / 纳指 |  |  |
| 半导体 / AI |  |  |
| Crypto / BTC |  |  |
| 新兴市场 / 中国资产 |  |  |
| VIX / 波动率 |  |  |

## 三、逐个标的摘要

| 标的 | 原报告结论 | 新闻/催化 | 风险警报 | 技术倾向 | 我们的处理 |
|---|---|---|---|---|---|
| QLD |  |  |  |  |  |
| EEM |  |  |  |  |  |
| MSTR |  |  |  |  |  |
| INTC |  |  |  |  |  |

## 四、进入 Sell Put SOP 的候选

| 标的 | 进入原因 | 仍需复核 |
|---|---|---|
|  |  | Delta / IV / OI / Bid-Ask / Expected Move |

## 五、排除标的

| 标的 | 排除原因 |
|---|---|
|  |  |

## 六、最终备注

本报告只作为辅助研究输入。最终是否卖 Put，必须以市场风向、ABC 技术结构、期权链参数和账户风险承受能力共同决定。
```

---

## 九、最终原则

```text
daily_stock_analysis 负责帮我们快读市场。
我们的 SOP 负责决定能不能交易。
券商和 Barchart 负责确认期权链。
账户风险承受能力负责决定仓位。
```

如果四者冲突，优先级为：

```text
账户风险 > 市场风向 > 技术结构 > 期权链收益 > daily_stock_analysis 结论
```
