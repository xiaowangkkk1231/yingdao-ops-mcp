import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createYingdaoMcpServer } from "../src/mcp-server.mjs";

async function connectedClient(apiClient) {
  const server = createYingdaoMcpServer({ clientFactory: () => apiClient });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("MCP server exposes the six read-only Yingdao tools", async () => {
  const { client } = await connectedClient({});
  const response = await client.listTools();

  assert.deepEqual(
    response.tools.map((tool) => tool.name).sort(),
    [
      "analyze_recent_errors",
      "get_app_statistics",
      "get_daily_runtime",
      "get_exception_details",
      "get_runtime_total",
      "list_execution_records",
    ],
  );
  assert.ok(response.tools.every((tool) => tool.annotations?.readOnlyHint === true));
});

test("MCP runtime tool calls the API client and returns structured content", async () => {
  const apiClient = {
    async getTenantDailyRuntime({ days }) {
      return { success: true, data: [{ statisticDate: 20260805, dayRunTime: "70.33" }], days };
    },
  };
  const { client } = await connectedClient(apiClient);

  const response = await client.callTool({ name: "get_daily_runtime", arguments: { days: 7 } });

  assert.equal(response.isError, undefined);
  assert.equal(response.structuredContent.days, 7);
  assert.equal(response.structuredContent.data[0].dayRunTime, "70.33");
});

test("MCP tools convert API failures into safe tool errors", async () => {
  const apiClient = {
    async getAppStatisticsTotal() {
      throw new Error("Login failed");
    },
  };
  const { client } = await connectedClient(apiClient);

  const response = await client.callTool({
    name: "get_runtime_total",
    arguments: { startStatisticDate: "2026-08-01", endStatisticDate: "2026-08-05" },
  });

  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /Login failed/);
});
