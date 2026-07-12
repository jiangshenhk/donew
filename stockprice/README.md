# Stock Price Center

统一行情数据中心。

## Purpose

为 donew 投资系统提供统一行情服务，供以下模块调用：

- K线机器人
- 每日日报
- 每日晚报
- 卖Put扫描
- 市场温度分析
- 动量与ABC结构分析

## Structure

```
stockprice/
├── README.md              # 说明文档
├── config/                # 标的列表、刷新配置
├── scripts/               # 行情更新程序
├── data/                  # 行情缓存数据
└── docs/                  # 设计文档
```

## Design

数据流程：

```
Yahoo Finance / Data Source
          |
          v
 stockprice scripts
          |
          v
 cached market data
          |
          +---- Kline Robot
          +---- Daily Report
          +---- Sell Put Scanner
```

## Principles

- 不让每个功能重复抓行情
- 统一缓存
- 控制访问频率
- 区分缓存更新时间和行情时间
- 支持未来替换数据源
