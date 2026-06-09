# 香港新股 IPO 暗盘涨跌和强度预测框架

## 目标

预测港股新股在暗盘阶段的表现，重点不是给单一精确涨幅，而是输出三个可交易信号：

1. 暗盘涨跌方向：上涨 / 下跌 / 中性。
2. 暗盘强度分层：强、偏强、中性、偏弱、弱。
3. 风险提示：高波动、高破发、高挤兑、低流动性、消息驱动。

建议把目标变量拆成两个层次：

- `grey_return_pct`：暗盘收盘价相对发行价涨跌幅。
- `grey_strength_label`：按涨跌幅和成交质量分档，例如 `>=15%` 为强，`5%-15%` 为偏强，`-5%-5%` 为中性，`-15%--5%` 为偏弱，`<-15%` 为弱。

## 核心判断逻辑

暗盘本质上是上市前最后一段供需再定价，主要由四组力量决定：

1. 发行质量：公司基本面、行业热度、估值、盈利状态、稀缺性。
2. 认购热度：公开发售超购倍数、国际配售覆盖、孖展倍数、一手中签率、稳中一手手数。
3. 筹码结构：发行规模、基石比例、禁售安排、回拨比例、老股出售、每手入场费。
4. 市场环境：恒生指数、恒生科技指数、南向资金、同类新股近期表现、当日大市风险偏好。

## 数据表结构

### 1. IPO 基础表 `ipo_base`

每只新股一行：

| 字段 | 说明 |
| --- | --- |
| `code` | 股票代码 |
| `name` | 公司名称 |
| `listing_date` | 上市日期 |
| `grey_date` | 暗盘日期 |
| `industry` | 行业 |
| `ipo_price` | 发行价 |
| `price_range_low` / `price_range_high` | 招股价区间 |
| `price_position` | 定价位置，`(发行价-下限)/(上限-下限)` |
| `market_cap_ipo` | 发行后市值 |
| `fundraising_hkd` | 集资额 |
| `lot_size` | 每手股数 |
| `entry_fee_hkd` | 一手入场费 |
| `profit_status` | 盈利 / 亏损 / 生物科技未盈利 |
| `sponsor_main` | 主保荐人 |
| `sponsor_count` | 保荐人数量 |
| `cornerstone_pct` | 基石占发行比例 |

### 2. 认购与分配表 `ipo_subscription`

| 字段 | 说明 |
| --- | --- |
| `public_oversub_x` | 公开发售超购倍数 |
| `intl_oversub_x` | 国际配售超购倍数，若披露 |
| `margin_amount_hkd` | 孖展认购金额 |
| `margin_oversub_x` | 孖展倍数 |
| `one_lot_success_rate` | 一手中签率 |
| `lots_for_one_lot` | 稳中一手所需手数 |
| `clawback_pct` | 回拨后公开发售比例 |
| `valid_applicants` | 有效申请人数 |
| `top_tier_allocation_pct` | 大户档位分配强弱，可从分配表抽取 |

### 3. 暗盘结果表 `ipo_grey_market`

| 字段 | 说明 |
| --- | --- |
| `grey_open` | 暗盘开盘价 |
| `grey_high` | 暗盘最高价 |
| `grey_low` | 暗盘最低价 |
| `grey_close` | 暗盘收盘价 |
| `grey_volume` | 暗盘成交量 |
| `grey_turnover_hkd` | 暗盘成交额 |
| `grey_return_pct` | 暗盘收盘相对发行价涨跌幅 |
| `grey_intraday_range_pct` | 暗盘振幅 |
| `provider` | 辉立、富途等来源 |

### 4. 市场环境表 `ipo_market_context`

| 字段 | 说明 |
| --- | --- |
| `hsi_5d_return` / `hsi_20d_return` | 上市前恒指表现 |
| `hstech_5d_return` / `hstech_20d_return` | 恒科表现 |
| `ipo_recent_avg_grey_return_10` | 最近 10 只新股暗盘平均涨跌 |
| `ipo_recent_win_rate_10` | 最近 10 只新股暗盘上涨比例 |
| `same_industry_recent_return` | 同行业近期新股表现 |
| `risk_sentiment` | 大市风险偏好分数 |

## 特征工程

### 热度特征

- `log_public_oversub = log1p(public_oversub_x)`
- `log_margin_oversub = log1p(margin_oversub_x)`
- `lottery_tightness = 1 / one_lot_success_rate`
- `scarcity_score = log_public_oversub + log_margin_oversub + log1p(lots_for_one_lot)`
- `retail_frenzy_flag = public_oversub_x > 100 and margin_oversub_x > 50`

### 定价与筹码特征

- `price_position` 越接近 1，代表越贴近上限定价。
- `cornerstone_lockup_score = cornerstone_pct * lockup_months`
- `small_float_flag = free_float_market_cap < threshold`
- `high_entry_fee_flag = entry_fee_hkd > historical_percentile_75`
- `large_deal_penalty = fundraising_hkd` 的分位数，超大盘新股通常弹性下降。

### 保荐与渠道特征

