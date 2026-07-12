// Stock Price Center Status API
// Return cache status for stockprice center

import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const file = path.join(process.cwd(), "stockprice", "data", "latest-price.json");

    if (!fs.existsSync(file)) {
      return res.status(200).json({
        status: "missing",
        message: "price cache not found"
      });
    }

    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const count = Array.isArray(data.data) ? data.data.length : 0;

    res.status(200).json({
      status: "ok",
      updatedAt: data.updatedAt || null,
      symbols: count,
      latest: data.data?.slice(0, 3) || []
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      error: err.message
    });
  }
}
