import fs from "fs";
import path from "path";

const root = process.cwd();

function usage() {
  console.log(`Usage:
  node scripts/create-tool-scaffold.mjs --slug alpha-risk-tool --title "AI Alpha Risk" --api alpha-risk

Optional:
  --description "One sentence tool summary"
  --force

Output:
  <slug>.html
  kline_robot_vercel/<slug>.html
  kline_robot_vercel/api/<api>.js
  docs/tools/<slug>/README.md
`);
}

function readArg(name, fallback = "") {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const slug = readArg("slug").trim();
const title = readArg("title").trim();
const apiName = readArg("api").trim();
const description = readArg("description", "请在这里补充工具用途说明。").trim();
const force = hasFlag("force");

if (!slug || !title || !apiName || hasFlag("help")) {
  usage();
  if (!slug || !title || !apiName) process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  throw new Error(`Invalid slug: ${slug}. Use lowercase letters, digits, and hyphen only.`);
}

if (!/^[a-z0-9-]+$/.test(apiName)) {
  throw new Error(`Invalid api name: ${apiName}. Use lowercase letters, digits, and hyphen only.`);
}

const versionText = "v0.1.0｜2026-07-18｜脚手架初始版本";
const pageFile = path.join(root, `${slug}.html`);
const vercelPageFile = path.join(root, "kline_robot_vercel", `${slug}.html`);
const apiFile = path.join(root, "kline_robot_vercel", "api", `${apiName}.js`);
const docsDir = path.join(root, "docs", "tools", slug);
const readmeFile = path.join(docsDir, "README.md");

const htmlTemplate = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --panel: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --line: #dbe4f0;
      --primary: #1d4ed8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
    }
    .shell {
      max-width: 1240px;
      margin: 0 auto;
      padding: 28px 20px 40px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .version {
      font-size: 12px;
      color: var(--muted);
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      padding: 3px 10px;
      font-weight: 600;
    }
    .layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 18px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
    }
    .field {
      display: grid;
      gap: 8px;
      margin-bottom: 14px;
    }
    label {
      font-size: 13px;
      color: var(--muted);
      font-weight: 600;
    }
    input, textarea, select {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 12px 14px;
      font: inherit;
      color: var(--text);
      background: #fff;
    }
    textarea { min-height: 110px; resize: vertical; }
    .primary-btn, .soft-btn, .tab {
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
      background: #eef2ff;
      color: var(--primary);
      font-weight: 700;
    }
    .primary-btn {
      width: 100%;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
    }
    .tabs, .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tab.active {
      background: #fff7db;
      color: #9a6700;
      border-color: #facc15;
    }
    .status {
      margin-top: 14px;
      font-size: 13px;
      color: var(--muted);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      display: grid;
      gap: 8px;
    }
    .metric b {
      color: var(--muted);
      font-size: 12px;
    }
    .metric span {
      font-size: 18px;
      font-weight: 700;
    }
    .preview-wrap {
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      min-height: 560px;
      background: #0f172a;
    }
    iframe {
      border: 0;
      width: 100%;
      min-height: 560px;
      background: #0f172a;
    }
    .empty-state {
      min-height: 560px;
      display: grid;
      place-items: center;
      color: #94a3b8;
      padding: 24px;
      text-align: center;
    }
    .home-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 700;
    }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
      .cards { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <h1>${title} <span class="version">${versionText}</span></h1>
      <a class="home-link" href="https://jiangshenhk.github.io/donew/#/">返回十方斋首页</a>
    </header>

    <div class="layout">
      <form class="panel" id="toolForm">
        <div class="field">
          <label for="symbol">标的代码</label>
          <input id="symbol" name="symbol" value="QQQ" placeholder="例如：QQQ / BTC-USD / MSTR">
        </div>
        <div class="field">
          <label for="note">补充说明</label>
          <textarea id="note" name="note" placeholder="可以写额外需求，也可以留空。"></textarea>
        </div>
        <button class="primary-btn" id="submitBtn" type="submit">生成报告</button>
        <div class="status" id="status">请填写参数后点击生成。</div>
      </form>

      <section class="panel">
        <div class="tabs">
          <button class="tab active" type="button">当前报告</button>
        </div>
        <div id="resultHead" class="cards" style="display:none;"></div>
        <div id="actions" class="actions" style="display:none;"></div>
        <div class="preview-wrap" id="previewWrap">
          <div id="preview" class="empty-state">等待生成报告</div>
        </div>
      </section>
    </div>
  </main>

  <script>
    const apiBase = (() => {
      const params = new URLSearchParams(location.search);
      const override = params.get("apiBase");
      const origin = String(location.origin || "").replace(/\\/$/, "");
      const fallback = "https://donew-beta.vercel.app";
      if (override) return override.replace(/\\/$/, "");
      if (!origin || origin === "null" || location.protocol === "file:") return fallback;
      return origin;
    })();

    const latestKey = "${slug}LatestReport.v1";
    const form = document.getElementById("toolForm");
    const statusEl = document.getElementById("status");
    const resultHead = document.getElementById("resultHead");
    const actions = document.getElementById("actions");
    const preview = document.getElementById("preview");

    let latestHtml = "";
    let latestName = "${slug}.html";
    let latestBlobUrl = "";

    function setStatus(text, isError = false) {
      statusEl.textContent = text;
      statusEl.style.color = isError ? "#dc2626" : "#64748b";
    }

    function updateLatestBlob(html, fileName) {
      latestHtml = html || "";
      latestName = fileName || "${slug}.html";
      if (latestBlobUrl) URL.revokeObjectURL(latestBlobUrl);
      latestBlobUrl = latestHtml
        ? URL.createObjectURL(new Blob([latestHtml], { type: "text/html;charset=utf-8" }))
        : "";
    }

    function formatTime(value) {
      if (!value) return "未知时间";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
    }

    function bindActions() {
      document.getElementById("openBtn")?.addEventListener("click", () => {
        if (!latestBlobUrl) return;
        window.open(latestBlobUrl, "_blank", "noopener");
      });
      document.getElementById("downloadBtn")?.addEventListener("click", () => {
        if (!latestBlobUrl) return;
        const a = document.createElement("a");
        a.href = latestBlobUrl;
        a.download = latestName;
        a.click();
      });
    }

    function renderLatestReport(meta, restored = false) {
      resultHead.style.display = "grid";
      resultHead.innerHTML = \`
        <div class="metric"><b>标的</b><span>\${meta.symbol || "-"}</span></div>
        <div class="metric"><b>AI</b><span>\${meta.provider || "Rules"}</span></div>
        <div class="metric"><b>状态</b><span>\${meta.status || "已生成"}</span></div>
        <div class="metric"><b>时间</b><span style="font-size:14px;">\${formatTime(meta.generatedAt)}</span></div>
      \`;
      actions.style.display = "flex";
      actions.innerHTML = \`
        <button class="soft-btn" id="openBtn" type="button">新窗口打开报告</button>
        <button class="soft-btn" id="downloadBtn" type="button">下载 HTML</button>
      \`;
      bindActions();
      preview.innerHTML = latestBlobUrl
        ? \`<iframe title="${title}" src="\${latestBlobUrl}"></iframe>\`
        : '<div class="empty-state">没有可展示的报告</div>';
      const extra = restored && meta.savedAt && meta.savedAt !== meta.generatedAt
        ? \`｜浏览器保存于 \${formatTime(meta.savedAt)}\`
        : "";
      setStatus(restored
        ? \`已恢复浏览器上次报告：原生成于 \${formatTime(meta.generatedAt || meta.savedAt)}\${extra}\`
        : (meta.message || "已生成报告。"));
    }

    function saveLatest(meta) {
      localStorage.setItem(latestKey, JSON.stringify({
        meta,
        html: latestHtml,
        fileName: latestName
      }));
    }

    function restoreLatest() {
      try {
        const saved = JSON.parse(localStorage.getItem(latestKey) || "null");
        if (!saved || !saved.html || !saved.meta) return;
        updateLatestBlob(saved.html, saved.fileName);
        renderLatestReport(saved.meta, true);
      } catch (error) {
        console.warn("restore latest report failed", error);
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        symbol: form.elements.symbol.value.trim(),
        note: form.elements.note.value.trim()
      };
      setStatus("正在生成报告...");
      try {
        const response = await fetch(\`\${apiBase}/api/${apiName}\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.message || \`HTTP \${response.status}\`);
        updateLatestBlob(json.html || "", json.filename || "${slug}.html");
        const meta = {
          symbol: payload.symbol,
          provider: json.provider || "DeepSeek",
          status: json.status || "已生成",
          message: json.message || "已生成报告。",
          generatedAt: json.generatedAt || new Date().toISOString(),
          savedAt: new Date().toISOString()
        };
        renderLatestReport(meta, false);
        saveLatest(meta);
      } catch (error) {
        preview.textContent = error.message || "生成失败";
        setStatus(error.message || "生成失败", true);
      }
    });

    restoreLatest();
  </script>
</body>
</html>
`;

const apiTemplate = `function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml({ title, symbol, note, generatedAt }) {
  return \`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>\${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px 56px; }
    h1 { margin: 0 0 12px; font-size: 38px; }
    .meta { color: #94a3b8; margin-bottom: 18px; }
    .card { background: #172554; border: 1px solid #334155; border-radius: 18px; padding: 18px 20px; }
    .key { color: #fde047; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>\${escapeHtml(title)}</h1>
    <div class="meta">生成时间：\${escapeHtml(generatedAt)}｜标的：\${escapeHtml(symbol)}</div>
    <section class="card">
      <p><span class="key">脚手架说明：</span> 这是一个示例 API，后续请在这里替换成真实的行情读取、新闻读取、AI 调用或规则引擎逻辑。</p>
      <p><span class="key">补充说明：</span> \${escapeHtml(note || "无")}</p>
      <p><span class="key">建议下一步：</span> 先补输入校验，再接统一缓存，再补下载图片、归档和历史记录。</p>
    </section>
  </main>
</body>
</html>\`;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, { ok: true });
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  try {
    const symbol = String(req.body?.symbol || "").trim().toUpperCase();
    const note = String(req.body?.note || "").trim();
    if (!symbol) return sendJson(res, 400, { ok: false, message: "Missing symbol" });

    const generatedAt = new Date().toISOString();
    const html = buildHtml({
      title: "${title}",
      symbol,
      note,
      generatedAt
    });

    return sendJson(res, 200, {
      ok: true,
      provider: "Scaffold",
      status: "已生成",
      message: "脚手架示例已生成。请把示例逻辑替换成真实业务逻辑。",
      generatedAt,
      filename: "${slug}.html",
      html,
      markdown: "# ${title}\\n\\n这是脚手架生成的示例报告。"
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: error.message || String(error)
    });
  }
}
`;

const readmeTemplate = `# ${title}

这个目录是由 \`scripts/create-tool-scaffold.mjs\` 自动生成的示例 README。

## 工具定位

${description}

## 计划入口

- 页面：\`${slug}.html\`
- Vercel 页面：\`kline_robot_vercel/${slug}.html\`
- API：\`kline_robot_vercel/api/${apiName}.js\`

## 当前脚手架已经包含

- 统一页面布局
- \`apiBase\` 参数兼容
- 最近一次报告自动恢复
- 新窗口打开 / 下载 HTML
- API 的最小返回结构

## 你接下来应该改哪里

### 如果要接真实行情

优先读取：

- \`stockprice/data/latest-price.json\`

### 如果要接真实新闻

优先读取：

- \`jin10news/data/latest-24h.json\`

### 如果要接 AI

优先在：

- \`kline_robot_vercel/api/${apiName}.js\`

里完成，不要把密钥放到前端页面。

## 建议扩展顺序

1. 补输入校验
2. 接统一缓存
3. 接 AI / 规则逻辑
4. 补下载图片
5. 补历史记录
6. 补 README 的真实处理流程
`;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  if (!force && fs.existsSync(file)) {
    throw new Error(`File exists: ${path.relative(root, file)}. Re-run with --force to overwrite.`);
  }
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

writeFile(pageFile, htmlTemplate);
writeFile(vercelPageFile, htmlTemplate);
writeFile(apiFile, apiTemplate);
writeFile(readmeFile, readmeTemplate);

console.log("Scaffold created:");
console.log(" - " + path.relative(root, pageFile));
console.log(" - " + path.relative(root, vercelPageFile));
console.log(" - " + path.relative(root, apiFile));
console.log(" - " + path.relative(root, readmeFile));
