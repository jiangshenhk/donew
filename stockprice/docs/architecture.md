# Stock Price 行情中心架构

## 目标

为 donew 投资系统提供统一行情数据层。

## 数据流

```
Yahoo Finance / 数据源
        |
        v
stockprice/scripts/update-price.js
        |
        v
stockprice/data/latest-price.json
        |
        +---- K线机器人
        +---- 每日报告
        +---- 卖Put扫描
        +---- 市场温度
```

## 原则

- 行情抓取和分析模块分离
- 页面只读取缓存，不直接轰击数据源
- 所有投资工具共享同一行情中心
