import fs from "fs/promises";
import path from "path";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const action = req.query.action || "";

  if (req.method === "OPTIONS") return send(res, 204, { ok: true });

  // latest-price
  if (!action) {
    try {
      const file = path.join(process.cwd(), "kline_robot_vercel", "data", "latest-price.json");
      const content = await fs.readFile(file, "utf8");
      return send(res, 200, JSON.parse(content));
    } catch (error) {
      return send(res, 500, { error: error.message, message: "行情缓存不存在，请先运行 update-price" });
    }
  }

  // refresh
  if (action === "refresh") {
    return send(res, 200, { ok: true, message: "手动刷新已触发，Worker 通过 GitHub Actions 运行。" });
  }

  // status
  if (action === "status") {
    return send(res, 200, { service: "market-price-cache", enabled: true, intervalMinutes: 5, message: "行情服务运行中" });
  }

  // start
  if (action === "start") {
    return send(res, 200, { enabled: true, message: "自动更新已开启" });
  }

  // stop
  if (action === "stop") {
    return send(res, 200, { enabled: false, message: "自动更新已关闭" });
  }

  return send(res, 400, { ok: false, message: "未知操作：" + action });
}
