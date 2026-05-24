# 方法一：ETF定投

> 定投不是机械买入，而是一套完整的复利系统。

这个栏目整理 ETF 定投的核心方法：为什么定投、定投什么、如何面对回撤，以及在理解风险之后能不能研究杠杆ETF。

---

## 置顶精选

- [ETF定投大法](/docs/复利/ETF定投方法.md)
- [如何选择ETF标的](/docs/复利/how-to-choose-etf-for-dca.md)
- [如何看待指数回撤](/docs/复利/how-to-handle-etf-drawdown.md)

---

## 小红书动态图谱

小红书主要用动态图和对比图，把长期定投结果直观展示出来。

这个系列不是单纯看最后收益，而是一起观察：

```text
定投时间
总投入
最终收益
复合年化
中途波动
普通人能不能坚持
```

<style>
.xhs-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin: 20px 0 28px;
}
.xhs-card {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.xhs-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
}
.xhs-card a {
  color: inherit;
  text-decoration: none;
}
.xhs-card img {
  display: block;
  width: 100%;
  height: 190px;
  object-fit: cover;
  background: #111827;
}
.xhs-card-body {
  padding: 12px 14px 14px;
}
.xhs-card-title {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.45;
  margin-bottom: 6px;
  color: #111827;
}
.xhs-card-desc {
  font-size: 13px;
  line-height: 1.55;
  color: #4b5563;
}
.xhs-note {
  background: #f8fafc;
  border-left: 4px solid #2563eb;
  padding: 12px 14px;
  border-radius: 10px;
  margin: 18px 0 28px;
  color: #334155;
  font-size: 14px;
}
@media (max-width: 900px) {
  .xhs-grid { grid-template-columns: 1fr; }
  .xhs-card img { height: auto; }
}
</style>

<div class="xhs-grid">
  <div class="xhs-card">
    <a href="https://www.xiaohongshu.com/discovery/item/68202ad20000000023001f40" target="_blank">
      <img src="/docs/assets/xhs/dca-global-index-gold.png" alt="定投20年：标普、沪深300、纳指、黄金对比">
      <div class="xhs-card-body">
        <div class="xhs-card-title">定投20年：标普、沪深300、纳指、黄金</div>
        <div class="xhs-card-desc">用动态图对比不同大类资产长期定投结果，适合作为整个ETF定投系列的起点。</div>
      </div>
    </a>
  </div>

  <div class="xhs-card">
    <a href="https://www.xiaohongshu.com/discovery/item/68161bae000000002301f1a8" target="_blank">
      <img src="/docs/assets/xhs/dca-sp500-35y.png" alt="标普500定投35年：收益归零后再到538%">
      <div class="xhs-card-body">
        <div class="xhs-card-title">标普500定投35年：收益归零后再到538%</div>
        <div class="xhs-card-desc">说明普通宽基指数的长期韧性：中间会大跌，但长期坚持后复利仍可能发挥作用。</div>
      </div>
    </a>
  </div>

  <div class="xhs-card">
    <a href="https://www.xiaohongshu.com/discovery/item/6822d9240000000022037941" target="_blank">
      <img src="/docs/assets/xhs/dca-nasdaq-qld.png" alt="纳指 vs QLD：定投杠杆基金是否更有效率">
      <div class="xhs-card-body">
        <div class="xhs-card-title">纳指 vs QLD：2倍杠杆是否更有效率？</div>
        <div class="xhs-card-desc">对比普通纳指和2倍纳指杠杆ETF，结果很强，但过程更反人性。</div>
      </div>
    </a>
  </div>

  <div class="xhs-card">
    <a href="https://www.xiaohongshu.com/discovery/item/6831e164000000002300e5e1" target="_blank">
      <img src="/docs/assets/xhs/dca-tqqq-soxl-15y.png" alt="TQQQ vs SOXL：都是3倍杠杆，定投15年谁更强">
      <div class="xhs-card-body">
        <div class="xhs-card-title">TQQQ vs SOXL：3倍杠杆谁更强？</div>
        <div class="xhs-card-desc">比较两个3倍杠杆ETF，重点看收益弹性，也要看底层行业和回撤压力。</div>
      </div>
    </a>
  </div>

  <div class="xhs-card">
    <a href="https://www.xiaohongshu.com/discovery/item/6828541d0000000023013321" target="_blank">
      <img src="/docs/assets/xhs/dca-soxl-25y.png" alt="SOXL半导体三倍杠杆ETF定投25年">
      <div class="xhs-card-body">
        <div class="xhs-card-title">SOXL：半导体3倍杠杆定投25年</div>
        <div class="xhs-card-desc">网友点播型案例，展示半导体高弹性资产的收益想象力与极端波动压力。</div>
      </div>
    </a>
  </div>

  <div class="xhs-card">
    <a href="https://www.xiaohongshu.com/discovery/item/6832f0630000000023000e5d" target="_blank">
      <img src="/docs/assets/xhs/dca-goal-table.png" alt="定投人必看表格：你的目标真的对吗">
      <div class="xhs-card-body">
        <div class="xhs-card-title">定投目标表格：你的目标真的对吗？</div>
        <div class="xhs-card-desc">不是单纯比收益，而是反推每月投入、定投年限和目标收益是否现实。</div>
      </div>
    </a>
  </div>

  <div class="xhs-card">
    <a href="https://www.xiaohongshu.com/discovery/item/67f27a80000000001c02d433" target="_blank">
      <img src="/docs/assets/xhs/vix-above-45.png" alt="恐慌指数VIX超过45后，历史数据分析结果惊人">
      <div class="xhs-card-body">
        <div class="xhs-card-title">VIX超过45后：恐慌之后发生什么？</div>
        <div class="xhs-card-desc">市场情绪研究案例，可作为理解大跌、恐慌和回撤修复的辅助材料。</div>
      </div>
    </a>
  </div>
