# lucas 练手项目

本目录下的所有文件均为 lucas 个人练习项目，**严格隔离于正式项目之外**。

## 约定

- 所有修改、新增、测试**仅限此目录**，不得修改正式项目任何文件
- 同一个页面需同步维护两个位置：
  1. `lucas/xxx.html`（本地预览 / GitHub Pages）
  2. `kline_robot_vercel/lucas/xxx.html`（Vercel 线上）
- 不得引用正式项目的 API、样式、工具库（除非显式注明）

## 项目

| 项目 | 线上入口 | 说明 |
| --- | --- | --- |
| 航班实时跟踪 | `https://donew-beta.vercel.app/lucas/lucas_fly.html` | Leaflet 地图 + 模拟航班数据（本地面生成，无需 API） |
| 墨尔本活动地图 | `https://donew-beta.vercel.app/lucas/melbourne-events.html` | 调 DeepSeek 搜索墨尔本近期活动，标注在地图上 |
