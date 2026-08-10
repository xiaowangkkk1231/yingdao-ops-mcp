import fs from "node:fs";

import { YingdaoApiClient } from "../src/yingdao-api.mjs";
import { YingdaoAuthClient } from "../src/yingdao-auth.mjs";

const [capturePath] = process.argv.slice(2);
if (!capturePath) {
  throw new Error("Usage: node scripts/report-run-duration.mjs <capture>");
}

const capture = fs.readFileSync(capturePath, "utf8");
const loginLine = capture
  .split(/\r?\n/)
  .find((line) => line.includes("/oauth/token/v2?username="));
const basicAuth = capture.match(
  /authorization: Basic ([A-Za-z0-9+/=]+)/i,
)?.[1];
if (!loginLine || !basicAuth) {
  throw new Error("The capture does not contain a complete login request");
}

const capturedUrl = new URL(
  loginLine
    .replace(/^curl --url \^"/, "")
    .replace(/\^" \^?$/, "")
    .replaceAll("^", ""),
);
const auth = new YingdaoAuthClient({ basicAuth });
const login = await auth.login({
  username: capturedUrl.searchParams.get("username"),
  encryptedPassword: capturedUrl.searchParams.get("password"),
});
const client = new YingdaoApiClient({ accessToken: login.accessToken });
const response = await client.listExecutionRecords({ page: 1, size: 100 });
const samplesByStatus = new Map();
for (const item of response.data ?? []) {
  if (!samplesByStatus.has(item.status)) {
    samplesByStatus.set(item.status, {
      status: item.status,
      statusName: item.statusName,
      fields: Object.keys(item),
      timeFields: Object.fromEntries(
        Object.entries(item).filter(([key]) =>
          /(time|start|end|duration)/i.test(key),
        ),
      ),
    });
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      page: response.page,
      itemCount: Array.isArray(response.data) ? response.data.length : null,
      samplesByStatus: [...samplesByStatus.values()],
    },
    null,
    2,
  )}\n`,
);