</div>

<div class="xhs-note">
  图片统一放到 <code>docs/assets/xhs/</code> 目录。点击每张图片，会跳转到对应小红书播放页。
</div>

---

## 图片文件命名表

| 顺序 | 内容 | 图片文件名 |
|---:|---|---|
| 1 | 标普、沪深300、纳指、黄金定投20年 | `dca-global-index-gold.png` |
| 2 | 标普500定投35年 | `dca-sp500-35y.png` |
| 3 | 纳指 vs QLD，2倍杠杆对比 | `dca-nasdaq-qld.png` |
| 4 | TQQQ vs SOXL，3倍杠杆对比 | `dca-tqqq-soxl-15y.png` |
| 5 | SOXL 半导体3倍杠杆25年 | `dca-soxl-25y.png` |
| 6 | 定投目标表格 | `dca-goal-table.png` |
| 7 | VIX 恐慌指数超过45 | `vix-above-45.png` |

---

## 进阶阅读

- [定投也能用杠杆](/docs/ETF图谱/ETF长期收益图谱.md)
- [杠杆ETF系列目录](/docs/ETF图谱/B站ETF视频清单.md)
- [普通/2倍/3倍ETF怎么分仓](/docs/ETF图谱/普通ETF-2倍ETF-3倍ETF怎么分仓.md)
- [康波周期、纳斯达克回撤与长期定投机会](/docs/复利/kondratieff-nasdaq-drawdown.md)

---

## 推荐阅读顺序

```text
ETF定投大法
→ 如何选择ETF标的
→ 如何看待指数回撤
→ 小红书动态图谱
→ 定投也能用杠杆
→ 普通/2倍/3倍ETF怎么分仓
```

---

## 这个栏目解决什么问题？

```text
为什么要定投？
到底应该定投什么？
指数下跌时应该怎么办？
什么时候可以考虑杠杆ETF？
普通ETF、2倍ETF、3倍ETF如何分层？
```

本文仅用于投资研究与学习，不构成任何投资建议。