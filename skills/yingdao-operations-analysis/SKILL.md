---
name: yingdao-operations-analysis
description: Analyze live Yingdao application, robot, execution, runtime, and error data through the yingdao_ops MCP server. Use when the user asks for recent application runs, robot runtime, execution records, abnormal jobs, error causes, failure rankings, or operational recommendations.
---

# Yingdao Operations Analysis

Use the read-only `yingdao_ops` MCP tools to answer operational questions about Yingdao. Do not invent values from memory or use captured browser tokens.

If the MCP server is unavailable, change to the installed `yingdao-ops-mcp` project root (containing `package.json` and `src/`) and use `node --env-file=.env src/ops-cli.mjs` for individual queries. Do not use capture-based verification scripts for normal operation. The complete error aggregation workflow requires MCP or the existing `scripts/report-recent-errors.mjs` integration script.

## Tool Selection

- Use `get_daily_runtime` for daily robot runtime. The response normally contains a baseline point; sum `dayRunTime` from the requested daily points and do not add the baseline.
- Use `get_runtime_total` for total run count and runtime across an explicit date range.
- Use `get_app_statistics` for application-level run counts, runtime, owner, and release status. Paginate when `page.pages` is greater than one and filter `runCount > 0` when the user asks which applications actually ran.
- Use `list_execution_records` for execution status and instance identifiers. Use `statusList: ["error"]` for abnormal executions.
- Use `get_exception_details` with the instance UUID and robot client UUID from an execution record to retrieve `startTime`, `endTime`, `remark`, screenshot, and job status.
- Use `analyze_recent_errors` for a complete date-range error report. Prefer this tool over manually repeating the execution/detail sequence.
  The date range is applied to each abnormal job's `startTime` from the job-list response; execution-instance `createTime` is used only to discover candidate instances.

## Date Handling

Interpret relative dates in Asia/Shanghai time. For "最近 N 天" use the current calendar day plus the preceding N-1 calendar days unless the user explicitly asks for completed days. Format dates as `YYYY-MM-DD`.

When the user asks for completed days, exclude today and use the preceding N calendar days. State the selected range in the answer.

## Error Analysis Workflow

1. Resolve the date range and state it before reporting results.
2. Call `analyze_recent_errors` with that range.
3. Report abnormal execution count, affected applications, affected robots, error types, and abnormal runtime.
4. Show the highest-frequency errors with counts, percentages, affected applications, and one specific recommended solution for each error.
5. Show the highest-frequency applications and robots.
6. Group dynamic UUIDs, long numeric IDs, and filenames when they represent the same underlying error.
7. Give remediation priorities based on frequency and operational impact. Distinguish code/data errors from browser, selector, network, and environment errors.

## Report Format

Read [report-templates.md](references/report-templates.md) when producing any report. Select the template by tool:

- `list_execution_records`: Execution Records
- `get_exception_details`: Job Details
- `get_app_statistics`: Application Statistics
- `get_runtime_total`: Runtime Total
- `get_daily_runtime`: Daily Runtime
- `analyze_recent_errors`: Abnormal Run Analysis

Read [report-examples.md](references/report-examples.md) only when the user asks for a sample or format demonstration. Treat every value in that file as fictional and never present it as queried data.

For an embeddable HTML demonstration, use [report-examples.html](references/report-examples.html). It is self-contained, uses no external assets, and all displayed values are fictional.

Replace placeholders with actual queried values and omit empty ranking rows. For abnormal reports, provide one specific, actionable recommended solution for every error row; do not use generic text such as "check the program".

## Runtime Workflow

1. Call `get_daily_runtime` for a daily trend or `get_runtime_total` for a range total.
2. Preserve the API's original runtime value and mention that the API does not provide a unit field when the unit is not established.
3. Use `get_app_statistics` when the user needs an application ranking rather than a tenant-wide total.

## Output and Safety

- Never expose passwords, access tokens, cookies, authorization headers, or `X-Credential` values.
- Do not return complete raw responses when a concise table or summary answers the question.
- Treat screenshot and log URLs as sensitive operational data; include them only when specifically requested.
- These tools are read-only. Do not claim that an error was fixed, retried, stopped, or deleted.
- If a tool returns an error, report the operation and a safe error message, then stop rather than guessing.
