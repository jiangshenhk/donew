# 卖Put标的池扫描 — 无 AI 调用

本工具不调用 AI。纯代码层规则排序：

1. **Fetch**：调用 Barchart API 批量获取各标的期权概览数据（IV、HV、IV Rank、Expected Move 等）
2. **排序**：按 IV-HV 差值、IV Rank、Expected Move 占比等维度加权排序
3. **标记**：高 IV + 极端 Expected Move + Put 成交量异常 → 标记为"高风险恐慌溢价"
4. **跳转**：点击候选后跳转到 `sell-put-decision-tool.html?symbol=XXX` 做完整 AI 决策

## 批量接口

- API: `kline_robot_vercel/api/barchart-overview.js`
- 最多接收 12 个去重美股代码
- 单个失败只进入错误列表，不把缺失值写成 0