保荐人不能简单按名气打分，建议用历史滚动表现：

- `sponsor_grey_avg_12m`：该保荐人过去 12 个月项目暗盘平均涨幅。
- `sponsor_win_rate_12m`：该保荐人过去 12 个月暗盘上涨比例。
- `sponsor_break_rate_12m`：该保荐人过去 12 个月暗盘破发比例。
- `sponsor_hot_deal_count_24m`：过去 24 个月强势项目数量。

### 市场情绪特征

- `recent_ipo_momentum = ipo_recent_avg_grey_return_10`
- `recent_ipo_breadth = ipo_recent_win_rate_10`
- `market_beta = 0.5 * hsi_5d_return + 0.5 * hstech_5d_return`
- `sector_heat_score`：同行业 A/H/美股可比公司近 20 日表现。

## 模型设计

### 第一阶段：方向分类

目标：预测暗盘是否上涨。

推荐模型：

- 样本少时：逻辑回归 + 单调分箱评分卡。
- 样本足够时：LightGBM / XGBoost 分类。
- 样本很少时：规则打分先行，机器学习只做校准。

输出：

```text
P(grey_return_pct > 0)
```

### 第二阶段：强度回归

目标：预测暗盘涨跌幅区间。

推荐模型：

- Ridge / Huber 回归：抗异常值。
- Quantile Regression：输出悲观、中性、乐观三个区间。
- Gradient Boosting Regressor：捕捉非线性。

输出：

```text
expected_grey_return_pct
p10_grey_return_pct
p50_grey_return_pct
p90_grey_return_pct
```

### 第三阶段：规则覆盖

港股 IPO 样本少、制度与行情阶段性变化强，建议在模型外加规则覆盖：

- 若公开发售极热但一手中签率极低，暗盘可能强，但散户实际可获配少，交易上更偏向暗盘追涨风险。
- 若孖展热但国际配售弱，警惕零售热、机构冷。
- 若定价在上限、估值明显高于可比公司，同时大市弱，降低强度评级。
- 若保荐人近期项目连续破发，降低一档。
- 若同日多只新股暗盘，资金可能分流，降低小票和非稀缺标的权重。

## 简化评分卡

在没有足够样本训练模型前，可先用评分卡：

| 模块 | 权重 | 正向指标 | 负向指标 |
| --- | ---: | --- | --- |
| 认购热度 | 30% | 超购高、孖展高、稳中一手高 | 热度平淡、孖展撤单 |
| 筹码稀缺 | 20% | 小流通、基石高、回拨后供给紧 | 集资额大、流通盘大 |
| 发行质量 | 20% | 行业热、盈利好、稀缺资产 | 亏损、估值贵、故事弱 |
| 保荐历史 | 10% | 近期项目胜率高 | 近期项目破发多 |
| 市场情绪 | 20% | 港股强、近期新股赚钱效应好 | 大市弱、近期新股连续破发 |

评分转评级：

| 总分 | 评级 | 预期 |
| ---: | --- | --- |
| 80-100 | 强 | 暗盘大概率明显上涨 |
| 65-79 | 偏强 | 上涨概率较高，但需看估值和成交 |
| 45-64 | 中性 | 胜率不突出，适合等待暗盘盘口确认 |
| 30-44 | 偏弱 | 破发风险较高 |
| 0-29 | 弱 | 除非估值极便宜，否则回避 |

## 回测方法

1. 样本按上市日期排序，不能随机切分，避免未来信息泄露。
2. 用滚动窗口训练，例如 2018-2023 训练，2024 测试；再滚动到 2025。
3. 指标不要只看准确率，还要看：
   - 上涨方向 AUC / F1。
   - 强弱分层命中率。
   - Top 20% 信号组合的平均暗盘收益。
   - 强信号但破发的最大回撤。
   - 分行业、分保荐人、分市场阶段的稳定性。
4. 所有特征必须以暗盘开始前可获得为准，暗盘成交数据只能作为标签或盘中策略，不可作为盘前预测特征。

## 数据来源建议

- 港交所披露易：招股书、发售价及配发结果公告，可抽取发行价、超购倍数、分配结果、基石、回拨等。
- AASTOCKS 新股频道：可查看新股暗盘、上市时间表、超购倍数、一手中签率、稳中一手等字段。
- 辉立、富途、耀才等券商：孖展认购、暗盘价格和成交。
- 行情源：恒指、恒生科技指数、同业可比公司股价。

注意：AASTOCKS 页面自身披露暗盘市场数据带有供应商版权和使用限制，适合人工研究或核验；若要产品化或系统化抓取，需要确认授权。

## 实盘使用输出模板

```text
股票：XXXX
发行价：X.XX 港元
预测方向：上涨 / 下跌 / 中性
暗盘强度：强 / 偏强 / 中性 / 偏弱 / 弱
模型预测涨跌幅：P10 / P50 / P90
核心驱动：
1. 公开发售超购：xx 倍，处于历史 xx 分位
2. 孖展倍数：xx 倍，处于历史 xx 分位
3. 保荐人近 12 个月胜率：xx%
4. 近期 10 只新股暗盘胜率：xx%
主要风险：
1. 定价接近上限，估值消化压力较大
2. 同日多只新股分流资金
3. 近期同赛道新股上市后回吐明显
结论：适合现金申购 / 谨慎融资 / 只看暗盘盘口 / 回避
```

