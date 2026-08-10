import fs from "node:fs";

import { YingdaoApiClient } from "../src/yingdao-api.mjs";
import { YingdaoAuthClient } from "../src/yingdao-auth.mjs";

const [capturePath, sceneInstUuid, robotClientUuid, startDate, endDate] =
  process.argv.slice(2);
if (!capturePath || !sceneInstUuid || !robotClientUuid || !startDate || !endDate) {
  throw new Error(
    "Usage: node scripts/verify-operations.mjs <capture> <sceneInstUuid> <robotClientUuid> <startDate> <endDate>",
  );
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

function summarize(payload) {
  const data = payload?.data;
  return {
    success: payload?.success,
    code: payload?.code,
    topLevelKeys: Object.keys(payload ?? {}),
    dataType: Array.isArray(data) ? "array" : typeof data,
    dataKeys:
      data && !Array.isArray(data) && typeof data === "object"
        ? Object.keys(data)
        : undefined,
    itemCount: Array.isArray(data)
      ? data.length
      : Array.isArray(data?.records)
        ? data.records.length
        : Array.isArray(data?.list)
          ? data.list.length
          : undefined,
  };
}

const executionRecords = await client.listExecutionRecords();
const exceptionDetails = await client.getExceptionDetails({
  sceneInstUuid,
  robotClientUuid,
});
const appStatistics = await client.getAppStatistics({
  startStatisticDate: startDate,
  endStatisticDate: endDate,
});

process.stdout.write(
  `${JSON.stringify(
    {
      executionRecords: summarize(executionRecords),
      exceptionDetails: summarize(exceptionDetails),
      appStatistics: summarize(appStatistics),
    },
    null,
    2,
  )}\n`,
);
