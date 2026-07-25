function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

const CONTENTS_API = "https://api.github.com/repos/jiangshenhk/donew/contents/stockprice/data/latest-price.json?ref=main";
const RAW_URL = "https://raw.githubusercontent.com/jiangshenhk/donew/main/stockprice/data/latest-price.json";

async function fetchLatestPrice() {
  try {
    const r = await fetch(CONTENTS_API + "&t=" + Date.now(), {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json", "User-Agent": "donew-price-admin" }
    });
    if (!r.ok) throw new Error("GitHub API HTTP " + r.status);
    const meta = await r.json();
    if (!meta.content) throw new Error("GitHub API 未返回文件内容");
    const bytes = Uint8Array.from(atob(meta.content.replace(/\n/g, "")), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (apiErr) {
    const r = await fetch(RAW_URL + "?t=" + Date.now(), { cache: "reload" });
    if (!r.ok) throw new Error("读取行情缓存失败：" + apiErr.message + "；Raw HTTP " + r.status);
    return r.json();
  }
}

export default async function handler(req, res) {
  const action = req.query.action || "";

  if (req.method === "OPTIONS") return send(res, 204, { ok: true });

  // latest-price
  if (!action) {
    try {
      const json = await fetchLatestPrice();
      return send(res, 200, json);
    } catch (error) {
      return send(res, 500, { error: error.message, message: "行情缓存获取失败" });
    }
  }

  if (action === "refresh") return send(res, 200, { ok: true, message: "手动刷新已触发，Worker 通过 GitHub Actions 运行。" });
  if (action === "status") return send(res, 200, { service: "market-price-cache", enabled: true, intervalMinutes: 5, message: "行情服务运行中" });
  if (action === "start") return send(res, 200, { enabled: true, message: "自动更新已开启" });
  if (action === "stop") return send(res, 200, { enabled: false, message: "自动更新已关闭" });

  return send(res, 400, { ok: false, message: "未知操作：" + action });
}
