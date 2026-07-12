// Stock Price Center Health Check
// Check cache freshness and data quality

import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const file = path.join(process.cwd(), "stockprice", "data", "latest-price.json");

    if (!fs.existsSync(file)) {
      return res.status(404).json({
        status: "error",
        message: "price cache not found"
      });
    }

    const cache = JSON.parse(fs.readFileSync(file, "utf8"));
    const updatedAt = cache.updatedAt || null;
    const ageMinutes = updatedAt
      ? Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000)
      : null;

    const data = cache.data || [];
    const errors = data.filter(x => x.error).length;

    res.status(200).json({
      status: errors > 0 ? "warning" : "healthy",
      updatedAt,
      ageMinutes,
      symbols: data.length,
      errors
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
}
