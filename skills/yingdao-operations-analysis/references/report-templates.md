# Report Templates

Select the template matching the requested data. Replace placeholders with queried values and omit sections that have no data. Keep runtime values in the API's original unit unless the unit is independently established.

## Execution Records

```markdown
# 执行记录汇报

- 查询条件：{{filters}}
- 查询时间：{{queriedAt}}（Asia/Shanghai）
- 数据页：第 {{page}} / {{pages}} 页，共 {{total}} 条

## 状态概览

| 状态 | 数量 | 占比 |
|---|---:|---:|
| {{statusName}} | {{count}} | {{percentage}}% |

## 执行明细

| 序号 | 应用 | 状态 | 执行记录 ID | 创建/触发时间 | 机器人 | 机器人数量 |
|---:|---|---|---|---|---|---:|
| 1 | {{sceneName}} | {{statusName}} | {{uuid}} | {{createTime}} | {{robotClientShowName}} | {{robotCount}} |

## 数据完整性

- 是否已读取全部分页：{{allPagesRead}}
- 说明：{{dataQualityNote}}
```

## Job Details

```markdown
# 执行任务详情汇报

- 执行记录 ID：{{sceneInstUuid}}
- 机器人：{{robotName}}
- 任务总数：{{jobCount}}

## 状态概览

| 状态 | 数量 | 占比 |
|---|---:|---:|
| {{statusName}} | {{count}} | {{percentage}}% |

## 任务明细

| 序号 | 任务 ID | 状态 | 开始时间 | 结束时间 | 运行时长 | 参数 | 动作数 | 说明 |
|---:|---|---|---|---|---:|---|---:|---|
| 1 | {{jobUuid}} | {{statusName}} | {{startTime}} | {{endTime}} | {{duration}} | {{existsParam}} | {{actionCount}} | {{remarkSummary}} |

## 可用诊断资料

- 云日志：{{cloudLogAvailability}}
- 云录屏：{{cloudScreenRecordAvailability}}
- 截图：{{screenshotAvailability}}

> 仅在用户明确要求时返回截图、日志或录屏地址。
```

## Application Statistics

```markdown
# 应用运行统计汇报

- 统计时间：{{startDate}} 至 {{endDate}}
- 应用总数：{{totalApps}}
- 有运行记录应用：{{activeApps}}
- 无运行记录应用：{{inactiveApps}}

## 汇总

| 指标 | 数值 |
|---|---:|
| 总运行次数 | {{totalRunCount}} |
| 总运行时长 | {{totalRunTime}} |

## 应用排名

| 排名 | 应用 ID | 应用 | 负责人 | 发布状态 | 运行次数 | 运行时长 | 次数占比 |
|---:|---|---|---|---|---:|---:|---:|
| 1 | {{appId}} | {{appName}} | {{ownerName}} | {{releaseStatus}} | {{runCount}} | {{runTime}} | {{percentage}}% |

## 观察

- {{observation}}

## 数据完整性

- 是否已读取全部分页：{{allPagesRead}}
- 运行时长单位：{{runtimeUnitNote}}
```

## Runtime Total

```markdown
# 运行汇总

- 统计时间：{{startDate}} 至 {{endDate}}

| 指标 | 数值 |
|---|---:|
| 总运行次数 | {{totalRunCount}} |
| 总运行时长 | {{totalRunTime}} |
| 平均每次运行时长 | {{averageRunTime}} |

## 结论

{{summary}}

> {{runtimeUnitNote}}
```

## Daily Runtime

```markdown
# 每日运行趋势汇报

- 统计天数：最近 {{days}} 天
- 时间范围：{{startDate}} 至 {{endDate}}

## 汇总

| 指标 | 数值 |
|---|---:|
| 周期运行时长 | {{periodRunTime}} |
| 日均运行时长 | {{averageDailyRunTime}} |
| 最高运行日期 | {{peakDate}} |
| 最高日运行时长 | {{peakRunTime}} |

## 每日明细

| 日期 | 当日运行时长 | 累计运行时长 | 较前一日变化 |
|---|---:|---:|---:|
| {{statisticDate}} | {{dayRunTime}} | {{totalRunTime}} | {{changePercentage}}% |

## 趋势判断

- {{trendObservation}}

## 数据完整性

- 基线点是否已排除：{{baselineExcluded}}
- 运行时长单位：{{runtimeUnitNote}}
```

## Abnormal Run Analysis

```markdown
# 应用运行异常汇报

- 统计时间：{{startDate}} 至 {{endDate}}
- 时间口径：按异常任务 `startTime` 统计（Asia/Shanghai）

## 总体概览

| 指标 | 数值 |
|---|---:|
| 异常执行实例 | {{abnormalExecutionInstances}} |
| 异常任务 | {{abnormalJobs}} |
| 受影响应用 | {{affectedApps}} |
| 受影响机器人 | {{affectedRobots}} |
| 错误类型 | {{errorTypes}} |
| 异常运行时长 | {{abnormalDurationHours}} 小时 |

## 异常应用排名

| 排名 | 应用 | 异常次数 | 占比 |
|---:|---|---:|---:|
| 1 | {{appName}} | {{count}} | {{percentage}}% |

## 主要错误原因与推荐解决方案

| 排名 | 错误原因 | 次数 | 占比 | 影响应用 | 推荐解决方案 |
|---:|---|---:|---:|---|---|
| 1 | {{error}} | {{count}} | {{percentage}}% | {{apps}} | {{recommendedSolution}} |

## 机器人异常分布

| 排名 | 机器人 | 异常次数 | 占比 |
|---:|---|---:|---:|
| 1 | {{robotName}} | {{count}} | {{percentage}}% |

## 处理优先级

- 高：{{highPriorityAction}}
- 中：{{mediumPriorityAction}}
- 低：{{lowPriorityAction}}

## 数据完整性

- 未绑定机器人实例：{{instancesWithoutRobot}}
- 详情请求失败：{{detailRequestFailures}}
- 说明：{{dataQualityNote}}
```
