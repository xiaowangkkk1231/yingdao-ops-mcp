import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [toolName, rawArguments = "{}"] = process.argv.slice(2);
if (!toolName) {
  throw new Error("Usage: node scripts/call-mcp.mjs <tool-name> '<arguments-json>'");
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    `--env-file-if-exists=${path.join(projectRoot, ".env")}`,
    path.join(projectRoot, "src", "mcp-server.mjs"),
  ],
  cwd: projectRoot,
});
const client = new Client({ name: "yingdao-mcp-cli", version: "1.0.0" });

try {
  const argumentsJson = rawArguments.startsWith("base64:")
    ? Buffer.from(rawArguments.slice("base64:".length), "base64").toString("utf8")
    : rawArguments;
  await client.connect(transport);
  const response = await client.callTool({
    name: toolName,
    arguments: JSON.parse(argumentsJson),
  });
  if (response.isError) {
    process.stderr.write(`${response.content?.[0]?.text ?? "MCP tool failed"}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${JSON.stringify(response.structuredContent, null, 2)}\n`);
  }
} finally {
  await transport.close();
}
