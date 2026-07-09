# 十方斋 AI 工具接口说明

当前版本：v2.1.0.5

本文用于说明十方斋网站的两个 AI 工具接口，方便后续接入 ChatGPT Actions、其他 Agent、自动化工作流或 MCP Server。

> 说明：当前文件是接口契约草案。如果后端 API 尚未实际部署，AI 可以先读取本文件理解工具用途；等 API 实现后，再按 `openapi.json` 直接调用。

## 工具一：AI看市场

接口：

```http
POST https://donew-beta.vercel.app/api/market/analyze
```

用途：

用于分析市场大环境，包括利率、黄金、BTC、纳指、VIX、风险偏好和 Sell Put 环境。

适合的问题：

- 今天适不适合卖 Put？
- 美股当前风险偏好如何？
- BTC、黄金、纳指、VIX 是否支持继续做风险资产？
- 当前市场应该积极、观望还是防守？

请求示例：

```json
{
  "market": "US",
  "mode": "daily",
  "focus": ["SPY", "QQQ", "BTC", "GLD", "TLT", "VIX"],
  "language": "zh-CN"
}
```

返回示例：

```json
{
  "summary": "当前市场风险偏好中性偏强，但波动率偏低，适合观察低 Delta Sell Put。",
  "risk_level": "medium",
  "sell_put_environment": "watch",
  "key_factors": [
    "纳指维持强势区间",
    "VIX 低位但需防止波动率回升",
    "BTC 未跌破关键支撑"
  ],
  "watchlist": ["QLD", "MSTR", "NVDA", "TSLA"]
}
```

## 工具二：AI看K线

接口：

```http
POST https://donew-beta.vercel.app/api/kline/analyze
```

用途：

用于分析单个标的的 K 线结构，包括趋势、动量、K线相似度、ABC 结构、关键确认位和失败位。

适合的问题：

- MSTR 小时线是不是进入反弹中继？
- QQQ 日线是否适合卖 Put？
- BTC 60分钟线有没有破坏结构？
- 某个股票当前是 A-B-C 回调末端，还是下跌中继？

请求示例：

```json
{
  "symbol": "MSTR",
  "interval": "1h",
  "mode": "similarity",
  "lookback": 120,
  "language": "zh-CN"
}
```

返回示例：

```json
{
  "symbol": "MSTR",
  "interval": "1h",
  "conclusion": "短线处于反弹后的震荡确认区。",
  "similarity_score": 78,
  "top_patterns": [
    {
      "name": "反弹中继",
      "score": 82,
      "description": "走势与历史反弹中继结构较接近。"
    },
    {
      "name": "ABC回调末端",
      "score": 74,
      "description": "存在回调末端迹象，但仍需突破确认位。"
    }
  ],
  "confirm_level": 112,
  "fail_level": 104,
  "sell_put_comment": "若未跌破失败位，可观察低 Delta Put。"
}
```

## OpenAPI 文件

机器可读接口说明：

```text
https://jiangshenhk.github.io/donew/openapi.json
```

后续可以把该文件用于：

- ChatGPT 自定义 GPT Actions
- 其他支持 OpenAPI 的 Agent 工具
- 内部自动化系统
- 未来 MCP Server 的接口定义来源

## 建议的 AI 调用顺序

做 Sell Put 或个股判断时，建议 AI 按以下顺序调用：

1. 先调用 `market_analyze` 判断大盘环境；
2. 如果市场环境不是 `avoid`，再调用 `kline_analyze` 分析具体标的；
3. 最后结合用户仓位、期权 Delta、DTE、IV/HV 和技术失败位，生成交易建议或观察结论。

## 风险说明

所有接口输出都只用于投资研究、学习和复盘，不构成投资建议。期权交易和杠杆 ETF 有较高风险，实际操作需要结合用户自己的资金规模、风险承受能力和交易纪律。
