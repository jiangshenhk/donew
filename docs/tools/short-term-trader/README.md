# Short-Term K-line Trader — 短线K线交易机器人

> CLI 脚本 · `scripts/short-term-trader.mjs`
> 数据存储 · `~/.donew-trader/`（独立，不 commit）

## 功能

基于5分钟K线 + DeepSeek AI 的短线交易机器人。纯技术面分析，自动生成交易信号，纸面模拟下单和成交，跟踪胜率和盈亏。

## 标的

| 标的 | 类型 |
|:---|:---|
| QQQ | 纳斯达克100 ETF |
| IBIT | 比特币 ETF |
| MSTR | MicroStrategy（高波动） |

## 策略

- **K线周期**：5分钟
- **方向**：仅做多（BUY / HOLD）
- **AI 引擎**：DeepSeek Chat（纯K线技术分析，不参考新闻/基本面）
- **入场**：AI 置信度 ≥ 60 时开仓
- **离场**：止盈止损自动触发，收盘不强制平仓（跨日持有）
- **仓位管理**：每笔 $10,000，同时最多 3 笔（各标的独立）

## 命令速查

```bash
export DEEPSEEK_API_KEY=sk-xxx
node scripts/short-term-trader.mjs run        # 拉取K线→AI分析→模拟交易
node scripts/short-term-trader.mjs dashboard  # 生成 HTML 仪表板
node scripts/short-term-trader.mjs stats      # 统计面板（终端）
node scripts/short-term-trader.mjs positions  # 显示当前持仓
node scripts/short-term-trader.mjs setup      # 安装 launchd 自动运行
node scripts/short-term-trader.mjs env        # 写入 API Key 到本地文件
node scripts/short-term-trader.mjs version    # 版本
```

## 数据流

```
Yahoo Finance 5分钟K线 → 技术指标计算（EMA/MACD/RSI/ATR/关键价位）
                                    ↓
                              DeepSeek API → 生成信号（BUY/HOLD）
                                    ↓
                              存储 ~/.donew-trader/
  ├── config.json        # 标的、资金、仓位大小
  ├── positions.json     # 持仓
  ├── orders.json        # 交易订单（开仓+平仓）
  ├── signals/           # 每标的 AI 信号历史
  ├── stats.json         # 统计数据（胜率/PnL/回撤）
  ├── kline/             # K线数据缓存
  └── dashboard.html     # 可视化仪表板
```

## 技术指标

每次分析计算：
- EMA(9) / EMA(21) / EMA(55)
- MACD(12,26,9)
- RSI(14)
- ATR(14)
- 量比（当前成交量 / 近期均值）
- 局部支撑位 / 阻力位

## 风险规则

| 规则 | 动作 |
|:---|:---|
| 美股非交易时段（周末/节假日/盘前盘后） | 跳过 |
| AI 置信度 < 60 | 跳过 |
| 已有同标的持仓 | 跳过 |
| 达到最大持仓数 | 跳过 |
| 仓位大小不足 1 股 | 跳过 |

## 离场规则

| 触发条件 | 动作 |
|:---|:---|
| 价格触及止盈价 | 止盈平仓 |
| 价格触止损价 | 止损平仓 |
| 开盘跳空直接穿透止损/止盈 | 以开盘价平仓 |

## 自动化部署

```bash
node scripts/short-term-trader.mjs setup    # 生成 launchd plist
launchctl load ~/Library/LaunchAgents/com.donew.shorttrader.plist  # 启用
```

每 5 分钟运行一次，脚本内部判断美股交易时段（周一至五 9:30 – 16:00 ET）。

## 仪表板

打开 `~/.donew-trader/dashboard.html`，五个标签页：
- **持仓**：当前仓位 + 入场价/止损/止盈
- **交易记录**：开仓/平仓记录 + PnL
- **信号记录**：AI 信号历史（按标的筛选）
- **统计**：胜率、PnL、回撤、按标的/按日期分布
- **K线图**：Canvas 蜡烛图 + 交易标记

## 版本

v0.1.0 · 2026-07-28

## 邮件通知（其他工具复用参考）

### 配置

在 `~/.donew-agent/.env`（或其他工具的 `.env`）写入：

```
GMAIL_USER=jiangshenhk@gmail.com
GMAIL_PASS=guxhyqnwlpzoeblp
EMAIL_TO=dudiaozhang@outlook.com
```

### 函数

```javascript
function readEnvVar(key) {
  if (process.env[key]) return process.env[key];
  try {
    const content = fs.readFileSync('/path/to/.env', 'utf-8');
    const match = content.match(new RegExp(key + '\\s*=\\s*(.+)'));
    return match ? match[1].trim().replace(/["']/g, '') : null;
  } catch { return null; }
}

function sendEmail(subject, htmlBody) {
  const user = readEnvVar('GMAIL_USER') || 'jiangshenhk@gmail.com';
  const pass = readEnvVar('GMAIL_PASS');
  const to = readEnvVar('EMAIL_TO') || 'dudiaozhang@outlook.com';
  if (!pass) return;

  const raw = [
    'From: "你的机器人" <' + user + '>',
    'To: ' + to,
    'Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody, 'utf-8').toString('base64'),
  ].join('\r\n');

  const tmpFile = '/tmp/email-' + Date.now() + '.txt';
  fs.writeFileSync(tmpFile, raw, 'utf-8');
  execSync(
    "curl -s --url 'smtps://smtp.gmail.com:465' --ssl-reqd --mail-from '" + user +
    "' --mail-rcpt '" + to + "' --user '" + user + ":" + pass +
    "' --upload-file '" + tmpFile + "'",
    { timeout: 15000 }
  );
  fs.unlinkSync(tmpFile);
}
```

### 调用

```javascript
sendEmail('[开仓] MSTR $96.30', '<h2>开仓详情...</h2>');
sendEmail('[平仓] MSTR $99.16 | PnL: +$295', '<h2>平仓详情...</h2>');
```

### 原理

- 使用系统 `curl` 命令 + Gmail SMTP over SSL（465 端口）
- 不需要安装任何 npm 包
- 邮件 MIME 格式：Base64 编码 HTML
- 应用专用密码在 https://myaccount.google.com/apppasswords 生成
