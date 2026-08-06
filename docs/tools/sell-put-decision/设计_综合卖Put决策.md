# AI综合卖Put决策 - 报告与模块契约

> 本文件是 `sell-put-decision` 的报告格式唯一规范源。代码、提示词、测试和其他设计文档如有冲突，以本文件为准。

## 1. 生产文件

- 页面源文件：`kline_robot_vercel/sell-put-decision-tool.html`
- 根目录镜像：`sell-put-decision-tool.html`
- 生产 API：`vps-backend/src/api/sell-put-decision.js`
- 共享规则：`vps-backend/src/api/_lib/sell-put-decision-core.js`
- VPS 路由：`vps-backend/src/routes/ai.js`
- 回归测试：`vps-backend/src/api/sell-put-decision.test.mjs`

两个 HTML 文件必须保持完全一致。任何页面或流程修改必须升级可见版本号，格式为 `版本号 | 日期时间 | 修改内容`。

## 2. 调用架构

```text
prepare
  -> 读取行情、24小时新闻、期权参数及具体合约
  -> 返回 reportId

analyze-market ─┐
analyze-kline  ─┼-> 后台并行执行，接口立即返回 202 running
analyze-option ─┘
  -> 前端每2秒调用 status
  -> completed / fallback / failed 均为终态

finalize
  -> 使用实际K线ATR重新计算具体合约硬门槛
  -> 执行数据完整性检查
  -> 规则引擎统一裁决
  -> 固定模板组装六节报告
```

AI模块只生成结构化 JSON，不直接生成整份 HTML。最终 HTML 骨架由代码控制，避免三个模块产生不同版式。

## 3. 决策铁律

1. 只允许 `可卖Put`、`谨慎卖Put`、`暂不卖Put` 三种结论。
2. 不输出股票买入、卖出、做多或做空建议。
3. AI只能补充解释或将结论收紧，不能比规则引擎更激进。
4. `execution_gate.approved === false` 时必须是 `暂不卖Put`。
5. 缺少关键行情、新闻、K线、期权温度或具体合约字段时，只输出 `precheck`。
6. 缺失值必须显示 `未取到`，禁止转换为 `0`。
7. 事件与日期只能来自本次24小时新闻，禁止根据训练记忆补造。
8. 尾部风险灯号是启发式信号，不得表述为经过统计校准的黑天鹅概率。

## 4. 三个模块的 JSON 契约

### 4.1 市场模块

必须返回：

- `marketState`、`blackSwan`、`riskScore`、`summary`、`sellPutImpact`
- `details`：4-5项，至少覆盖科技/半导体、波动率、利率/美元、跨资产、综合共振
- `crashRiskReason`：未来3-5日大跌或跳空风险的具体理由
- `newsRisks`、`watchlist`、`improvementSignals`、`deteriorationSignals`

每个 `details` 项格式：

```json
{"label":"科技与半导体情绪","analysis":"引用QQQ、SMH等具体数字，解释信号如何影响卖Put"}
```

### 4.2 K线模块

必须返回：

- `trend`、`technicalRisk`、`support`、`resistance`、`patterns`、`summary`、`sellPutImpact`
- `details`：趋势结构、典型形态、支撑阻力、ATR安全垫、量价配合
- `crashRiskReason`、`watchlist`、`improvementSignals`、`deteriorationSignals`

必须引用 SMA5/10/20/50、1/5/10/20日涨跌、ATR及占比、量比、典型形态名称/匹配度/方向、历史样本与ABC/2B结构。不得把历史条件概率称为黑天鹅概率。

### 4.3 期权模块

必须返回：

- `temperature`、`panicPremium`、`contractApproved`、`summary`、`sellPutImpact`
- `details`：IV/HV、IV历史位置、成交量PCR与持仓PCR、Expected Move、恐慌溢价
- `panicPremiumReason`、`premiumWorth`、`premiumWorthReason`
- `keyRisks`、`ifMustOperate`、`strikeRange`、`specialWarning`、`watchlist`

