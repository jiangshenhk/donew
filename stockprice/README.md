# 最新行情中心（Stock Price Center）

这个目录是 donew 的统一行情缓存中心。

它的定位不是“某一个前台工具自己的内部模块”，而是所有市场分析工具共享的行情底座。

---

## 1. 入口与相关页面

- 调试 / 管理页：`https://donew-beta.vercel.app/price-test.html`
- 原始缓存文件：`stockprice/data/latest-price.json`
- Vercel 读取 API：`kline_robot_vercel/api/latest-price.js`

---

## 2. 这个目录解决什么问题

统一解决以下问题：

- 避免每个工具单独抓 Yahoo / 交易所 / 备用源；
- 避免多个工具同一时刻读出不同价格；
- 避免前端工具因为限流、超时反复失败；
- 给所有下游工具统一提供：
  - 最新价格
  - 昨收
  - 涨跌幅
  - 行情时间
  - 缓存检查时间

下游典型使用方：

- `kline_robot_vercel/api/market-report-v2.js`
- `kline_robot_vercel/api/put-rating.js`
- `scripts/generate-market-daily-report.mjs`
- `kline_robot_vercel/price-test.html`

---

## 3. 目录结构

```text
stockprice/
├── README.md
├── config/
│   ├── symbols.json
│   └── price-config.json
├── scripts/
│   └── update-price.js
├── data/
│   └── latest-price.json
└── docs/
    ├── architecture.md
    └── workflow.md
```

### 关键文件

- `config/symbols.json`
  - 定义需要维护的标的清单，目前是 23 个左右核心资产
- `config/price-config.json`
  - 行情服务开关、刷新周期配置
- `scripts/update-price.js`
  - 抓取并生成统一缓存的主脚本
- `data/latest-price.json`
  - 下游工具真正消费的缓存文件

---

## 4. 处理流程

```text
GitHub Actions 定时触发
  -> node stockprice/scripts/update-price.js
  -> 依次读取 symbols.json 中的标的
  -> 从外部行情源抓取数据
  -> 标准化字段
  -> 写入 latest-price.json
  -> commit 回 main
  -> Vercel / GitHub / 页面读取缓存
```

当前核心设计思路：

- 尽量把抓取成本放到后台；
- 页面和分析工具尽量只读缓存；
- 行情时间与缓存时间分开保存。

---

## 5. 自动更新

工作流文件：

- `.github/workflows/update-stockprice.yml`

特点：

- 定时任务约每 5 分钟运行一次；
- 支持手工触发；
- 先 `fetch/reset` 到最新 `origin/main`；
- 生成缓存后 commit；
- push 失败会自动重新同步并重试。

这条工作流是目前最需要“少改动、稳运行”的基础设施之一。

---

## 6. 输出数据约定

`latest-price.json` 建议保持下面这类结构稳定：

```json
{
  "updatedAt": "...",
  "checkedAt": "...",
  "successCount": 0,
  "failCount": 0,
  "data": [
    {
      "symbol": "QQQ",
      "category": "US ETF",
      "price": 0,
      "previousClose": 0,
      "changePercent": 0,
      "marketTime": "...",
      "retrievedAt": "...",
      "exchange": "NasdaqGM",
      "currency": "USD",
      "error": ""
    }
  ]
}
```

### 两个时间不要混

#### `marketTime`

表示这条价格本身对应的行情时间。

#### `checkedAt` / `updatedAt`

表示后台脚本什么时候检查 / 刷新了缓存。

很多分析错误都来自把这两个时间混为一谈。

---

## 7. 外部对接

上游行情源的实现细节在 `stockprice/scripts/update-price.js`，后续允许调整，但原则不变：

- 优先保证结构稳定；
- 尽量直接取到：
  - 最新价
  - 昨收
  - 日涨跌幅
- 如果源头缺少关键字段，要在缓存里明确标记，而不是静默写 0。

下游工具目前默认把这个缓存当作“统一行情真源”。

---

## 8. 修改时先看哪里

### A. 某个价格明显不对

先看：

- `stockprice/data/latest-price.json`
- `stockprice/scripts/update-price.js`
- Actions 日志：`update-stockprice.yml`

### B. 页面读不到行情

先看：

- `kline_robot_vercel/api/latest-price.js`
- `kline_robot_vercel/price-test.html`

### C. 市场分析或卖 Put 工具里价格怪异

先确认：

1. `latest-price.json` 里是否已经错了；
2. 如果缓存是对的，再看：
   - `kline_robot_vercel/api/market-report-v2.js`
   - `kline_robot_vercel/api/put-rating.js`

---

## 9. 常见坑

### 坑 1：不要前台重新自己算昨收

前台和业务 API 最好直接吃缓存里的：

- `price`
- `previousClose`
- `changePercent`

不要每个工具各自再用不同方式反推。

### 坑 2：不要失败时写成 0

如果取不到：

- 就明确写缺失 / 错误；
- 不要把“未取到”伪装成 `0.00%`。

### 坑 3：不要让每个新工具直接抓外部行情

原则上：

- 新工具优先读 `stockprice/data/latest-price.json`
- 只有像 K 线相识度这种“单标的即时拉取”场景，才单独抓外部行情

---

## 10. 给后续智能体的扩展模板

如果后续再新增一个共享数据中心，建议也按这个模式：

```text
newcenter/
├── README.md
├── config/
├── scripts/
├── data/
└── docs/
```

并且遵守这几个规则：

1. 先落缓存，再让页面消费；
2. 输出 JSON 结构尽量稳定；
3. 失败保留旧缓存，不轻易清空；
4. 工作流和缓存目录分开；
5. README 必须写清楚上下游依赖。