## 最小可行版本

第一版不必追求复杂模型，建议先做：

1. 整理最近 200-300 只港股 IPO 样本。
2. 建立 `ipo_base`、`ipo_subscription`、`ipo_grey_market` 三张表。
3. 先跑评分卡和逻辑回归，验证方向胜率。
4. 再加入保荐人滚动表现和近期 IPO 情绪。
5. 最后做强度回归和分位数预测。

若样本质量够好，最有价值的不是单只股票的精确预测，而是识别“高赔率且未被过度融资拥挤”的新股。

## 外部理论与 GitHub 调研

### 公开研究的共识

网上和学术研究里，直接研究“香港暗盘涨跌预测”的资料很少；更成熟的是 IPO 首日回报、IPO underpricing、上市后短期收益预测。暗盘可以理解为上市首日前的提前价格发现，所以这些理论变量可以迁移，但需要加入香港本地市场特征。

常见理论框架：

1. 信息不对称：发行人、承销商、机构投资者和散户掌握的信息不同，IPO 定价通常会保留折价以提高发行成功率。
2. 投资者情绪：短期收益不只由基本面决定，也受市场风险偏好、新股赚钱效应、行业热度影响。
3. 承销商声誉：保荐人或承销商声誉会影响定价质量、机构覆盖和投资者信任。
4. 认购需求：公开发售超购倍数、机构覆盖倍数和中签率反映一级市场需求强弱。
5. 发行规模与流通筹码：小盘、低流通、基石锁定高的项目更容易出现短期弹性，但也更容易高波动。

### 对香港暗盘最可迁移的变量

研究 IPO 首日回报时常用的变量，在香港暗盘里可以这样映射：

| 传统 IPO 研究变量 | 香港暗盘映射 |
| --- | --- |
| Underwriter reputation | 保荐人历史暗盘胜率、破发率、强势项目数 |
| Offer size | 集资额、发行后市值、流通市值 |
| Offer price revision | 定价位置，是否贴近招股价上限 |
| Oversubscription | 公开发售超购倍数、国际配售覆盖倍数 |
| Retail demand | 孖展倍数、有效申请人数、一手中签率、稳中一手手数 |
| Market sentiment | 最近 10-20 只新股暗盘收益、恒指/恒科短期表现 |
| Firm quality | 盈利状态、收入增速、毛利率、行业估值、是否稀缺资产 |

### GitHub 上可借鉴的实现思路

GitHub 上能找到一些 IPO 首日收益预测、IPO underpricing、机器学习分类/回归的项目，但很少有完整可复用的港股暗盘数据集。多数项目的价值在于代码结构，而不是数据本身。

可借鉴的工程模式：

1. 用一张主表保存每只 IPO 的发行与认购特征。
2. 把文本字段如行业、承销商、交易所做 one-hot 或 target encoding。
3. 同时训练分类模型和回归模型：分类看是否上涨，回归看涨幅。
4. 用随机森林、梯度提升树、XGBoost/LightGBM 做非线性模型。
5. 用时间切分回测，而不是随机切分。
6. 用 SHAP 或 feature importance 解释模型，避免黑箱预测无法复盘。

需要谨慎的点：

- 很多开源项目用随机 train/test split，这对 IPO 时间序列问题会泄露未来信息。
- 有些项目把上市后价格、成交量、新闻热度等上市后才知道的信息放进特征，不能用于暗盘前预测。
- 美国 IPO 数据字段与香港不同，不能直接照搬；香港最重要的是公开发售、回拨、孖展、一手中签率、稳中一手和暗盘渠道数据。

### 建模建议

基于外部理论和开源实现，香港暗盘预测更适合做成“三层模型”：

1. **结构化评分卡**：先用可解释规则给每只新股打基础分，确保模型符合交易直觉。
2. **机器学习校准**：用 LightGBM / XGBoost / Random Forest 学习非线性关系，输出上涨概率和预期涨幅。
3. **分阶段回测**：按市场阶段评估，例如强 IPO 周期、弱 IPO 周期、港股牛市、港股熊市分别看模型是否失效。

不要一开始追求复杂深度学习。港股 IPO 样本量相对有限，变量质量和时间切分，比模型复杂度更重要。

### 参考方向

- IWH 研究：`Predicting IPO First-Day Returns: Evidence from Machine Learning Analyses`
- MDPI Applied Sciences 论文：`Predicting Initial Public Offering Initial Returns Using Random Forest`
- GitHub 搜索关键词：`IPO first day return prediction Python`、`IPO underpricing machine learning`、`IPO prediction random forest`
- 港股本地数据关键词：`香港新股 暗盘 超购 一手中签率 孖展`、`Hong Kong IPO allotment results subscription rate`
