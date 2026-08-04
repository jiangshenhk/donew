# 日本股票 EOD 收盘价下载

收盘后批量下载东证全市场股票收盘价数据。

## 文件结构

```
jp-stocks/
├── README.md
├── config/
│   ├── tse-codes.txt              # 全市场股票代码（~3535只）
│   ├── tse-codes.json             # 代码+名称+市场+行业
│   └── tse-codes-test.txt         # 测试用10只代码
├── scripts/
│   ├── fetch_tse_codes.py         # 从Wikipedia抓取代码清单
│   └── download-jp-eod.mjs        # 收盘后批量下载EOD数据
├── data/
│   └── jp-eod-YYYYMMDD.csv        # 每日输出CSV
```

## 使用方式

### 1. 更新股票代码清单（代码新增时）

```bash
python3 scripts/fetch_tse_codes.py
```

### 2. 下载今日收盘数据

```bash
# 全量下载（默认读取 config/tse-codes.txt）
node scripts/download-jp-eod.mjs

# 指定代码文件
node scripts/download-jp-eod.mjs config/tse-codes-test.txt
```

### 3. 参数调优

编辑 `download-jp-eod.mjs` 中的常量：

| 参数 | 默认值 | 说明 |
|:---|:---|:---|
| CONCURRENCY | 8 | 并发请求数 |
| BATCH_DELAY | 800ms | 每批次间隔 |
| REQUEST_TIMEOUT | 15000ms | 单请求超时 |

## 数据源

- **代码清单**：Wikipedia 东证市场上市企业一覧（Prime / Standard / Growth）
- **行情数据**：Yahoo Finance v8 chart API（`{code}.T`）

## 输出 CSV 字段

| 字段 | 说明 |
|:---|:---|
| code | 4位股票代码 |
| name | 股票名称（日文/英文） |
| date | 日期（JST） |
| open | 开盘价（JPY） |
| high | 最高价（JPY） |
| low | 最低价（JPY） |
| close | **收盘价（JPY）** |
| volume | 成交量 |
| change_pct | 涨跌幅（%） |
| error | 错误信息（成功时为空） |

## 执行时机

日本市场收盘后（JST 15:00+）手动或定时执行。
