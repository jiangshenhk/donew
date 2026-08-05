# Stockprice Workflow

## 自动更新流程

```
VPS PM2 node-cron
      |
      | every 5 minutes
      v
vps-backend/src/services/stockPrice.js
      |
      v
VPS SQLite 行情缓存
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
- 上游数据源可替换，但 `/api/stock/prices` 输出契约应保持稳定
