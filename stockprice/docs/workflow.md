# Stockprice Workflow

## 自动更新流程

```
GitHub Actions
      |
      | every 5 minutes
      v
stockprice/scripts/update-price.js
      |
      v
stockprice/data/latest-price.json
      |
      +--> Kline Robot
      +--> Daily Report
      +--> Sell Put Scanner
```

## 设计原则

- 行情抓取集中管理
- 页面只读取缓存
- 避免多个模块重复访问数据源
- 保留缓存更新时间和行情时间
- 后续可替换 Yahoo Finance 为其他数据源
