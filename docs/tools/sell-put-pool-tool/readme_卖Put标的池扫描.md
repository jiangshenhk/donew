# AI卖Put标的池扫描

## 工具定位

这是卖 Put 流程的第一层候选筛选工具。

它批量读取 Barchart 的标的级 Options Overview，并按以下维度排序：

- IV 与 HV 的波动率溢价
- IV Rank
- IV Percentile
- Expected Move
- Put/Call Volume Ratio
- Put/Call OI Ratio
- 期权总成交量
- Open Interest

本工具只回答“哪些标的值得进入下一步研究”，不输出具体行权价、到期日、Delta 或下单建议。

## 入口

- 线上页面：`https://sellput.top/sell-put-pool-tool.html`
- 根目录镜像：`sell-put-pool-tool.html`
- VPS 页面镜像：`kline_robot_vercel/sell-put-pool-tool.html`
- 数据接口：`GET /api/barchart-overview?symbols=QLD,MSTR,INTC`

## 默认标的池

- 当前关注池：`QLD、MSTR、INTC`
- 核心标的池：`QLD、EEM、MSTR、INTC、IBIT、TQQQ、GDX、ARKK`
- 每次最多读取12个美股代码

当前关注池的理论来源是：

- `docs/SellPut/sell-put-focus.json`

完整分类来源是：

- `docs/SellPut/策略/02_标的池子/`

## 处理流程

```text
选择或输入标的池
  -> /api/barchart-overview 批量模式
  -> 服务端逐个读取 Barchart Options Overview
  -> 解析标的级期权指标
  -> 前端计算溢价机会分
  -> 区分风险溢价候选 / 高风险恐慌溢价 / 普通波动 / 数据不足
  -> 按分数排序
  -> 点击候选进入 sell-put-decision-tool.html?symbol=XXX
```

## 评分边界

- 高 IV 不自动等于适合卖 Put。
- IV 高于 HV、IV Rank/Percentile 较高且流动性合格，才构成风险溢价候选。
- Expected Move 极端或 Put 成交过度拥挤时，即使 IV 很高也会降级为高风险恐慌溢价。
- 机会分只是候选排序，不是成功概率、预期收益率或交易指令。
- 具体合约仍需进入综合卖Put决策工具，结合新闻、行情、K线、行权价、中间价和到期日判断。

## 数据约定

- Barchart 免费期权数据通常延迟约25至30分钟。
- 成功数据由服务实例缓存10分钟。
- 批量读取采用逐个请求，避免同时请求造成限流。
- 优先解析页面直接渲染的 Options Overview；若个别标的未在HTML中渲染完整字段，则使用同一Barchart页面会话的数据接口补齐。
- 页面数据接口仍未提供的字段保持缺失并降低评分，不自行推算。
- 单个标的失败只标记缺失，不补0，也不阻断其他标的。

## 页面标准功能

- 白色工具操作区 + 深色报告
- 新窗口打开
- 下载 HTML
- 下载 JPG
- 图片分享
- 浏览器自动恢复上次扫描报告，并显示原生成时间
- 可见版本号
- 返回十方斋首页
