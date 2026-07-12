# 行情中心控制设计

## 当前阶段

- price-test.html 用于测试行情缓存
- latest-price.js 提供行情读取
- 缓存周期 3 分钟

## 后续自动刷新

GitHub Actions 每5分钟运行一次：

```
GitHub Actions
      |
      v
行情更新程序
      |
      v
latest-price-cache.json
      |
      v
网页读取
```

## 控制状态

未来增加：

- 启动自动刷新
- 停止自动刷新
- 立即刷新
- 查看最后更新时间
- 查看下一次更新时间