具体合约的 `contractApproved`、`blockers`、`warnings` 最终必须由代码层覆盖，不能信任AI返回值。

## 5. 六节报告契约

### 5.1 综合结论

- 结论徽章和风险评分。
- 必须逐项回答：
  - 这是不是恐慌溢价？
  - 未来3-5个交易日的大跌/跳空风险？
  - 权利金值不值得冒尾部风险？
- 每个问题都必须包含答案、具体数字、因果理由，不能共用一句摘要。
- 展示现价、Strike、Delta、DTE等关键合约数字。

### 5.2 市场环境与黑天鹅风险

- 行情指标条至少包括 QQQ、SPY、SMH、VIX、10Y、DXY、BTC。
- 详细要点至少4条，每条结构为 `判断项 + 具体数字 + 风险含义 + 对卖Put影响`。
- 新闻与事件只引用本次输入；无已验证事件时不得补写日历。

### 5.3 期权温度解读

- 展示 IV、HV、IV Rank、IV Percentile、Put/Call Vol、Put/Call OI、Expected Move。
- 必须解释指标组合，而不是逐项抄数。
- 明确区分“真正的恐慌溢价”和“实际风险已经兑现后的高波动定价”。
- 比较 Expected Range、严格安全行权价和用户选择的 Strike。

### 5.4 K线技术信号

- 展示趋势、技术风险、ATR及均线表。
- 明确显示典型K线匹配的名称、匹配度和方向。
- 至少5类解释：趋势、形态、支撑阻力、ATR安全垫、量价。
- K线原始计算明细可以折叠，但详细解释不能折叠消失。

### 5.5 综合卖Put建议

- 展示最终动作、到期日、Delta、Strike、Bid/Ask。
- 列出关键风险，并写明触发条件和可能后果。
- 给出“如果必须操作”的仓位与条件约束。
- 给出安全、边缘、危险三个行权价区间或等价的明确边界。
- 必须有特别提醒。

### 5.6 未来3-5个交易日关注清单

- 监控项必须可观察，例如价格点位、VIX阈值、均线或IV Rank变化。
- 分别列出好转信号和恶化信号。
- 如有已验证近期事件，写明来源内出现的日期；否则不猜测。

## 6. 颜色与语义

| 含义 | CSS |
|---|---|
| 有利、值得、低风险、上涨 | `dn` / `highlight-green` |
| 谨慎、不确定、中风险 | `warn` / `highlight-yellow` |
| 不利、不值得、高风险、下跌 | `up` / `highlight-red` |

只给最短结论词和涨跌数字着色，不允许整段正文全部变黄或变红。

## 7. 降级规则

- 单个AI模块失败：该模块使用规则版，其余模块正常保留。
- 三个模块全部失败：仍保留六节结构和已取得的客观数字，不得退化为一两段摘要。
- K线或关键数据不完整：输出预检查，不输出貌似确定的完整决策。
- 网络长连接不得承载AI执行；必须使用后台任务加 `status` 轮询。

## 8. 验收清单

- [ ] 页面可见版本号已升级，两个HTML镜像一致。
- [ ] 六节顺序完整，每节有本节结论和详细论证。
- [ ] 三个核心问题都有独立理由。
- [ ] 市场、期权、K线分别达到最低详细度。
- [ ] 具体合约硬门槛使用最终真实ATR重新计算。
- [ ] 缺失数据未显示为0，事件日期未被补造。
- [ ] 数据来源与时间可折叠查看。
- [ ] 新窗口、下载HTML、下载图片、图片分享、历史恢复仍可使用。
- [ ] 回归测试通过。

## 9. 历史内容基准

内容密度以 `docs/tools/sell-put-decision/examples/` 中的以下历史报告为参考：

- `INTC-sell-put-decision_20260730_184516.html`
- `IBIT-sell-put-decision_20260730_184259.html`

历史报告用于验收分析深度，不作为生产数据源，也不能覆盖当前规则引擎结论。
