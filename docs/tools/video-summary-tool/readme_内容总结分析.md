# 内容总结分析工具

## 工具定位

输入视频链接或文章链接/文字，AI 自动生成内容总结与分析，支持语音朗读。

## 支持模式

### 视频总结
- **YouTube**：自动提取视频字幕
- **B站（Bilibili）**：自动提取视频字幕

### 文章总结
- **网页链接**：自动抓取并提取文章正文
- **手动粘贴**：直接粘贴任意文字内容
- 支持：微信公众号、博客、新闻网站等

### 语音朗读
- 基于浏览器 SpeechSynthesis API
- 支持播放/暂停/停止
- 可调节语速（0.75x - 1.5x）

## 入口

- 线上页面：`https://sellput.top/video-summary-tool.html`
- 根目录页面：`video-summary-tool.html`
- 生产 API：`vps-backend/src/api/news-summary.js`（`mode=video` / `mode=article`）

## 处理流程

```
用户选择模式（视频 / 文章）
  → 输入链接或粘贴文字
  → 前端发送 POST 到 /api/video-summary
  → 视频模式：识别平台 → 提取字幕
  → 文章模式：抓取网页 / 直接使用文字
  → 调用 DeepSeek / OpenAI 进行内容总结
  → 返回 HTML 报告 + 纯文本（供朗读）
  → 前端展示 + TTS 朗读
```

## 环境变量要求

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 与 OPENAI_API_KEY 二选一 |
| `DEEPSEEK_MODEL` | DeepSeek 模型名（默认 deepseek-v4-flash） | 可选 |
| `OPENAI_API_KEY` | OpenAI API Key | 与 DEEPSEEK_API_KEY 二选一 |
| `OPENAI_MODEL` | OpenAI 模型名（默认 gpt-5-mini） | 可选 |
| `ALLOWED_ORIGIN` | CORS 允许的域名 | 可选 |

## 当前功能

- 视频/文章模式切换
- 文章链接自动抓取 + 手动粘贴文字
- 标准报告展示（深色底，与 K线相识度工具风格一致）
- 新窗口打开、下载 HTML、复制链接
- 浏览器语音朗读（播放/暂停/停止/语速调节）
- 最近一次报告自动恢复（localStorage）
- 可见版本号

## 版本历史

- v0.2.0（2026-07-25）：新增文章总结模式 + 浏览器语音朗读
- v0.1.0（2026-07-25）：初始版本，支持 YouTube / B站视频总结
