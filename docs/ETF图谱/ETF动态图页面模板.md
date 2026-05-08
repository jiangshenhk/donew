# 🧩 ETF动态图页面模板

> 用途：以后每新增一条 B站 ETF 长期收益动态图，就复制这个模板，替换标题、BV号、ETF名称和结论。

## 文件命名建议

建议放在：

```text
/docs/ETF图谱/专题名称.md
```

例如：

```text
/docs/ETF图谱/QQQ-QLD-TQQQ长期收益对比.md
/docs/ETF图谱/VOO-VTI-SPY长期收益对比.md
/docs/ETF图谱/KWEB-FXI-MCHI中国资产ETF对比.md
```

## 页面模板

```markdown
# 标题：XXX长期收益对比｜B站配套资料

> B站账号：老衲有座庙  
> 视频主题：XXX  
> 本页定位：整理视频中的长期收益动态图、ETF基础资料、回撤风险和当前点评。

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:14px;box-shadow:0 8px 22px rgba(15,23,42,0.12);margin:18px 0 24px;">
  <iframe src="//player.bilibili.com/player.html?bvid=这里替换BV号&page=1&high_quality=1&danmaku=0" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
</div>

## 一句话结论

这里写最重要的一句话。

例如：

> 长期看 QLD 的收益弹性明显高于 QQQ，但最大回撤也更深；TQQQ 虽然历史收益更夸张，但对持有纪律和心理承受力要求极高。

## 对比对象

| ETF | 跟踪对象 | 杠杆倍数 | 费用率 | 特点 |
|---|---|---:|---:|---|
| QQQ | 纳斯达克100 | 1x | 待补充 | 流动性强，期权活跃 |
| QLD | 纳斯达克100 | 2x | 待补充 | 弹性更高，回撤更大 |
| TQQQ | 纳斯达克100 | 3x | 待补充 | 高收益高回撤，高风险 |

## 长期收益观察

| 维度 | 胜出者 | 说明 |
|---|---|---|
| 最终累计收益 | 待补充 | 看长期复利弹性 |
| 最大回撤控制 | 待补充 | 看最差阶段能否承受 |
| 修复速度 | 待补充 | 看下跌后多久回本 |
| 定投体验 | 待补充 | 看是否适合普通投资者执行 |
| 期权适配度 | 待补充 | 看是否适合 Sell Put 或 Covered Call |

## 最大回撤与心理压力

这里不要只写收益，要重点写：

- 历史最大回撤大概有多深；
- 回撤发生在哪些市场环境；
- 持有者是否容易在底部卖出；
- 如果配合定投，是否需要降低金额；
- 如果配合 Sell Put，是否适合接货。

## 定投适配度

| ETF | 定投适配度 | 原因 |
|---|---|---|
| XXX | 高/中/低 | 待补充 |
| XXX | 高/中/低 | 待补充 |

## Sell Put适配度

| ETF | 是否适合Sell Put | 原因 |
|---|---|---|
| XXX | 适合/谨慎/不适合 | 待补充 |
| XXX | 适合/谨慎/不适合 | 待补充 |

## 老衲点评

从我的长期投资 + Sell Put 框架看，这个动态图的重点不是谁最后涨最多，而是谁更适合被纳入一个可执行、可长期复盘的体系。

当前结论：

1. 待补充；
2. 待补充；
3. 待补充。

## 风险提示

历史回测不代表未来收益。ETF、杠杆ETF和期权策略都可能出现本金亏损。杠杆ETF尤其需要关注路径依赖、波动损耗和极端回撤。
```

## BV号怎么替换？

B站视频链接通常长这样：

```text
https://www.bilibili.com/video/BVxxxxxxxxxx
```

把 `BVxxxxxxxxxx` 放入 iframe 里的 `bvid=` 后面即可。

例如：

```html
<iframe src="//player.bilibili.com/player.html?bvid=BV136MqzFEC2&page=1&high_quality=1&danmaku=0"></iframe>
```

## 页面完成后要做的事

1. 在 [B站ETF视频清单](/docs/ETF图谱/B站ETF视频清单.md) 里把状态改为 ✅ 已收录；
2. 在左侧目录 `_sidebar.md` 里增加专题链接；
3. 如果是重点页面，也可以在首页 `README.md` 增加入口；
4. 如果视频很重要，可以在 B站简介和置顶评论里反向放网站链接。
