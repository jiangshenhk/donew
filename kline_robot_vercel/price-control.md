# 行情中心控制设计

## 当前阶段

- price-test.html 用于测试行情缓存
- `https://sellput.top/api/stock/prices` 提供行情读取
- VPS 行情服务默认每 5 分钟刷新

## 后续自动刷新

VPS PM2 node-cron 每 5 分钟运行一次：

```
VPS PM2 node-cron
      |
      v
vps-backend/src/services/stockPrice.js
      |
      v
SQLite 行情缓存
      |
      v
网页读取
```

## 控制状态

控制接口可提供：

- 启动自动刷新
- 停止自动刷新
- 立即刷新
- 查看最后更新时间
- 查看下一次更新时间
