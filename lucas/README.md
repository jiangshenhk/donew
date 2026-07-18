# lucas 练手项目

本目录下的所有文件均为 lucas 个人练习项目，**严格隔离于正式项目之外**。

## 约定

- 所有修改、新增、测试**仅限此目录**
- 不得修改 `donew/` 根目录及其他子目录的任何文件
- 不得引入对正式项目有副作用的依赖或配置

## 项目

- `lucas_fly.html` — 航班实时跟踪面板（Leaflet + OpenSky API）
- `kline_robot_vercel/lucas/lucas_fly.html` — Vercel 线上部署版（与根目录版本保持一致）

## Vercel 部署说明

Vercel 实际部署的是 `kline_robot_vercel/` 目录，根目录文件不会被部署。
如需修改线上页面，同步更新：
1. `lucas/lucas_fly.html`（本地预览 / GitHub Pages）
2. `kline_robot_vercel/lucas/lucas_fly.html`（Vercel 线上）
