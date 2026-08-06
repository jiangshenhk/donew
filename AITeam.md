# AI Team 协作说明

版本：v1.0.0
用途：定义 ChatGPT 与 DeepSeek 在 donew 项目中的协作方式。

> 本文件与 DEV-README.md 同级，是 AI 协作规则文件。
> DEV-README.md 负责项目架构与开发规范。
> AITeam.md 负责两个 AI 的角色分工、交接流程和共享文件规范。

---

# 1. 协作目标

通过共享文件完成两个 AI 的连续协作：

```
用户需求
   ↓
ChatGPT（架构设计）
   ↓
桌面 AI/1.md
   ↓
DeepSeek（代码执行）
   ↓
桌面 AI/1.md
   ↓
ChatGPT（复核优化）
```

两个 AI 不直接互相调用，通过 `1.md` 交换设计、执行结果和反馈。

---

# 2. 共享文件

## 交换文件

位置：

```
桌面/AI/1.md
```

用途：

- 当前任务说明
- 设计方案
- 代码修改建议
- DeepSeek 执行反馈
- ChatGPT 审核意见

---

## 状态文件

位置：

```
桌面/AI/state.json
```

示例：

```json
{
  "status": "WAITING_DEEPSEEK",
  "owner": "ChatGPT",
  "task": "市场报告真实性优化"
}
```

状态定义：

| 状态 | 含义 |
|---|---|
| START | 新任务开始 |
| DESIGNING | ChatGPT设计中 |
| WAITING_DEEPSEEK | ChatGPT完成设计，等待DeepSeek |
| CODING | DeepSeek执行中 |
| REVIEW | 等待ChatGPT审核 |
| DONE | 完成 |

---

# 3. ChatGPT职责

ChatGPT定位：

## 架构师 / 产品负责人

负责：

1. 理解用户需求。
2. 阅读最新 DEV-README.md。
3. 判断修改属于哪个系统层。
4. 设计技术方案。
5. 明确修改文件范围。
6. 定义验收标准。

输出格式：

写入 `1.md`：

```
## ChatGPT设计方案

### 目标

### 当前问题

### 设计方案

### 修改文件

### 测试要求

### 给DeepSeek任务
```

完成后提醒用户：

> ChatGPT设计完成，可以通知DeepSeek继续。

---

# 4. DeepSeek职责

DeepSeek定位：

## 程序员 / 实施工程师

负责：

1. 阅读 AITeam.md。
2. 阅读 1.md 中 ChatGPT方案。
3. 阅读 DEV-README.md 了解项目结构。
4. 修改代码。
5. 测试。
6. 将执行结果写回1.md。

输出格式：

```
## DeepSeek执行结果

### 修改文件

### 修改内容

### 测试结果

### 遗留问题
```

完成后修改状态：

```
WAITING_CHATGPT_REVIEW
```

---

# 5. ChatGPT复核职责

DeepSeek完成后，ChatGPT负责：

- 检查是否符合 DEV-README。
- 检查架构是否正确。
- 检查是否修改错误目录。
- 检查是否影响其他工具。
- 检查版本号要求。

---

# 6. donew特别规则

所有修改必须遵守：

1. 先读 DEV-README.md。
2. 确认生产入口，不凭文件名判断。
3. 不跨层修改。
4. 前端修改升级版本号。
5. API修改确认调用链。
6. 不删除未知依赖文件。
7. 未明确要求不提交、不部署。

---

# 7. 任务生命周期

标准流程：

```
用户提出需求

↓

ChatGPT分析设计

↓

1.md记录方案

↓

用户通知DeepSeek

↓

DeepSeek编码测试

↓

1.md记录结果

↓

ChatGPT审核

↓

完成
```

---

# 8. 原则

两个 AI 不是竞争关系：

ChatGPT负责：

> 想清楚，再动手。

DeepSeek负责：

> 按方案，高质量实现。

最终目标：减少误修改、减少架构偏差，提高 donew 长期维护质量。
