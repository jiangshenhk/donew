import fs from "fs/promises";
import path from "path";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    const file = path.join(process.cwd(), "kline_robot_vercel", "data", "latest-price.json");
    const content = await fs.readFile(file, "utf8");
    const json = JSON.parse(content);

    return send(res, 200, json);
  } catch (error) {
    return send(res, 500, {
      error: error.message,
      message: "行情缓存不存在，请先运行 update-price"
    });
  }
}
