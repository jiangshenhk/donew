# Stock Price Center

统一行情数据中心。

## Purpose

为 donew 投资系统提供统一行情服务，避免每个功能模块重复抓取行情。

主要服务模块：

- K线机器人
- 每日日报
- 每日晚报
- 卖Put扫描
- 市场温度分析
- 动量与 ABC 结构分析
- 后续 AI 投资分析模块

---

# Architecture

整体设计：

```
                 Data Sources
                      |
        -------------------------------
        |                             |
 Yahoo Finance                 Future Data Source
        |                             |
        --------------------------------
                      |
                      v
              stockprice Center
                      |
        --------------------------------
        |              |              |
     K线机器人      日报系统       Sell Put扫描
```

stockprice 作为独立行情层，负责：

- 获取行情
- 缓存行情
- 管理刷新频率
- 提供统一接口
- 记录行情时间

业务模块只读取行情，不直接访问数据源。

---

# Directory Structure

```
stockprice/
│
├── README.md                  # 行情中心说明
│
├── config/                    # 配置文件
│   ├── symbols.json           # 股票/ETF/指数/商品列表
│   └── price-config.json      # 自动刷新开关、刷新周期
│
├── scripts/                  # 行情后台程序
│   └── update-price.js        # 获取并更新行情缓存
│
├── data/                     # 行情数据缓存
│   └── latest-price.json      # 最新行情数据
│
└── docs/                     # 技术设计文档
    └── architecture.md
```

---

# Data Flow

```
GitHub Actions / Scheduled Task
              |
              v
stockprice/scripts/update-price.js
              |
              v
External Data Source
(Yahoo Finance etc.)
              |
              v
stockprice/data/latest-price.json
              |
              v
API Layer
              |
              v
Website / AI Analysis Tools
```

---

# Cache Design

行情数据保存两个重要时间：

## 1. Cache Update Time

表示：

> 系统最后一次从数据源更新缓存的时间。

用途：

- 判断缓存是否新鲜
- 判断后台任务是否正常运行

## 2. Market Data Time

表示：

> 该价格本身对应的市场时间。

例如：

- 美股 ETF：可能是当天收盘时间
- BTC：接近实时交易时间
- 黄金/原油：期货市场时间

两个时间必须分开显示，避免误认为缓存更新时间就是行情时间。

---

# Supported Assets

当前规划包括：

## US ETF / Index

- QQQ
- SPY
- IWM
- QLD
- TQQQ
- SMH
- SOXX
- MAGS

## China / Emerging Market

- EEM
- FXI
- KWEB

## Volatility

- ^VIX
- VIXY

## Bitcoin Related

- BTC-USD
- IBIT
- MSTR

## Macro

- DX-Y.NYB
- ^TNX
- JPY=X
- CL=F
- GC=F

## Stocks

- INTC
- HOOD

---

# Control Design

行情中心支持：

```
Start
  |
  v
Enable scheduled update

Stop
  |
  v
Disable scheduled update
```

控制配置：

```
stockprice/config/price-config.json
```

示例：

```json
{
  "enabled": true,
  "intervalMinutes": 5
}
```

---

# Principles

- 不让每个功能重复抓行情
- 统一缓存
- 控制访问频率
- 降低 Yahoo 等数据源压力
- 区分缓存更新时间和行情时间
- 支持未来替换数据源
- 为 AI 投资系统提供统一数据基础
