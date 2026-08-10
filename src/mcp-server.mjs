#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { YingdaoApiClient } from "./yingdao-api.mjs";
import { analyzeRecentErrors } from "./yingdao-analysis.mjs";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format");

function createEnvironmentClient() {
  return new YingdaoApiClient({
    username: process.env.YINGDAO_USERNAME,
    password: process.env.YINGDAO_PASSWORD,
    encryptedPassword: process.env.YINGDAO_ENCRYPTED_PASSWORD,
    basicAuth: process.env.YINGDAO_BASIC_AUTH,
    accessToken: process.env.YINGDAO_ACCESS_TOKEN,
  });
}

function scrubSecrets(value) {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !["access_token", "password", "authorization", "cookie", "x-credential"].includes(
            key.toLowerCase(),
          ),
      )
      .map(([key, item]) => [key, scrubSecrets(item)]),
  );
}

function result(value) {
  const structuredContent = scrubSecrets(value);
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : "Unknown Yingdao API error";
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function safeTool(clientFactory, handler) {
  return async (input, extra) => {
    try {
      return result(await handler(clientFactory(), input, extra.signal));
    } catch (error) {
      return errorResult(error);
    }
  };
}

export function createYingdaoMcpServer({ clientFactory = createEnvironmentClient } = {}) {
  const server = new McpServer({ name: "yingdao-ops", version: "0.2.0" });

  server.registerTool(
    "list_execution_records",
    {
      title: "查询影刀执行记录",
      description: "分页查询影刀应用执行记录。异常状态使用 error。",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        size: z.number().int().min(1).max(1000).default(10),
        isLast: z.boolean().default(false),
        scheduleUuidList: z.array(z.string()).default([]),
        statusList: z.array(z.string()).default([]),
      },
      annotations: readOnlyAnnotations,
    },
    safeTool(clientFactory, (client, input, signal) =>
      client.listExecutionRecords({ ...input, signal }),
    ),
  );

  server.registerTool(
    "get_exception_details",
    {
      title: "获取影刀异常详情",
      description: "根据执行实例和机器人 UUID 获取任务错误、起止时间和截图等详情。",
      inputSchema: {
        sceneInstUuid: z.string().min(1),
        robotClientUuid: z.string().min(1),
        page: z.number().int().min(1).default(1),
        size: z.number().int().min(1).max(100).default(10),
      },
      annotations: readOnlyAnnotations,
    },
    safeTool(clientFactory, (client, input, signal) =>
      client.getExceptionDetails({ ...input, signal }),
    ),
  );

  server.registerTool(
    "get_app_statistics",
    {
      title: "查询影刀应用统计",
      description: "按日期范围分页查询应用运行次数、运行时长、负责人和发布状态。",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        size: z.number().int().min(1).max(1000).default(100),
        startStatisticDate: dateSchema,
        endStatisticDate: dateSchema,
        sortBy: z.string().default("3"),
      },
      annotations: readOnlyAnnotations,
    },
    safeTool(clientFactory, (client, input, signal) =>
      client.getAppStatistics({ ...input, signal }),
    ),
  );

  server.registerTool(
    "get_runtime_total",
    {
      title: "汇总影刀运行次数和时长",
      description: "获取指定日期范围的总运行次数和总运行时长。",
      inputSchema: {
        startStatisticDate: dateSchema,
        endStatisticDate: dateSchema,
      },
      annotations: readOnlyAnnotations,
    },
    safeTool(clientFactory, (client, input, signal) =>
      client.getAppStatisticsTotal({ ...input, signal }),
    ),
  );

  server.registerTool(
    "get_daily_runtime",
    {
      title: "查询影刀每日运行时长",
      description: "获取最近 N 天的每日运行时长和累计运行时长；响应通常包含一个基线点。",
      inputSchema: { days: z.number().int().min(1).max(31).default(7) },
      annotations: readOnlyAnnotations,
    },
    safeTool(clientFactory, (client, input, signal) =>
      client.getTenantDailyRuntime({ ...input, signal }),
    ),
  );

  server.registerTool(
    "analyze_recent_errors",
    {
      title: "分析影刀近期运行异常",
      description: "查询日期范围内的异常实例和详情，按错误原因、应用和机器人汇总。",
      inputSchema: {
        startDate: dateSchema,
        endDate: dateSchema,
        top: z.number().int().min(1).max(50).default(20),
      },
      annotations: readOnlyAnnotations,
    },
    safeTool(clientFactory, (client, input, signal) =>
      analyzeRecentErrors(client, { ...input, signal }),
    ),
  );

  return server;
}

async function main() {
  const server = createYingdaoMcpServer();
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "MCP server failed");
    process.exit(1);
  });
}
