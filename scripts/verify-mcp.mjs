import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    `--env-file-if-exists=${path.join(projectRoot, ".env")}`,
    path.join(projectRoot, "src", "mcp-server.mjs"),
  ],
  cwd: projectRoot,
});
const client = new Client({ name: "yingdao-mcp-verifier", version: "1.0.0" });

try {
  await client.connect(transport);
  const response = await client.listTools();
  const runtime = await client.callTool({
    name: "get_daily_runtime",
    arguments: { days: 1 },
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        server: "yingdao_ops",
        toolCount: response.tools.length,
        tools: response.tools.map((tool) => tool.name),
        allReadOnly: response.tools.every(
          (tool) => tool.annotations?.readOnlyHint === true,
        ),
        liveQuery: {
          success: runtime.structuredContent?.success,
          code: runtime.structuredContent?.code,
          dataPoints: Array.isArray(runtime.structuredContent?.data)
            ? runtime.structuredContent.data.length
            : null,
        },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await transport.close();
}
