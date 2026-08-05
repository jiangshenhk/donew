# K线形态机器人 Cloudflare Worker（历史兼容）

> 当前生产站点和 API 已统一迁移到 `https://sellput.top` 与 `vps-backend/`。本目录不属于生产调用链，仅保留为历史兼容和故障排查参考。

这个目录是 `kline-robot.html` 的后端代理。它负责：

- 拉取 Yahoo Finance 最新 K 线；
- 计算 Top 5 K线形态概要；
- 调用 OpenAI Responses API 生成 GPT 综合解读；
- 返回完整 HTML 报告给旧静态前端。

## 历史上为什么需要 Worker

旧静态部署不能安全保存 `OPENAI_API_KEY`，因此曾将 API Key 放在 Worker Secret 中。当前生产 Key 统一配置在 VPS 环境变量中。

## 历史部署步骤

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
ALLOWED_ORIGIN = "https://sellput.top"
```

## 历史前端配置

打开：

```text
https://sellput.top/kline-robot.html
```

旧部署可把页面里的“后端 API 地址”改成 Worker 地址。当前生产页面不得这样配置，必须使用 sellput.top 同源 API。

```text
https://kline-robot.your-name.workers.dev
```

页面会保存这个地址到浏览器 localStorage。
