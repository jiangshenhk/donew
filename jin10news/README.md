# Jin10 News Center

定时获取金十搜索中“金十数据整理”的市场要闻，并维护最近 24 小时的滚动新闻缓存。

## 输出

- `data/latest-24h.json`：供程序、网页和 AI 使用的结构化数据
- `data/latest-24h.md`：便于 Docsify/GitHub 直接阅读的新闻汇总

## 自动更新

GitHub Actions 工作流 `.github/workflows/update-jin10-news.yml` 每 15 分钟运行一次，也支持手工触发。

程序会分页抓取，按新闻 ID（缺失时按时间和正文）去重，只保留最近 24 小时内容。接口失败或没有解析出有效新闻时会退出并保留旧缓存，不会用空数据覆盖上一版。

## 手工运行

```bash
node jin10news/scripts/update-jin10-news.js
```

配置文件：`jin10news/config/news-config.json`。

## 注意

金十接口可能调整响应结构、限流或临时返回 502。脚本已包含重试、限速、旧缓存合并和多种常见字段兼容；如连续失败，可在 Actions 日志中查看 HTTP 状态及响应摘要。
