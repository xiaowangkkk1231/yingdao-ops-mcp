# 应用运行异常汇报

## 1. 统计范围

- 统计时间：`{{startDate}} 至 {{endDate}}`
- 时间口径：按异常任务 `startTime` 统计（Asia/Shanghai）
- 数据来源：影刀执行记录及异常任务详情

## 2. 总体概览

| 指标 | 数值 |
|---|---:|
| 异常执行实例 | {{abnormalExecutionInstances}} |
| 异常任务 | {{abnormalJobs}} |
| 受影响应用 | {{affectedApps}} |
| 受影响机器人 | {{affectedRobots}} |
| 错误类型 | {{errorTypes}} |
| 异常运行时长 | {{abnormalDurationHours}} 小时 |
| 详情请求失败 | {{detailRequestFailures}} |

> 结论：本周期共发现 `{{abnormalJobs}}` 次异常任务，涉及 `{{affectedApps}}` 个应用和 `{{affectedRobots}}` 个机器人。

## 3. 异常最多的应用

| 排名 | 应用 | 异常次数 | 占比 |
|---:|---|---:|---:|
| 1 | {{appName}} | {{count}} | {{percentage}}% |

## 4. 主要错误原因与推荐解决方案

| 排名 | 错误原因 | 次数 | 占比 | 影响应用 | 推荐解决方案 |
|---:|---|---:|---:|---|---|
| 1 | {{error}} | {{count}} | {{percentage}}% | {{apps}} | {{recommendedSolution}} |

## 5. 机器人异常分布

| 排名 | 机器人 | 异常次数 | 占比 |
|---:|---|---:|---:|
| 1 | {{robotName}} | {{count}} | {{percentage}}% |

## 6. 重点问题与建议

### 高优先级

- **问题**：{{highPriorityIssue}}
- **影响**：{{impact}}
- **建议**：{{recommendation}}

### 其他建议

- {{otherRecommendation}}

## 7. 数据完整性

- 详情请求失败：`{{detailRequestFailures}}`
- 说明：{{dataQualityNote}}
