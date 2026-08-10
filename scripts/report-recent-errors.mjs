import fs from "node:fs";

import { YingdaoApiClient } from "../src/yingdao-api.mjs";
import { YingdaoAuthClient } from "../src/yingdao-auth.mjs";

const [capturePath, startDate, endDate] = process.argv.slice(2);
if (!capturePath || !startDate || !endDate) {
  throw new Error(
    "Usage: node scripts/report-recent-errors.mjs <capture> <startDate> <endDate>",
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

const startTime = `${startDate} 00:00:00`;
const endTime = `${endDate} 23:59:59`;
const sceneRecords = [];
const pageSize = 1000;
for (let page = 1; ; page += 1) {
  const response = await client.listExecutionRecords({
    page,
    size: pageSize,
    statusList: ["error"],
  });
  const records = response.data ?? [];
  sceneRecords.push(
    ...records.filter(
      (record) => record.createTime >= startTime && record.createTime <= endTime,
    ),
  );
  const oldest = records.at(-1)?.createTime;
  if (!records.length || !oldest || oldest < startTime || page >= response.page.pages) {
    break;
  }
}

const detailTargets = sceneRecords.flatMap((record) =>
  [...new Set((record.executeRobotClientUuidList ?? []).filter(Boolean))].map(
    (robotClientUuid) => ({ record, robotClientUuid }),
  ),
);
const detailResults = [];
const detailFailures = [];
for (let index = 0; index < detailTargets.length; index += 10) {
  const batch = detailTargets.slice(index, index + 10);
  const settled = await Promise.allSettled(
    batch.map(async ({ record, robotClientUuid }) => ({
      record,
      response: await client.getExceptionDetails({
        sceneInstUuid: record.uuid,
        robotClientUuid,
        page: 1,
        size: 100,
      }),
    })),
  );
  for (let offset = 0; offset < settled.length; offset += 1) {
    const result = settled[offset];
    if (result.status === "fulfilled") {
      detailResults.push(result.value);
    } else {
      detailFailures.push({
        sceneInstUuid: batch[offset].record.uuid,
        message: result.reason instanceof Error ? result.reason.message : "Unknown error",
      });
    }
  }
}

const errorJobs = detailResults.flatMap(({ record, response }) =>
  (response.data ?? [])
    .filter((job) => job.status === "error")
    .map((job) => ({ record, job })),
);

function increment(map, key, details) {
  const current = map.get(key) ?? { count: 0, ...details };
  current.count += 1;
  map.set(key, current);
}

function errorCause(remark) {
  const text = String(remark || "未返回错误说明")
    .replace(/^【[0-9a-f-]{36}】任务失败，?/i, "")
    .trim();
  const marker = text.lastIndexOf("出错：");
  const cause = marker >= 0 ? text.slice(marker + 3).trim() : text;
  return cause
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<uuid>")
    .replace(/\d{10,}/g, "<id>");
}

const byApp = new Map();
const byRobot = new Map();
const byError = new Map();
let abnormalDurationSeconds = 0;
for (const { record, job } of errorJobs) {
  const start = Date.parse(String(job.startTime).replace(" ", "T") + "+08:00");
  const end = Date.parse(String(job.endTime).replace(" ", "T") + "+08:00");
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    abnormalDurationSeconds += (end - start) / 1000;
  }
  increment(byApp, record.sceneName || "未知应用", {});
  increment(byRobot, record.robotClientShowName || job.robotName || "未知机器人", {});
  const cause = errorCause(job.remark);
  const current = byError.get(cause) ?? { count: 0, apps: new Set() };
  current.count += 1;
  current.apps.add(record.sceneName || "未知应用");
  byError.set(cause, current);
}

const rank = (map, limit = 20) =>
  [...map.entries()]
    .map(([name, value]) => ({
      name,
      count: value.count,
      percentage: Number(((value.count / errorJobs.length) * 100).toFixed(1)),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
const topErrors = [...byError.entries()]
  .map(([error, value]) => ({
    error,
    count: value.count,
    percentage: Number(((value.count / errorJobs.length) * 100).toFixed(1)),
    apps: [...value.apps].slice(0, 5),
  }))
  .sort((left, right) => right.count - left.count)
  .slice(0, 20);

process.stdout.write(
  `${JSON.stringify(
    {
      period: { startDate, endDate },
      abnormalExecutionInstances: sceneRecords.length,
      abnormalJobs: errorJobs.length,
      affectedApps: byApp.size,
      affectedRobots: byRobot.size,
      errorTypes: byError.size,
      instancesWithoutRobot: sceneRecords.filter(
        (record) => !(record.executeRobotClientUuidList ?? []).some(Boolean),
      ).length,
      detailRequestFailures: detailFailures.length,
      abnormalDurationHours: Number((abnormalDurationSeconds / 3600).toFixed(2)),
      topApps: rank(byApp),
      topRobots: rank(byRobot),
      topErrors,
    },
    null,
    2,
  )}\n`,
);
