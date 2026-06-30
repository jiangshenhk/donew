# K线形态机器人 Cloudflare Worker

这个目录是 `kline-robot.html` 的后端代理。它负责：

- 拉取 Yahoo Finance 最新 K 线；
- 计算 Top 5 K线形态概要；
- 调用 OpenAI Responses API 生成 GPT 综合解读；
- 返回完整 HTML 报告给 GitHub Pages 前端。

## 为什么需要 Worker

GitHub Pages 是静态网站，不能安全保存 `OPENAI_API_KEY`。  
API Key 必须只放在 Worker Secret 里，不能写进前端 HTML/JS。

## 部署步骤

在本目录执行：

```bash
npx wrangler deploy
```

非交互环境需要先设置 Cloudflare API Token：

```bash
export CLOUDFLARE_API_TOKEN="你的 Cloudflare API Token"
npx wrangler deploy
```

部署完成后设置 OpenAI Key：

```bash
npx wrangler secret put OPENAI_API_KEY
```

可选设置模型：

```bash
npx wrangler secret put OPENAI_MODEL
```

也可以直接修改 `wrangler.toml` 里的公开变量：

```toml
[vars]
OPENAI_MODEL = "gpt-5"
ALLOWED_ORIGIN = "https://jiangshenhk.github.io"
```

## 前端配置

打开：

```text
https://jiangshenhk.github.io/donew/kline-robot.html
```

把页面里的“后端 API 地址”改成 Worker 部署后的地址，例如：

```text
https://kline-robot.your-name.workers.dev
```

页面会保存这个地址到浏览器 localStorage。
